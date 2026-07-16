import { pathToFileURL } from "node:url";

import {
  TICKET_AUDIT_MAX_AGE_DAYS,
  TICKET_PROVIDERS,
  TICKET_PROVIDER_TEAMS,
} from "./ticket-provider-config.mjs";

const EVIDENCE_KEYS = ["provider", "openRule"];
const VALID_EVIDENCE_STATUSES = new Set(["verified", "needs-review"]);

function validateTicketProviders(
  providers,
  {
    now = new Date(),
    strict = false,
    maxAgeDays = TICKET_AUDIT_MAX_AGE_DAYS,
    expectedTeams = TICKET_PROVIDER_TEAMS,
  } = {},
) {
  const errors = [];
  const warnings = [];
  const expected = new Set(expectedTeams);
  const actual = new Set(Object.keys(providers ?? {}));

  for (const team of expected) {
    if (!actual.has(team)) errors.push(`${team}: 예매 설정 누락`);
  }
  for (const team of actual) {
    if (!expected.has(team)) errors.push(`${team}: 알 수 없는 구단 설정`);
  }

  for (const team of expectedTeams) {
    const provider = providers?.[team];
    if (!provider) continue;

    for (const key of ["provider", "url", "note", "openLabel", "openTime"]) {
      if (typeof provider[key] !== "string" || !provider[key].trim()) {
        errors.push(`${team}.${key}: 비어 있지 않은 문자열이어야 함`);
      }
    }
    if (!isHttpUrl(provider.url)) errors.push(`${team}.url: 유효한 http(s) URL이어야 함`);
    if (!Number.isInteger(provider.openDaysBefore) || provider.openDaysBefore < 0 || provider.openDaysBefore > 30) {
      errors.push(`${team}.openDaysBefore: 0~30 정수여야 함`);
    }
    if (!isValidTime(provider.openTime)) errors.push(`${team}.openTime: HH:MM 형식의 유효한 시각이어야 함`);

    for (const evidenceKey of EVIDENCE_KEYS) {
      const item = provider.verification?.[evidenceKey];
      const label = `${team}.verification.${evidenceKey}`;
      if (!item || typeof item !== "object") {
        errors.push(`${label}: 근거 메타데이터 누락`);
        continue;
      }
      if (!VALID_EVIDENCE_STATUSES.has(item.status)) {
        errors.push(`${label}.status: verified 또는 needs-review 여야 함`);
        continue;
      }
      if (typeof item.note !== "string" || !item.note.trim()) errors.push(`${label}.note: 설명 누락`);
      if (item.sourceUrl != null && !isHttpUrl(item.sourceUrl)) errors.push(`${label}.sourceUrl: 유효한 URL이어야 함`);

      if (item.status === "needs-review") {
        const message = `${label}: 공식 근거 재검증 필요`;
        (strict ? errors : warnings).push(message);
        continue;
      }

      if (!isIsoDate(item.verifiedAt)) {
        errors.push(`${label}.verifiedAt: YYYY-MM-DD 날짜가 필요함`);
        continue;
      }
      if (!isHttpUrl(item.sourceUrl)) errors.push(`${label}.sourceUrl: verified 근거 URL이 필요함`);

      const ageDays = evidenceAgeDays(item.verifiedAt, now);
      if (!Number.isFinite(ageDays) || ageDays < 0) {
        errors.push(`${label}.verifiedAt: 미래이거나 해석할 수 없는 날짜`);
      } else if (ageDays > maxAgeDays) {
        const message = `${label}: ${ageDays}일 경과 (허용 ${maxAgeDays}일)`;
        (strict ? errors : warnings).push(message);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    teamCount: actual.size,
  };
}

function isValidTime(value) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})$/);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function evidenceAgeDays(value, now) {
  const verified = new Date(`${value}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - verified) / 86400000);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function providerAuditUrls(providers) {
  const urls = new Map();
  for (const [team, provider] of Object.entries(providers ?? {})) {
    if (isHttpUrl(provider.url)) addUrl(urls, provider.url, `${team}.url`);
    for (const evidenceKey of EVIDENCE_KEYS) {
      const sourceUrl = provider.verification?.[evidenceKey]?.sourceUrl;
      if (isHttpUrl(sourceUrl)) addUrl(urls, sourceUrl, `${team}.${evidenceKey}`);
    }
  }
  return [...urls].map(([url, labels]) => ({ url, labels: [...labels] }));
}

function addUrl(urls, url, label) {
  const labels = urls.get(url) ?? new Set();
  labels.add(label);
  urls.set(url, labels);
}

async function auditProviderUrls(
  providers,
  { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {},
) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch 구현이 필요합니다.");

  const results = await Promise.all(
    providerAuditUrls(providers).map(async ({ url, labels }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "user-agent": "eagles-lounge-ticket-audit/1.0" },
        });
        return {
          url,
          labels,
          status: response.status,
          finalUrl: response.url || url,
          outcome: classifyHttpStatus(response.status),
        };
      } catch (error) {
        // 서버가 TLS 중간 인증서를 누락하면 브라우저(AIA 체이싱)는 통과하지만
        // Node fetch 는 실패한다(예: doosanbears.com). URL 소멸과 구분되는
        // 서버 설정 문제라 수동 확인 경고로 분류한다 — TLS 검증 자체는 끄지 않는다.
        if ((error?.cause?.code ?? "") === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
          return {
            url,
            labels,
            status: null,
            finalUrl: null,
            outcome: "warning",
            detail: "TLS 체인 불완전(중간 인증서 누락) — 브라우저 수동 확인 필요",
          };
        }
        return {
          url,
          labels,
          status: null,
          finalUrl: null,
          outcome: "failure",
          detail: error?.name === "AbortError" ? `timeout ${timeoutMs}ms` : String(error?.message ?? error),
        };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return {
    ok: results.every((result) => result.outcome !== "failure"),
    results,
    failures: results.filter((result) => result.outcome === "failure"),
    warnings: results.filter((result) => result.outcome === "warning"),
  };
}

function classifyHttpStatus(status) {
  if (status >= 200 && status < 400) return "ok";
  // 공식 사이트의 봇 차단은 URL 소멸과 구분한다. 수동 검증을 요구하는 경고다.
  if ([401, 403, 429].includes(status)) return "warning";
  return "failure";
}

function printValidation(result, strict) {
  console.log(`ticket providers: ${result.teamCount}/${TICKET_PROVIDER_TEAMS.length} teams (${strict ? "strict" : "schema"})`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
}

function printNetwork(result) {
  for (const item of result.results) {
    const status = item.status ?? item.detail;
    const redirected = item.finalUrl && item.finalUrl !== item.url ? ` -> ${item.finalUrl}` : "";
    console.log(`${item.outcome.toUpperCase()} ${status} ${item.url}${redirected}`);
  }
}

async function main(args = process.argv.slice(2)) {
  const strict = args.includes("--strict");
  const network = args.includes("--network");
  const validation = validateTicketProviders(TICKET_PROVIDERS, { strict });
  printValidation(validation, strict);

  let networkResult = { ok: true };
  if (network) {
    networkResult = await auditProviderUrls(TICKET_PROVIDERS);
    printNetwork(networkResult);
  }

  if (!validation.ok || !networkResult.ok) process.exitCode = 1;
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  auditProviderUrls,
  classifyHttpStatus,
  evidenceAgeDays,
  isValidTime,
  providerAuditUrls,
  validateTicketProviders,
};
