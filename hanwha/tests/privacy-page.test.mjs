import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readPrivacy = () => readFile(new URL("../privacy.html", import.meta.url), "utf8");
const readIndex = () => readFile(new URL("../index.html", import.meta.url), "utf8");
const readServiceWorker = () => readFile(new URL("../service-worker.js", import.meta.url), "utf8");

test("privacy.html 이 존재하고 정적 페이지 골격을 갖춘다", async () => {
  const privacy = await readPrivacy();

  // 독립 정적 페이지: 한국어 문서 + 처리방침 제목.
  assert.match(privacy, /<html lang="ko">/);
  assert.match(privacy, /<title>[^<]*개인정보처리방침/);

  // offline.html 미러: 홈으로 돌아가는 링크.
  assert.match(privacy, /href="\.\/index\.html"[^>]*>[\s\S]*?KBO TIDO로 돌아가기/);

  // 초안 상태 배너.
  assert.match(privacy, /초안 — 시행 전 확정 필요/);
});

test("privacy.html 이 §A 핵심 절을 담는다", async () => {
  const privacy = await readPrivacy();

  // 수집 최소화 원칙.
  assert.match(privacy, /수집하지 않는 것을 원칙/);
  // 보유 기간.
  assert.match(privacy, /보유 기간/);
  // 국외 이전(제3자·위탁).
  assert.match(privacy, /국외 이전/);
  assert.match(privacy, /Cloudflare/);
  // 문의처(보호책임자).
  assert.match(privacy, /개인정보 보호책임자 및 문의처/);
});

test("privacy.html 이 미확정 항목을 <mark> 로 눈에 띄게 유지한다", async () => {
  const privacy = await readPrivacy();

  assert.match(privacy, /<mark>\[운영자 표기 — 확정 필요\]<\/mark>/);
  assert.match(privacy, /<mark>\[이메일 주소 — 확정 필요\]<\/mark>/);
  assert.match(privacy, /<mark>\[시행일 — 확정 필요\]<\/mark>/);
});

test("privacy.html 표는 모바일 가로 스크롤 컨테이너로 감싼다", async () => {
  const privacy = await readPrivacy();

  assert.match(privacy, /class="table-scroll"/);
  assert.match(privacy, /overflow-x:\s*auto/);
});

test("index.html 더보기 뷰에 개인정보처리방침 링크가 있다", async () => {
  const index = await readIndex();

  // 더보기(more) 뷰 패널 안의 privacy.html 링크.
  assert.match(index, /href="\.\/privacy\.html"[^>]*>개인정보처리방침/);
  assert.match(index, /data-view-panel="more"[\s\S]*?\.\/privacy\.html/);
});

test("service-worker.js APP_SHELL 에 privacy.html 이 포함된다", async () => {
  const serviceWorker = await readServiceWorker();

  assert.match(serviceWorker, /APP_SHELL\s*=\s*\[[\s\S]*?"\.\/privacy\.html"[\s\S]*?\]/);
});

test("service-worker.js CACHE_NAME 은 v36 을 유지한다(bump 금지)", async () => {
  const serviceWorker = await readServiceWorker();

  assert.match(serviceWorker, /CACHE_NAME\s*=\s*"eagles-lounge-v36"/);
});
