# 데이터 연동 검토

검토일: 2026-05-30 KST

## 결론

MVP 다음 단계의 기본 전략은 공식 KBO 페이지를 1차 출처로 사용하고, 서버 사이드 수집 작업이 JSON을 생성해 현재 정적 프런트엔드가 그대로 소비하게 만드는 방식이 가장 현실적이다. 클라이언트에서 KBO 페이지를 직접 fetch하지 않고, 별도 수집 스크립트가 `data/*.json`을 갱신하는 구조를 권장한다.

## 후보 출처 비교

| 출처 | 적합 데이터 | 장점 | 리스크 | 권장 용도 |
| --- | --- | --- | --- | --- |
| KBO 공식 영문/국문 사이트 | 일정, 결과, 팀 순위, 팀 기록, 선수 기록 | 공식 출처이고 현재 페이지에서 표 데이터가 노출됨 | 공개 API가 아니라 HTML 구조 변경에 취약 | 1차 기준 데이터 |
| 한화이글스 공식 사이트 | 한화 홈 경기 일정, 구단 소식, 선수단/팬 콘텐츠 | 구단 맥락과 팬용 콘텐츠가 좋음 | 기록 상세는 KBO가 더 체계적 | 보조 출처, 구단 소식 |
| MyKBO Stats | 영문 선수/로스터/일정 요약, ICS | 팬 서비스에 유용한 정리 데이터 | 비공식 출처 | 백업/교차 검증 |

## 확인한 공식 데이터 지점

- KBO 팀 순위: `https://eng.koreabaseball.com/Standings/TeamStandings.aspx`
- KBO 영문 일별 일정: `https://eng.koreabaseball.com/Schedule/DailySchedule.aspx`
- KBO 국문 월별 일정: `https://www.koreabaseball.com/Schedule/Schedule.aspx` (`/ws/Schedule.asmx/GetScheduleList` form POST)
- KBO 팀 타자 기록: `https://www.koreabaseball.com/Record/Team/Hitter/Basic1.aspx`
- KBO 선수 타자 기록: `https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx`
- KBO 선수 투수 기록: `https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx`
- 한화이글스 공식 사이트: `https://www.hanwhaeagles.co.kr/index.do`
- MyKBO Stats 한화 페이지: `https://mykbostats.com/teams/4/2026`

## 권장 데이터 파이프라인

1. 수집 스크립트가 KBO/한화 페이지 HTML을 요청한다.
2. DOM 파서로 필요한 표와 일정 카드만 읽는다.
3. 앱에서 쓰는 형태로 정규화한다.
4. `data/summary.json`, `data/games.json`, `data/players.json`, `data/meta.json`을 원자적으로 갱신한다.
5. 갱신 시각, 출처 URL, 수집 성공/실패 상태를 `data/meta.json`에 남긴다.

## 갱신 주기

- 경기일 낮 시간: 30분마다 갱신
- 경기 시작 1시간 전부터 경기 종료 예상 후 30분까지: 5분마다 갱신
- 비경기일: 하루 1회 갱신
- 실패 시: 마지막 성공 JSON을 유지하고 `meta.json`에 오류만 기록

## 캐싱 전략

- 프런트엔드는 항상 로컬 `data/*.json`만 읽는다.
- 수집 스크립트는 `data/cache/raw/`에 원본 HTML 스냅샷을 저장한다.
- 정규화 JSON은 사람이 리뷰하기 쉬운 pretty JSON으로 유지한다.
- 배포 환경에서는 `data/*.json`에 짧은 캐시 TTL을 적용하고, 이미지/CSS/JS는 긴 캐시를 적용한다.

## 구현 후보

- 단기: Node.js + `fetch` + `cheerio` 수집 스크립트
- 대안: Python + `requests` + `BeautifulSoup`
- 브라우저 렌더링이 필요한 페이지가 생길 경우: Playwright 기반 수집 작업

## 구현 상태

- `scripts/update-data.mjs`를 추가했다.
- KBO 팀 순위와 팀 기록에서 `summary.json`을 자동 생성한다.
- KBO 국문 월별 일정 API에서 현재 달과 다음 달 한화 경기만 추출해 `games.json`과 `live-game.json`을 자동 생성한다.
- KBO 스코어보드에서 오늘 한화 경기 결과와 1~9회 라인스코어를 추출해 `live-game.json`에 반영한다.
- KBO 선수 타자/투수 기록에서 한화 주요 선수만 추출해 `players.json`과 `player-rankings.json`을 자동 생성한다.
- 수집 원본 HTML/JSON은 `data/cache/raw/`에 저장하고 `.gitignore`로 제외한다.

## 다음 구현 단계

1. 경기 중 실시간 상태 텍스트가 필요하면 문자중계/GameCenter 출처를 추가한다.
2. 수집 실패 시 기존 JSON을 보존하는 테스트를 추가한다.
3. 자동 갱신 후 PWA 캐시 갱신 알림 UX를 추가한다.
