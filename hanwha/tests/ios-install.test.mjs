import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readScript = () => readFile(new URL("../script.js", import.meta.url), "utf8");
const readIndex = () => readFile(new URL("../index.html", import.meta.url), "utf8");

test("iOS 설치 감지 로직이 순수 함수로 분리되어 있다", async () => {
  const script = await readScript();

  // navigator/window 에 직접 안 묶이고 인자로 판정하는 순수 함수.
  assert.match(script, /function isIosDevice\s*\(/);
  assert.match(script, /function isStandaloneDisplay\s*\(/);
  assert.match(script, /function isIosSafari\s*\(/);
  assert.match(script, /function shouldShowIosInstall\s*\(/);

  // standalone 판정은 display-mode 미디어쿼리 + navigator.standalone 둘 다 본다.
  assert.match(script, /display-mode:\s*standalone/);
  assert.match(script, /navigator\.standalone/);

  // iPadOS(데스크톱 UA 위장) 대응: maxTouchPoints 를 고려한다.
  assert.match(script, /maxTouchPoints/);

  // 비-Safari iOS(Chrome/Firefox/in-app) 는 홈화면 추가 경로가 달라 분기한다.
  assert.match(script, /CriOS/);
  assert.match(script, /FxiOS/);
});

test("iOS 설치 시트 열기/닫기 + 접근성 처리가 있다", async () => {
  const script = await readScript();

  assert.match(script, /function openIosInstallSheet\s*\(/);
  assert.match(script, /function closeIosInstallSheet\s*\(/);

  // Esc 로 닫기 + 포커스 트랩.
  assert.match(script, /"Escape"/);
  assert.match(script, /focus(?:Trap|able|\()/i);
});

test("배너 dismiss 상태를 localStorage 에 보존한다", async () => {
  const script = await readScript();

  assert.match(script, /eaglesIosInstallHintDismissed/);
});

test("index.html 에 접근성 갖춘 iOS 설치 시트가 있다", async () => {
  const index = await readIndex();

  // 다이얼로그 시멘틱.
  assert.match(index, /id="iosInstallSheet"[\s\S]*?role="dialog"/);
  assert.match(index, /aria-modal="true"/);

  // 3스텝 안내(공유 → 홈 화면에 추가 → 추가).
  assert.match(index, /data-step="1"/);
  assert.match(index, /data-step="2"/);
  assert.match(index, /data-step="3"/);
  assert.match(index, /홈 화면에 추가/);
  assert.match(index, /공유/);
});

test("index.html 에 홈 1회성 iOS 설치 배너가 있다", async () => {
  const index = await readIndex();

  assert.match(index, /id="iosInstallBanner"/);
  // 배너는 홈 패널 안에 위치.
  assert.match(index, /id="iosInstallBanner"[^>]*data-view-panel="home"/);
});

test("iOS 시트/배너는 외부 도메인을 fetch 하지 않는다(컴플라이언스)", async () => {
  const script = await readScript();

  // iOS 설치 안내는 정적 UI 일 뿐 예매처/외부 조회가 없어야 한다.
  assert.doesNotMatch(
    script,
    /fetch\([^)]*(itunes|apps\.apple|ticketlink|interpark|nolticket)/i,
  );
});
