// worker/test/webpush.test.mjs
//
// node --test 단위검증. Node 22 WebCrypto(globalThis.crypto.subtle)는 Workers와
// 동일 API 이므로 암호 1차 구성요소를 실제로 검증한다:
//   - base64url 라운드트립
//   - encryptPayload: 구독자 키로 복호화 라운드트립(RFC 8291/8188 자체 정합성)
//   - signVapidJwt: 공개키로 서명 검증 + 클레임 확인
//   - sendPush: 헤더/본문 구성 + 410/404 gone 처리 (fetch 주입)
//
// GATE(미검증): 실제 푸시 서비스(FCM/Mozilla/Apple) 상호운용 + 실기기 도달.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bytesToBase64url,
  base64urlToBytes,
  encryptPayload,
  importVapidPrivateKey,
  signVapidJwt,
  audienceFromEndpoint,
  buildPushHeaders,
  sendPush,
} from '../lib/webpush.js';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── base64url ────────────────────────────────────────────────────────────────

test('base64url round-trip preserves bytes', () => {
  for (const len of [0, 1, 2, 3, 16, 32, 65, 100]) {
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    const b64 = bytesToBase64url(bytes);
    assert.ok(!/[+/=]/.test(b64), 'no url-unsafe or padding chars');
    assert.deepEqual(base64urlToBytes(b64), bytes);
  }
});

test('base64urlToBytes accepts standard base64 and padding', () => {
  // "hello" -> standard base64 "aGVsbG8="
  assert.deepEqual(base64urlToBytes('aGVsbG8='), enc.encode('hello'));
  assert.deepEqual(base64urlToBytes('aGVsbG8'), enc.encode('hello'));
});

// ── 구독자 키쌍 헬퍼 (브라우저 PushSubscription 모사) ──────────────────────────

async function makeSubscriberKeys() {
  // 구독자(브라우저)의 ECDH P-256 키쌍 + 16B auth secret.
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const rawPub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey)); // 65B
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, rawPub, auth };
}

// aes128gcm 본문을 구독자 입장에서 복호화(RFC 8188/8291) — 자체 정합성 검증용.
async function decryptAes128gcm(body, subscriberPrivKey, subscriberRawPub, auth) {
  // header: salt(16) || rs(4) || idlen(1) || keyid(idlen)
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const serverPubRaw = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);

  const serverPub = await subtle.importKey(
    'raw',
    serverPubRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
  const ecdhBits = await subtle.deriveBits(
    { name: 'ECDH', public: serverPub },
    subscriberPrivKey,
    256,
  );
  const ecdhSecret = new Uint8Array(ecdhBits);

  // key_info = "WebPush: info\0" || ua_public || as_public
  const keyInfo = concat(
    enc.encode('WebPush: info\0'),
    subscriberRawPub,
    serverPubRaw,
  );
  const ikm = await hkdf(auth, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const ptBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    ciphertext,
  );
  const padded = new Uint8Array(ptBuf);
  // 마지막 바이트는 레코드 구분자(0x02). 제거.
  return padded.slice(0, padded.length - 1);
}

