// worker/lib/webpush.js
//
// 표준 Web Push 발송 도우미 — VAPID(ES256) JWT 서명 + RFC 8291 페이로드
// E2E 암호화(aes128gcm). Cloudflare Workers의 WebCrypto(globalThis.crypto.subtle)
// 만 사용한다. 노드 web-push 라이브러리/FCM SDK를 쓰지 않는다.
//
// 설계 원칙(BACKEND_PUSH_PLAN.md 4장 / 워크플로우 명세):
//  - 개인키(VAPID private)는 인자(env)로만 받는다. 하드코딩/커밋 금지.
//  - 모든 푸시는 userVisibleOnly:true 전제(silent 금지) — 페이로드는 호출자가 구성.
//  - endpoint 는 bearer 비밀이므로 이 모듈은 로그를 남기지 않는다(평문 노출 방지).
//
// ─────────────────────────────────────────────────────────────────────────────
//  게이트(GATE) — 미검증, 활성화 불가
// ─────────────────────────────────────────────────────────────────────────────
//  이 파일의 *암호 1차 구성요소*(base64url, HKDF, ECDH, AES-GCM, ES256 서명)는
//  Node WebCrypto 로 단위검증된다(worker/test/webpush.test.mjs). 그러나 아래는
//  본 워크플로우 범위(서버사이드 순수로직)와 환경 제약으로 *미검증*이며,
//  실기기 푸시 도달 테스트 + 프로덕션 VAPID 키 + 배포 전까지 "완료"로 표기 금지:
//
//   1) 실제 푸시 서비스(FCM/Mozilla/Apple) 와의 end-to-end 상호운용
//      — 브라우저가 만든 진짜 p256dh/auth 로 암호화한 ciphertext 를 푸시 서비스가
//        수락하고 SW push 이벤트에서 복호화되는지는 실기기에서만 검증 가능.
//   2) VAPID 프로덕션 키쌍 — 여기서는 키를 env 인자로만 받는다. 공개키는
//      클라에 플레이스홀더, 개인키는 wrangler secret. 본 모듈은 키를 생성하지 않음.
//   3) sendPush() 의 HTTP fetch 경로 — Workers fetch 런타임 동작/410·404 처리는
//      worker/index.js scheduled() 통합 + 실배포에서만 검증.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = globalThis.crypto;
const subtle = crypto.subtle;

const enc = new TextEncoder();

// ── base64url ────────────────────────────────────────────────────────────────

