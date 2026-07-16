#!/usr/bin/env bash
# X0 배포 게이트 프로비저닝 — `npx wrangler login` 후 1회 실행.
#
#   cd hanwha/worker && bash scripts/provision.sh
#
# 하는 일(멱등 — 재실행 안전):
#   1. D1 database 생성(있으면 재사용) → wrangler.toml database_id 패치
#   2. VAPID P-256 키쌍 생성 → 공개키만 wrangler.toml 패치
#   3. wrangler deploy (VAPID_PRIVATE 미주입 상태에서도 loadVapid 게이트가 발송을 막음)
#   4. 개인키를 wrangler secret put VAPID_PRIVATE 로 주입 — 디스크에 쓰지 않음
#   5. D1 스키마 적용(--remote, CREATE TABLE IF NOT EXISTS 라 멱등)
#   6. 다음 수작업(클라이언트 언락 + 실기기 검증) 안내 출력
#
# 개인키 취급: 셸 변수 → wrangler secret 파이프로만 전달. 파일/리포/로그 금지.
set -euo pipefail
cd "$(dirname "$0")/.." # worker/

TOML="wrangler.toml"
DB_NAME="kbo-tido"
DB_PLACEHOLDER="REPLACE_WITH_D1_DATABASE_ID"
VAPID_PLACEHOLDER="REPLACE_WITH_VAPID_PUBLIC_KEY_PLACEHOLDER"

step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }

# ── 0) 인증 게이트 ───────────────────────────────────────────────────────────
step "0/5 wrangler 인증 확인"
if npx wrangler whoami 2>&1 | grep -qi "not authenticated"; then
  echo "❌ wrangler 미인증. 먼저 실행: npx wrangler login" >&2
  exit 1
fi
npx wrangler whoami 2>&1 | grep -i "associated with" || true

# ── 1) D1 생성/연결 ──────────────────────────────────────────────────────────
step "1/5 D1 database ($DB_NAME)"
if grep -q "$DB_PLACEHOLDER" "$TOML"; then
  # 이미 존재하면 create 는 실패하므로 무시하고 list 로 id 조회.
  # (d1 info <name> 은 wrangler 4.x 에서 wrangler.toml 의 database_id — 아직
  #  플레이스홀더 — 를 우선 해석해 7404 가 난다. list 는 config 를 안 본다.)
  npx wrangler d1 create "$DB_NAME" 2>/dev/null || true
  DB_ID="$(npx wrangler d1 list --json | DB_NAME="$DB_NAME" node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d));
    process.stdin.on("end", () => {
      try {
        const rows = JSON.parse(s);
        const row = (Array.isArray(rows) ? rows : []).find(
          (r) => r && (r.name === process.env.DB_NAME || r.database_name === process.env.DB_NAME),
        );
        process.stdout.write(row?.uuid || row?.id || row?.database_id || "");
      } catch { /* empty -> caller fails */ }
    });
  ')" || true
  if [ -z "$DB_ID" ]; then
    echo "❌ D1 database_id 조회 실패 — 'npx wrangler d1 info $DB_NAME --json' 출력을 확인하세요." >&2
    exit 1
  fi
  perl -pi -e "s/\Q$DB_PLACEHOLDER\E/$DB_ID/" "$TOML"
  echo "✅ database_id 패치: $DB_ID"
else
  echo "이미 연결됨 — 스킵: $(grep '^database_id' "$TOML")"
fi