function concat(...parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

// ── encryptPayload 라운드트립 ────────────────────────────────────────────────

test('encryptPayload -> subscriber can decrypt to original plaintext', async () => {
  const { kp, rawPub, auth } = await makeSubscriberKeys();
  const plaintext = enc.encode(
    JSON.stringify({ title: 'HH 예매 오픈 임박', body: '15분 후', url: '/' }),
  );

  const body = await encryptPayload(plaintext, rawPub, auth);

  // aes128gcm 헤더 형태 점검
  assert.equal(body[20], 65, 'keyid length should be 65 (raw P-256 point)');
  assert.equal(body.slice(21, 86)[0], 0x04, 'server pub key is uncompressed');

  const recovered = await decryptAes128gcm(body, kp.privateKey, rawPub, auth);
  assert.deepEqual(recovered, plaintext);
  assert.equal(dec.decode(recovered), dec.decode(plaintext));
});

test('encryptPayload produces fresh salt/key each call (non-deterministic)', async () => {
  const { rawPub, auth } = await makeSubscriberKeys();
  const pt = enc.encode('same');
  const a = await encryptPayload(pt, rawPub, auth);
  const b = await encryptPayload(pt, rawPub, auth);
  assert.notDeepEqual(a.slice(0, 16), b.slice(0, 16), 'salt should differ');
});

test('encryptPayload rejects bad key/auth lengths', async () => {
  const { rawPub, auth } = await makeSubscriberKeys();
  await assert.rejects(() => encryptPayload(enc.encode('x'), rawPub.slice(0, 64), auth));
  await assert.rejects(() => encryptPayload(enc.encode('x'), rawPub, auth.slice(0, 15)));
  await assert.rejects(() => encryptPayload('not-bytes', rawPub, auth));
});

// ── VAPID JWT ────────────────────────────────────────────────────────────────

// 테스트용 VAPID 키쌍 생성 (프로덕션 키 아님 — 게이트). raw d + raw 65B pub.
async function makeVapidTestKeys() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  const rawPub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey)); // 65B
  return {
    privateKeyB64: jwk.d, // base64url raw d(32B) — web-push 출력과 동형
    publicKeyB64: bytesToBase64url(rawPub),
    verifyKey: kp.publicKey,
  };
}

test('signVapidJwt produces an ES256 JWT verifiable by the public key', async () => {
  const { privateKeyB64, publicKeyB64, verifyKey } = await makeVapidTestKeys();
  const priv = await importVapidPrivateKey({
    privateKey: privateKeyB64,
    publicKey: publicKeyB64,
  });

  const now = 1_700_000_000;
  const jwt = await signVapidJwt({
    audience: 'https://fcm.googleapis.com',
    subject: 'mailto:ops@example.com',
    privateKey: priv,
    now,
  });

  const [h, p, s] = jwt.split('.');
  const header = JSON.parse(dec.decode(base64urlToBytes(h)));
  const payload = JSON.parse(dec.decode(base64urlToBytes(p)));
  assert.equal(header.alg, 'ES256');
  assert.equal(header.typ, 'JWT');
  assert.equal(payload.aud, 'https://fcm.googleapis.com');
  assert.equal(payload.sub, 'mailto:ops@example.com');
  // VAPID(RFC 8292) JWT 는 aud/exp/sub 만 요구 — iat 는 넣지 않는다.
  assert.equal(payload.exp, now + 12 * 3600);
  assert.ok(!('iat' in payload), 'VAPID JWT omits iat');

  // 서명 검증 — raw r||s(64B) 형태여야 WebCrypto verify 통과.
  const sig = base64urlToBytes(s);
  assert.equal(sig.length, 64, 'ES256 signature is raw r||s (64 bytes)');
  const ok = await subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    verifyKey,
    sig,
    enc.encode(h + '.' + p),
  );
  assert.ok(ok, 'signature must verify with VAPID public key');
});

test('importVapidPrivateKey rejects malformed keys', async () => {
  await assert.rejects(() =>
    importVapidPrivateKey({ privateKey: bytesToBase64url(new Uint8Array(31)), publicKey: bytesToBase64url(new Uint8Array(65)) }),
  );
});

test('audienceFromEndpoint extracts origin only', () => {
  assert.equal(
    audienceFromEndpoint('https://fcm.googleapis.com/fcm/send/abc123?x=1'),
    'https://fcm.googleapis.com',
  );
  assert.equal(
    audienceFromEndpoint('https://updates.push.services.mozilla.com/wpush/v2/gAAA'),
    'https://updates.push.services.mozilla.com',
  );
});

// ── buildPushHeaders ─────────────────────────────────────────────────────────

