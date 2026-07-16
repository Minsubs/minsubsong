import assert from "node:assert/strict";
import { test } from "node:test";

import {
  auditProviderUrls,
  classifyHttpStatus,
  validateTicketProviders,
} from "../scripts/audit-ticket-providers.mjs";
import {
  TICKET_PROVIDERS,
  TICKET_PROVIDER_TEAMS,
} from "../scripts/ticket-provider-config.mjs";

const NOW = new Date("2026-07-16T12:00:00Z"); // 설정의 최신 verifiedAt(2026-07-16) 이후로 유지할 것

function cloneProviders() {
  return structuredClone(TICKET_PROVIDERS);
}

test("ticket provider schema: 10구단 단일 설정이 유효하고 미검증 규칙은 경고", () => {
  const result = validateTicketProviders(TICKET_PROVIDERS, { now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.teamCount, 10);
  assert.deepEqual(Object.keys(TICKET_PROVIDERS), TICKET_PROVIDER_TEAMS);
  assert.ok(result.warnings.some((warning) => warning.includes("NC.verification.openRule")));
});

test("ticket provider strict audit: 공식 근거 미검증은 실패", () => {
  const result = validateTicketProviders(TICKET_PROVIDERS, { now: NOW, strict: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("NC.verification.openRule")));
});

test("ticket provider schema: 구단 누락과 잘못된 시각을 거부", () => {
  const providers = cloneProviders();
  delete providers.SSG;
  providers.KT.openTime = "24:61";
  const result = validateTicketProviders(providers, { now: NOW });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("SSG: 예매 설정 누락"));
  assert.ok(result.errors.some((error) => error.includes("KT.openTime")));
});

test("ticket provider strict audit: 92일을 넘긴 근거는 실패", () => {
  const providers = cloneProviders();
  for (const team of TICKET_PROVIDER_TEAMS) {
    for (const key of ["provider", "openRule"]) {
      providers[team].verification[key] = {
        status: "verified",
        verifiedAt: "2026-01-01",
        sourceUrl: "https://example.com/source",
        note: "fixture",
      };
    }
  }
  const result = validateTicketProviders(providers, { now: NOW, strict: true });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("경과")));
});

test("network audit: 중복 URL을 한 번만 요청하고 redirect 최종 URL을 기록", async () => {
  const providers = {
    A: {
      url: "https://example.com/ticket",
      verification: {
        provider: { sourceUrl: "https://example.com/ticket" },
        openRule: { sourceUrl: "https://example.com/rule" },
      },
    },
  };
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { status: 200, url: `${url}/final` };
  };
  const result = await auditProviderUrls(providers, { fetchImpl, timeoutMs: 50 });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(result.results[0].finalUrl, `${result.results[0].url}/final`);
});

test("network audit: 접근 차단은 경고, 404와 네트워크 오류는 실패", async () => {
  const providers = {
    A: {
      url: "https://example.com/blocked",
      verification: {
        provider: { sourceUrl: "https://example.com/missing" },
        openRule: { sourceUrl: "https://example.com/error" },
      },
    },
  };
  const fetchImpl = async (url) => {
    if (url.endsWith("blocked")) return { status: 403, url };
    if (url.endsWith("missing")) return { status: 404, url };
    throw new Error("dns failure");
  };
  const result = await auditProviderUrls(providers, { fetchImpl, timeoutMs: 50 });

  assert.equal(result.ok, false);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.failures.length, 2);
  assert.equal(classifyHttpStatus(429), "warning");
  assert.equal(classifyHttpStatus(500), "failure");
});

test("network audit: TLS 중간 인증서 누락은 실패가 아니라 수동 확인 경고", async () => {
  const providers = {
    A: {
      url: "https://example.com/incomplete-chain",
      verification: {},
    },
  };
  const fetchImpl = async () => {
    const error = new Error("fetch failed");
    error.cause = { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" };
    throw error;
  };
  const result = await auditProviderUrls(providers, { fetchImpl, timeoutMs: 50 });

  assert.equal(result.ok, true); // 실패 아님 — 경고만
  assert.equal(result.failures.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0].detail, /TLS 체인 불완전/);
});