/** Uint8Array | ArrayBuffer -> base64url(no padding) */
export function bytesToBase64url(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa 는 Workers/Node 모두 전역으로 제공.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url | base64 (padding 유무 무관) -> Uint8Array */
export function base64urlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── 바이트 유틸 ───────────────────────────────────────────────────────────────

function concatBytes(...parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** 16-bit big-endian length prefix + payload (RFC 8291 info 구성용) */
function uint16BE(n) {
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}

// ── HKDF (RFC 5869) via WebCrypto ────────────────────────────────────────────
//
// salt/ikm/info -> length 바이트. SHA-256 고정(Web Push aes128gcm 규약).

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

// ── ECDH: 우리(서버) ephemeral P-256 키 + 구독자 공개키 ─────────────────────────

async function generateEphemeralEcdhKeyPair() {
  return subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
}

/** raw(65바이트 0x04||X||Y) 공개키 -> ECDH publicKey CryptoKey */
async function importEcdhPublicKey(rawUncompressed) {
  return subtle.importKey(
    'raw',
    rawUncompressed,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

/** ECDH 공유 비밀(raw 32바이트) */
async function deriveSharedSecret(privateKey, publicKey) {
  const bits = await subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );
  return new Uint8Array(bits);
}

/** CryptoKey(ECDH public) -> raw 65바이트(0x04||X||Y) */
async function exportRawPublicKey(key) {
  const raw = await subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

// ── RFC 8291 aes128gcm 페이로드 암호화 ───────────────────────────────────────
//
// 입력:
//   plaintext: Uint8Array (≤ ~3993B; Web Push 페이로드는 2KB 상한 권장)
//   subscriberPublicKey: raw 65B (구독자 p256dh)
//   authSecret: 16B (구독자 auth)
// 출력:
//   aes128gcm content-coding body (헤더에 salt + record size + keyid(서버 공개키) 포함)
//
// 참고: RFC 8188(aes128gcm content coding) + RFC 8291(web push 키 유도 info).

const KEY_INFO = enc.encode('WebPush: info\0');
const CEK_INFO = enc.encode('Content-Encoding: aes128gcm\0');
const NONCE_INFO = enc.encode('Content-Encoding: nonce\0');

/**
 * @returns {Promise<Uint8Array>} aes128gcm 본문(HTTP body 로 그대로 전송)
 */
export async function encryptPayload(plaintext, subscriberPublicKey, authSecret) {
  if (!(plaintext instanceof Uint8Array)) {
    throw new TypeError('plaintext must be Uint8Array');
  }
  if (subscriberPublicKey.length !== 65 || subscriberPublicKey[0] !== 0x04) {
    throw new Error('subscriber public key must be 65-byte uncompressed point');
  }
  if (authSecret.length !== 16) {
    throw new Error('auth secret must be 16 bytes');
  }

  // 1) salt 16B + 서버 ephemeral 키쌍
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeys = await generateEphemeralEcdhKeyPair();
  const serverPubRaw = await exportRawPublicKey(serverKeys.publicKey); // 65B
  const uaPub = await importEcdhPublicKey(subscriberPublicKey);

  // 2) ECDH 공유 비밀
  const ecdhSecret = await deriveSharedSecret(serverKeys.privateKey, uaPub); // 32B

  // 3) PRK(IKM) 유도 — RFC 8291 §3.4
  //    key_info = "WebPush: info\0" || ua_public || as_public
  const keyInfo = concatBytes(KEY_INFO, subscriberPublicKey, serverPubRaw);
  //    IKM = HKDF(auth_secret, ecdh_secret, key_info, 32)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // 4) CEK(16B) / NONCE(12B) — RFC 8188 §3.4 (salt 가 HKDF salt 로 들어감)
  const cek = await hkdf(salt, ikm, CEK_INFO, 16);
  const nonce = await hkdf(salt, ikm, NONCE_INFO, 12);

  // 5) 패딩: RFC 8188 record 는 plaintext || 0x02 || padding(여기선 padding=0)
  //    단일 레코드만 사용하므로 마지막 레코드 구분자 0x02.
  const padded = concatBytes(plaintext, new Uint8Array([0x02]));

  // 6) AES-128-GCM 암호화
  const aesKey = await subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);
  const ctBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    padded,
  );
  const ciphertext = new Uint8Array(ctBuf);

  // 7) aes128gcm 헤더(RFC 8188 §2.1):
  //    salt(16) || rs(4, big-endian) || idlen(1) || keyid(idlen) || ciphertext
  //    keyid = 서버 ephemeral 공개키(65B). rs = 레코드 크기(>= header+ciphertext).
  const rs = 4096;
  const header = concatBytes(
    salt,
    new Uint8Array([(rs >>> 24) & 0xff, (rs >>> 16) & 0xff, (rs >>> 8) & 0xff, rs & 0xff]),
    new Uint8Array([serverPubRaw.length]),
    serverPubRaw,
  );

  return concatBytes(header, ciphertext);
}

// ── VAPID: ES256 JWT 서명 ────────────────────────────────────────────────────
//
// VAPID 개인키는 두 형태를 지원:
//   - raw d (32바이트) base64url  (web-push 가 출력하는 형태)
//   - PKCS#8 base64(der)          (다른 도구 출력 형태)
// 둘 다 P-256(ES256). 개인키는 인자로만 받는다.

/** base64url(raw d, 32B) -> JWK private key, 그리고 매칭 공개키 좌표 필요 */
function rawDToJwk(rawD, publicKeyRaw) {
  // publicKeyRaw: raw 65B(0x04||X||Y) — VAPID 공개키(클라가 쓰는 그 키)
  const x = publicKeyRaw.slice(1, 33);
  const y = publicKeyRaw.slice(33, 65);
  return {
    kty: 'EC',
    crv: 'P-256',
    d: bytesToBase64url(rawD),
    x: bytesToBase64url(x),
    y: bytesToBase64url(y),
    ext: true,
  };
}

/**
 * VAPID 개인키 import.
 * @param {object} keys
 * @param {string} keys.privateKey  base64url raw d(32B) — VAPID 개인키(env/secret)
 * @param {string} keys.publicKey   base64url raw 65B — VAPID 공개키(클라와 동일)
 * @returns {Promise<CryptoKey>} ECDSA P-256 private key (sign)
 */
export async function importVapidPrivateKey({ privateKey, publicKey }) {
  const rawD = base64urlToBytes(privateKey);
  if (rawD.length !== 32) {
    throw new Error('VAPID private key must be 32-byte raw scalar (base64url)');
  }
  const pubRaw = base64urlToBytes(publicKey);
  if (pubRaw.length !== 65 || pubRaw[0] !== 0x04) {
    throw new Error('VAPID public key must be 65-byte uncompressed point (base64url)');
  }
  const jwk = rawDToJwk(rawD, pubRaw);
  return subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/**
 * VAPID JWT(ES256) 서명.
 * @param {object} args
 * @param {string} args.audience  푸시 서비스 origin (예: https://fcm.googleapis.com)
 * @param {string} args.subject   mailto:... 또는 https://... (연락처)
 * @param {CryptoKey} args.privateKey  importVapidPrivateKey() 결과
 * @param {number} [args.expiration]  epoch seconds (기본 now+12h, 최대 24h 권장)
 * @param {number} [args.now]      테스트용 고정 시각(epoch seconds)
 * @returns {Promise<string>} 서명된 JWT (compact)
 */
export async function signVapidJwt({ audience, subject, privateKey, expiration, now }) {
  if (!audience) throw new Error('audience required');
  if (!subject) throw new Error('subject required');
  const iat = typeof now === 'number' ? now : Math.floor(Date.now() / 1000);
  const exp = typeof expiration === 'number' ? expiration : iat + 12 * 60 * 60;

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp, sub: subject };

  const signingInput =
    bytesToBase64url(enc.encode(JSON.stringify(header))) +
    '.' +
    bytesToBase64url(enc.encode(JSON.stringify(payload)));

  const sigBuf = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    enc.encode(signingInput),
  );
  // WebCrypto ECDSA 출력은 이미 raw r||s(64B) — JWS ES256 가 요구하는 형태 그대로.
  const sig = bytesToBase64url(new Uint8Array(sigBuf));
  return signingInput + '.' + sig;
}

/** 푸시 서비스 origin 추출 (VAPID aud) */
export function audienceFromEndpoint(endpoint) {
  const u = new URL(endpoint);
  return `${u.protocol}//${u.host}`;
}

// ── 발송 헤더 빌더 ────────────────────────────────────────────────────────────
//
// aes128gcm + VAPID(인증 스킴 vapid) 발송에 필요한 HTTP 헤더 구성.

/**
 * @param {object} args
 * @param {string} args.jwt           signVapidJwt 결과
 * @param {string} args.vapidPublicKey base64url raw 65B
 * @param {number} args.ttl           초 (예매 임박 알림은 짧게 권장)
 * @param {'normal'|'low'|'very-low'|'high'} [args.urgency]
 * @param {string} [args.topic]       collapse key(Topic 헤더, ≤32 base64url chars)
 * @returns {Record<string,string>}
 */
export function buildPushHeaders({ jwt, vapidPublicKey, ttl, urgency, topic }) {
  const headers = {
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(ttl == null ? 0 : ttl),
  };
  if (urgency) headers.Urgency = urgency;
  if (topic) headers.Topic = topic;
  return headers;
}

// ── 통합 발송 (GATE: 실 fetch/도달 미검증) ────────────────────────────────────
//
// 단위테스트에서는 fetchImpl 을 주입해 헤더/본문/410 처리만 검증한다.
// 실제 푸시 서비스 도달은 실기기/배포에서만 확인 가능(상단 GATE #1, #3).

/**
 * 단일 구독에 암호화 푸시 발송.
 * @param {object} args
 * @param {{endpoint:string,p256dh:string,auth:string}} args.subscription
 *        p256dh/auth 는 base64url
 * @param {Uint8Array|string} args.payload  ≤2KB 권장. 문자열이면 UTF-8 인코딩.
 * @param {object} args.vapid  { publicKey, privateKey(CryptoKey), subject }
 *        publicKey: base64url raw 65B / privateKey: importVapidPrivateKey 결과
 * @param {number} [args.ttl=600]
 * @param {string} [args.urgency]
 * @param {string} [args.topic]
 * @param {number} [args.now]  테스트용 고정 시각
 * @param {typeof fetch} [args.fetchImpl=fetch]  주입용(테스트)
 * @returns {Promise<{status:number, gone:boolean, ok:boolean, retryAfter:number|null}>}
 *          gone=true 면 410/404 → 호출자가 D1 에서 즉시 DELETE.
 *          status===429 면 retryAfter(초, Retry-After 파싱) 로 호출자가 백오프/skip.
 */
export async function sendPush({
  subscription,
  payload,
  vapid,
  ttl = 600,
  urgency,
  topic,
  now,
  fetchImpl,
}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const { endpoint, p256dh, auth } = subscription;

  const plaintext =
    typeof payload === 'string' ? enc.encode(payload) : payload;
  if (plaintext.length > 3993) {
    // aes128gcm 단일 레코드 + 2KB 권장 상한 초과 방지(fail-closed).
    throw new Error('push payload too large');
  }

  const body = await encryptPayload(
    plaintext,
    base64urlToBytes(p256dh),
    base64urlToBytes(auth),
  );

  const jwt = await signVapidJwt({
    audience: audienceFromEndpoint(endpoint),
    subject: vapid.subject,
    privateKey: vapid.privateKey,
    now,
  });

  const headers = buildPushHeaders({
    jwt,
    vapidPublicKey: vapid.publicKey,
    ttl,
    urgency,
    topic,
  });

  const res = await doFetch(endpoint, { method: 'POST', headers, body });
  const status = res.status;
  const gone = status === 404 || status === 410;
  // 2xx 성공. 그 외(429/5xx 등)는 호출자가 재시도 정책 판단.
  // 429 면 Retry-After(초 또는 HTTP-date)를 파싱해 백오프 힌트로 반환.
  return {
    status,
    gone,
    ok: status >= 200 && status < 300,
    retryAfter: status === 429 ? parseRetryAfter(res, now) : null,
  };
}

/**
 * Retry-After 헤더를 초(정수)로 파싱. delta-seconds 또는 HTTP-date 모두 처리.
 * 헤더 없음/파싱 불가면 null. res.headers 가 없거나 get 이 없어도 안전(테스트 주입 대비).
 * @param {{headers?:{get?:(name:string)=>string|null}}} res
 * @param {number} [nowSeconds]  HTTP-date 상대 계산용(테스트 고정 시각, epoch seconds)
 * @returns {number|null}
 */
export function parseRetryAfter(res, nowSeconds) {
  const raw =
    res && res.headers && typeof res.headers.get === 'function'
      ? res.headers.get('Retry-After')
      : null;
  if (!raw) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return secs >= 0 ? Math.floor(secs) : 0;
  const dateMs = Date.parse(raw);
  if (!Number.isNaN(dateMs)) {
    const base = typeof nowSeconds === 'number' ? nowSeconds * 1000 : Date.now();
    const delta = Math.round((dateMs - base) / 1000);
    return delta > 0 ? delta : 0;
  }
  return null;
}