test('buildPushHeaders sets vapid auth + aes128gcm headers', () => {
  const h = buildPushHeaders({
    jwt: 'JWT.TOKEN.SIG',
    vapidPublicKey: 'PUBKEY',
    ttl: 600,
    urgency: 'high',
    topic: 'tk-1',
  });
  assert.equal(h.Authorization, 'vapid t=JWT.TOKEN.SIG, k=PUBKEY');
  assert.equal(h['Content-Encoding'], 'aes128gcm');
  assert.equal(h['Content-Type'], 'application/octet-stream');
  assert.equal(h.TTL, '600');
  assert.equal(h.Urgency, 'high');
  assert.equal(h.Topic, 'tk-1');
});

test('buildPushHeaders omits optional urgency/topic and defaults TTL', () => {
  const h = buildPushHeaders({ jwt: 'j', vapidPublicKey: 'k', ttl: undefined });
  assert.equal(h.TTL, '0');
  assert.ok(!('Urgency' in h));
  assert.ok(!('Topic' in h));
});

// ── sendPush (fetch 주입) ─────────────────────────────────────────────────────

async function sendPushFixture(status) {
  const { rawPub, auth } = await makeSubscriberKeys();
  const { privateKeyB64, publicKeyB64 } = await makeVapidTestKeys();
  const priv = await importVapidPrivateKey({
    privateKey: privateKeyB64,
    publicKey: publicKeyB64,
  });

  let captured = null;
  const fetchImpl = async (url, opts) => {
    captured = { url, opts };
    return { status };
  };

  const result = await sendPush({
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p256dh: bytesToBase64url(rawPub),
      auth: bytesToBase64url(auth),
    },
    payload: JSON.stringify({ title: 't', body: 'b', url: '/' }),
    vapid: { publicKey: publicKeyB64, privateKey: priv, subject: 'mailto:o@x.com' },
    ttl: 300,
    urgency: 'high',
    now: 1_700_000_000,
    fetchImpl,
  });
  return { result, captured };
}

test('sendPush posts encrypted body with correct headers on 201', async () => {
  const { result, captured } = await sendPushFixture(201);
  assert.equal(result.ok, true);
  assert.equal(result.gone, false);
  assert.equal(result.status, 201);

  assert.equal(captured.url, 'https://fcm.googleapis.com/fcm/send/abc');
  assert.equal(captured.opts.method, 'POST');
  assert.equal(captured.opts.headers['Content-Encoding'], 'aes128gcm');
  assert.ok(captured.opts.headers.Authorization.startsWith('vapid t='));
  assert.ok(captured.opts.body instanceof Uint8Array);
  assert.ok(captured.opts.body.length > 86, 'body has header + ciphertext');
});

test('sendPush flags 410 Gone for subscription deletion', async () => {
  const { result } = await sendPushFixture(410);
  assert.equal(result.gone, true);
  assert.equal(result.ok, false);
});

test('sendPush flags 404 as gone', async () => {
  const { result } = await sendPushFixture(404);
  assert.equal(result.gone, true);
});

test('sendPush does not flag 429/500 as gone', async () => {
  const a = await sendPushFixture(429);
  const b = await sendPushFixture(500);
  assert.equal(a.result.gone, false);
  assert.equal(a.result.ok, false);
  assert.equal(b.result.gone, false);
});

test('sendPush rejects oversized payload (fail-closed)', async () => {
  const { rawPub, auth } = await makeSubscriberKeys();
  const { privateKeyB64, publicKeyB64 } = await makeVapidTestKeys();
  const priv = await importVapidPrivateKey({
    privateKey: privateKeyB64,
    publicKey: publicKeyB64,
  });
  await assert.rejects(() =>
    sendPush({
      subscription: {
        endpoint: 'https://example.com/p',
        p256dh: bytesToBase64url(rawPub),
        auth: bytesToBase64url(auth),
      },
      payload: new Uint8Array(4000),
      vapid: { publicKey: publicKeyB64, privateKey: priv, subject: 'mailto:o@x.com' },
      fetchImpl: async () => ({ status: 201 }),
    }),
  );
});