# ── 2) VAPID 키쌍 ────────────────────────────────────────────────────────────
step "2/5 VAPID 키쌍"
VAPID_PRIVATE=""
VAPID_COMMITTED=0
if grep -q "$VAPID_PLACEHOLDER" "$TOML"; then
  # P-256 ECDSA. 공개키 = raw 65바이트(base64url), 개인키 = JWK d 스칼라(base64url).
  KEYS="$(node --input-type=module -e '
    const { webcrypto: wc } = await import("node:crypto");
    const kp = await wc.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = Buffer.from(await wc.subtle.exportKey("raw", kp.publicKey));
    const jwk = await wc.subtle.exportKey("jwk", kp.privateKey);
    process.stdout.write(raw.toString("base64url") + " " + jwk.d);
  ')"
  VAPID_PUBLIC="${KEYS%% *}"
  VAPID_PRIVATE="${KEYS##* }"
  perl -pi -e "s/\Q$VAPID_PLACEHOLDER\E/$VAPID_PUBLIC/" "$TOML"
  # 개인키 주입 전 중단되면 고아 공개키 → 재실행 차단. 미완료 종료 시 플레이스홀더 복원.
  trap 'if [ "$VAPID_COMMITTED" != 1 ]; then perl -pi -e "s/\Q$VAPID_PUBLIC\E/$VAPID_PLACEHOLDER/" "$TOML"; echo "↩️ 롤백: VAPID_PUBLIC 플레이스홀더 복원(개인키 미주입)" >&2; fi' EXIT
  echo "✅ 공개키 패치(wrangler.toml VAPID_PUBLIC): $VAPID_PUBLIC"
else
  VAPID_PUBLIC="$(grep '^VAPID_PUBLIC' "$TOML" | cut -d'"' -f2)"
  echo "이미 설정됨 — 키 생성 스킵 (공개키: $VAPID_PUBLIC)"
  echo "  ⚠️ 키쌍 재생성(로테이션)이 필요하면 VAPID_PUBLIC 을 플레이스홀더로 되돌리고 재실행."
fi

# ── 3) 배포 ──────────────────────────────────────────────────────────────────
step "3/5 wrangler deploy"
DEPLOY_OUT="$(npx wrangler deploy 2>&1)" || { echo "$DEPLOY_OUT" >&2; exit 1; }
echo "$DEPLOY_OUT"
WORKER_URL="$(printf '%s' "$DEPLOY_OUT" | grep -oE 'https://[A-Za-z0-9.-]*workers\.dev' | head -1 || true)"

# ── 4) 개인키 secret 주입 ────────────────────────────────────────────────────
step "4/5 VAPID_PRIVATE secret"
if [ -n "$VAPID_PRIVATE" ]; then
  printf '%s' "$VAPID_PRIVATE" | npx wrangler secret put VAPID_PRIVATE
  echo "✅ 개인키 주입 완료(디스크 기록 없음)"
elif SECRET_LIST="$(npx wrangler secret list 2>&1)"; then
  if printf '%s' "$SECRET_LIST" | grep -q "VAPID_PRIVATE"; then
    echo "이미 주입됨 — 스킵"
  else
    echo "⚠️ VAPID_PUBLIC 은 설정돼 있으나 VAPID_PRIVATE secret 이 없습니다." >&2
    echo "   공개/개인키는 쌍이어야 합니다 — VAPID_PUBLIC 을 플레이스홀더로 되돌리고 재실행하세요." >&2
    exit 1
  fi
else
  echo "❌ 'wrangler secret list' 실패(일시 오류 가능) — 키 상태 확인 불가:" >&2
  echo "$SECRET_LIST" >&2
  echo "   재시도하세요(키 로테이션 아님)." >&2
  exit 1
fi

VAPID_COMMITTED=1
trap - EXIT

# ── 5) D1 스키마 적용 ────────────────────────────────────────────────────────
step "5/5 D1 스키마 적용(--remote)"
npx wrangler d1 execute "$DB_NAME" --file=schema.sql --remote --yes
echo "✅ 스키마 적용 완료"

# ── 다음 단계 안내 ───────────────────────────────────────────────────────────
step "완료 — 남은 수작업(클라이언트 언락)"
cat <<EOF
Worker URL: ${WORKER_URL:-"(deploy 출력에서 workers.dev URL 확인)"}

다음 단계 (script.js 게이트 해제 + 실기기 검증):
 1. hanwha/script.js 의 상수 교체
      const VAPID_PUBLIC_KEY = "$VAPID_PUBLIC";
      const PUSH_API_BASE   = "${WORKER_URL:-<worker-url>}";
 2. 캐시 트리아드 bump (index.html ?v= / service-worker.js CACHE / 테스트 핀)
 3. npm run check + worker npm test 회귀 확인 후 커밋/배포
 4. 실기기 검증: 데스크톱 Chrome + iOS 설치 PWA 에서 앱 닫고 테스트 푸시 수신
 5. D8(법률/처리방침) 검토 전에는 실사용자 대상 발송 활성화 금지
EOF
