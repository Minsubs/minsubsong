# KBO 티켓팅 도우미 Handoff

작성 시각: 2026-06-10 KST (최초 2026-06-06)

## 시작 위치

- repo: `/Users/minsub/Documents/한화`
- 앱 루트: `/Users/minsub/Documents/한화/hanwha`
- 기준 브랜치: `main`
- 최신 원격 반영 기준: `origin/main`

새 세션에서는 아래 순서로 시작한다.

```bash
cd /Users/minsub/Documents/한화
git status --short --branch
sed -n '1,220p' hanwha/HANDOFF.md
sed -n '1,220p' hanwha/PROGRESS.md
```

## 현재 제품 방향

한화 단일 개인 앱이 아니라 **KBO 10구단 티켓팅 도우미**로 전환했다.

현재 구현 범위는 무료 PWA 기반 수요 검증이다.

- 10구단 예매 오픈 캘린더
- 홈팀 기준 공식 예매처 링크
- 앱이 열려 있을 때의 티켓 알림 저장
- `검증` 탭의 localStorage 기반 수요 신호 집계

취소표 기능은 구현된 기능이 아니라 **Phase 3 후보**다. 표현은 “취소표 자동 감지”가 아니라 “취소표 관심 경기 알림”으로 제한한다.

## 안전 원칙

- 허용: 예매처 연결, 오픈 일정 정리, 알림 저장, 허용된 방식의 관심 경기 상태 알림
- 금지: 자동예매, 대기열/안티봇 우회, CAPTCHA 우회, 무단 스크래핑 기반 취소표 감시, 계정 로그인 대행
- 개인정보: 현재 수요 검증 신호는 브라우저 `localStorage.eaglesDemandSignals`에만 저장한다.
- 휴먼게이트: git history rewrite, force push, 계정/비밀번호 작업은 사용자 승인 또는 사용자 직접 조치가 필요하다.

## 완료된 일

- `ticketlink-macro/`를 제품 repo에서 분리하고 tracked deletion을 `main`에 반영했다.
- `ticketlink-macro` 보존 위치: `/Users/minsub/Documents/한화/_separated/ticketlink-macro-20260606-203301`
- `KBO_TEAM_IDS` 10개 팀 기반으로 예매 캘린더 생성 파이프라인을 확장했다.
- `data/ticketing-calendar.json`은 예정 경기 데이터를 포함한다. 이 수치는 `chore(hanwha): refresh KBO snapshot` 커밋마다 갱신되는 스냅샷이라 시점에 따라 달라진다 (2026-06-10 확인 기준 200경기, 모두 예정 경기, 홈팀 10개 전구단).
- 앱에 `예매 캘린더` 탭을 추가했다.
- 캘린더 필터는 홈/원정 양쪽 구단을 매칭한다.
- 캘린더 경기의 10분 전 티켓 알림 저장을 지원한다.
- `검증` 탭을 추가하고 로컬 수요 신호를 집계한다.
- README, PROGRESS, 데이터 연동 문서, 앱 배포 문서를 상업화 후보 제품 기준으로 업데이트했다.
- 취소표 관심 경기 알림을 Phase 3 후보로 문서화했다.

### 2026-06-10 — v20 리디자인 + 10구단 전환 (미커밋, 작업트리에만 존재)

- 전면 리디자인: 다크 "Night Game"(라임 `#c8ff45`/시안) · 라이트 "Daylight"(블루 `#2f6bff`). 토큰 교체 + 레거시 별칭 리매핑, styles.css 끝 v20/v21 마감 레이어.
- IA 7탭→5탭(home/tickets/schedule/standings/more) + 모바일 바텀탭(≤919px). 라우팅은 기존 `data-view-panel` 그룹핑 재사용.
- "내 구단"(`selectedTeam`, localStorage) 개인화: 요약보드(standings 파생: 순위/승-패/승률/흐름)·라이브 패널(대표 경기 폴백)·일정 필터·순위 강조(`is-myteam`)·캘린더 초기 필터.
- 팀 엠블럼 스쿼클 + 한글 풀네임. 브랜드 마크 "K" 제거(텍스트 브랜드만). 한화샵 쇼핑 링크 제거(10구단 중립화).
- 데이터 파이프라인(`scripts/update-data.mjs`): 한화 필터 제거 → 리그 리더(타율/홈런/ERA, 전구단 실데이터) + 리그 주요 선수 8인 + games.json 10팀(최근 7일/향후 14일) + live-game.json 오늘의 KBO 전 경기 배열(`buildLiveGames`, UI 는 selectedTeam 경기 선택 + 레거시 단일 객체 방어).
- PWA: CACHE `eagles-lounge-v22`, 자산 `?v=20`, 데이터 `?v=19`, theme-color/manifest 신 팔레트.
- 테스트: 신규/갱신 포함 30개. 상세 검증 증거는 PROGRESS.md "Phase 4" 절.

## 검증 상태

최신 확인 명령:

```bash
cd /Users/minsub/Documents/한화/hanwha
npm run check
```

결과:

```text
30/30 pass
```

브라우저 실검증(2026-06-10): 모바일 390/데스크톱 1280 × 다크/라이트, 내 구단 한화↔LG↔두산 전환 시 홈 요약·라이브·일정·순위 강조가 함께 바뀜, 콘솔 에러 없음.

## 남은 작업

1. 과거 macro 커밋 히스토리 rewrite/force push 여부를 사용자 승인하에 결정한다.
2. 노출 가능성이 있는 계정 비밀번호는 사용자가 직접 교체한다.
3. 수요 검증 운영 루틴을 정의한다.
4. 취소표 관심 경기 알림의 예매처별 허용 범위와 데이터 접근 방식을 조사한다.
5. 지표가 쌓이면 취소표 관심 경기 알림, 네이티브 알림, 제휴 링크 실험으로 확장한다.

(v20 리디자인 + 10구단 전환은 2026-06-10 main 머지 완료 — 커밋/PR 이력 참조.)

## 주의할 로컬 상태

아래 경로는 작업용/보존용 untracked 상태로 남아 있을 수 있다. 사용자 승인 없이 삭제하거나 커밋하지 않는다.

- `/Users/minsub/Documents/한화/.claude/`
- `/Users/minsub/Documents/한화/.omo/`
- `/Users/minsub/Documents/한화/_separated/`
- `/Users/minsub/Documents/한화/data/`

## 다음 세션 추천 첫 작업

사용자가 별도 지시하지 않으면 `수요 검증 운영 루틴 정의`부터 진행한다.

취소표 관심 경기 알림을 먼저 진행하라고 하면, 구현부터 하지 말고 예매처별 허용 범위와 데이터 접근 방식 조사 문서를 먼저 만든다.
