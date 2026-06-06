# 데이터 연동 전략

검토 기준: 2026-06-06 KST

## 목적

KBO 티켓팅 도우미는 10구단 경기 일정, 홈팀 기준 예매처, 예매 오픈 시각, 티켓 알림 저장 여부를 안정적으로 제공해야 한다. 이후 취소표 관심 경기 알림을 확장하려면 예매처가 허용하는 상태 데이터 또는 제휴 데이터가 필요하다. 현재 앱은 서버 없이 정적 JSON을 읽는 PWA이므로, 수집 스크립트가 공식 데이터를 정규화해 `data/*.json`으로 배포하는 구조를 유지한다.

## 데이터 출처

| 출처 | 사용 데이터 | 현재 용도 | 리스크 |
| --- | --- | --- | --- |
| KBO 국문 일정 | 월별 경기 일정 | `games.json`, `ticketing-calendar.json` | 공개 API가 아니라 응답 형식 변경 가능 |
| KBO 팀 순위/기록 | 순위, 팀 요약 | `summary.json`, `team-standings.json` | HTML 구조 변경 가능 |
| KBO 선수 기록 | 주요 선수 기록 | `players.json`, `player-rankings.json` | HTML 구조 변경 가능 |
| 홈팀 예매처 매핑 | 예매처 URL, 오픈 규칙 | `ticketing` metadata | 구단별 정책 변경 가능 |
| 예매처 상태 데이터 | 잔여석/취소표 상태, 지원 가능 여부 | Phase 3 후보 | 약관/트래픽 정책/로그인/제휴 조건 확인 필요 |

## 현재 파이프라인

1. `scripts/update-data.mjs`가 KBO 데이터와 일정 API를 호출한다.
2. 한화 중심 경기 데이터는 `data/games.json`, `data/live-game.json`에 쓴다.
3. 10구단 캘린더는 `KBO_TEAM_IDS` 전체를 월별로 호출한다.
4. 중복 경기는 `date|time|away|home` 기준으로 병합한다.
5. `buildTicketCalendar()`가 예정 경기만 남기고 홈팀 기준 `ticketing` metadata를 붙인다.
6. public JSON에서는 내부 원본 필드(`rawTime`, `rawScore`)를 제거한다.
7. 수집 원본은 `data/cache/raw/`에 저장하며 버전 관리에서는 제외한다.

## 생성 파일

- `data/meta.json`
- `data/summary.json`
- `data/team-standings.json`
- `data/live-game.json`
- `data/player-rankings.json`
- `data/games.json`
- `data/ticketing-calendar.json`
- `data/players.json`

## 갱신 명령

```bash
npm run update:data
```

## 검증

```bash
npm run check
```

중요 회귀 조건:

- `KBO_TEAM_IDS`가 10개 팀 코드와 일치한다.
- 10구단 캘린더 수집에서 빈 `teamId`를 보내지 않는다.
- `ticketing-calendar.json`은 예정 경기만 포함한다.
- `ticketing-calendar.json`은 `rawTime`, `rawScore`를 노출하지 않는다.
- 예매 캘린더는 오픈 시각순으로 정렬된다.
- 서비스워커가 `data/ticketing-calendar.json?v=18`을 캐시 목록에 포함한다.

## 운영 리스크

- KBO 일정 endpoint는 공식 문서화된 public API가 아니다.
- 호출 수는 현재 월 2개 x 팀 10개로 늘어났으므로, 실패 시 graceful skip과 기존 스냅샷 보존이 중요하다.
- 예매 오픈 규칙은 홈팀 정책 변경 가능성이 있으므로 `openCaution` 문구와 수동 점검 루틴이 필요하다.
- 취소표 관심 경기 알림은 무단 스크래핑이나 안티봇 우회 없이 구현 가능할 때만 지원한다.
- 예매처별 상태 조회 빈도 제한, 실패 시 backoff, 중복 알림 방지 정책이 필요하다.

## 다음 개선 후보

1. 예매처/오픈 규칙의 최신성 점검 체크리스트 추가
2. 취소표 관심 경기 알림의 예매처별 허용 범위와 데이터 접근 방식 조사
3. 수집 실패 섹션별 기존 JSON 보존 테스트 강화
4. 수요 검증 신호를 서버로 보낼지 여부 결정 전 개인정보 영향 검토
