# 민섭이가 쓰려고 만든 한화이글스 앱

민섭이가 한화이글스 경기 일정, 선수 기록, 팀 요약, 티켓팅 시간, 개인 메모를 빠르게 보려고 만든 정적 웹앱입니다.

## 실행

JSON 데이터를 fetch하므로 로컬 서버로 실행합니다.

```bash
python3 -m http.server 4173
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:4173/index.html
```

또는 npm 스크립트를 사용할 수 있습니다.

```bash
npm run serve
```

## 앱 설치

이 프로젝트는 PWA로 설정되어 있습니다. 지원 브라우저에서 실행하면 홈 화면 또는 데스크톱 앱으로 설치할 수 있습니다.

- `manifest.webmanifest`: 앱 이름, 아이콘, 시작 URL
- `service-worker.js`: 앱 셸과 JSON 데이터 캐시
- `offline.html`: 오프라인 fallback 화면
- 상단 탭 메뉴: 실시간, 경기, 티켓팅, 랭킹, 선수, 메모 화면 전환
- 상단 `알림 켜기`: 경기/티켓 알림 권한 요청
- 경기 카드 `티켓 알림`: 홈팀 예매처 기준 티켓 알림 저장
- 티켓 카드에는 예매 오픈 시각과 10분 전 알림 시각을 함께 표시합니다.
- 예정 경기 목록은 최대 10경기까지 노출합니다.
- 앱이 열려 있는 동안 5분마다 데이터 갱신 여부를 확인해 최신 경기/순위/티켓 정보를 자동 반영합니다.

현재 티켓 알림은 브라우저/PWA가 열려 있을 때 30초 간격으로 저장된 알림 시간을 확인합니다. 앱이 완전히 종료된 상태의 백그라운드 푸시는 추후 서버 푸시 연동이 필요합니다.

## 데이터

정적 데이터는 `data/` 폴더에 분리되어 있습니다.

- `data/meta.json`: 데이터 기준일, 안내문, 출처
- `data/summary.json`: 팀 요약
- `data/team-standings.json`: KBO 전체 팀 순위
- `data/live-game.json`: 메인 실시간 경기판
- `data/player-rankings.json`: 메인 선수 랭킹
- `data/games.json`: 경기 일정/결과
- `data/players.json`: 선수 기록
- `data/posts.json`: 초기 개인 메모

등록한 메모는 `localStorage`(`eaglesNotes`)에 저장되어 새로고침해도 유지됩니다. 각 메모의 `삭제` 버튼으로 지울 수 있습니다.

실제 데이터 연동 검토 내용은 `docs/DATA_INTEGRATION.md`에 정리되어 있습니다.

## 데이터 갱신

KBO 공식 페이지에서 팀 순위, 경기 일정, 선수 기록을 가져와 `data/*.json`을 갱신합니다.

```bash
npm run update:data
```

수집 원본 HTML/JSON은 `data/cache/raw/`에 저장되며 버전 관리에서는 제외됩니다. 경기 일정은 KBO 공식 일정 API에서 현재 달과 다음 달을 함께 가져와 월말에도 예정 경기 10개를 유지합니다.

## 자동 갱신과 배포 (GitHub)

GitHub에 올리면 사람이 손대지 않아도 데이터가 자동으로 갱신·배포됩니다.

- `.github/workflows/update-data.yml`: 매일 KST 08:00 / 18:00 / 23:30 / 00:30에 `update-data.mjs`를 실행하고, 실제 경기·순위·선수 데이터가 바뀐 경우에만 `data/`를 자동 커밋·push합니다(수동 실행도 가능).
- `.github/workflows/deploy-pages.yml`: push가 들어오면 GitHub Pages로 사이트를 다시 배포합니다. 즉 데이터 자동 커밋 → 자동 재배포로 이어집니다.

처음 한 번은 직접 설정해야 합니다.

1. 원격 저장소를 만들고 `git push`합니다.
2. GitHub → Settings → Pages → Source를 **GitHub Actions**로 설정합니다.
3. Settings → Actions → General → Workflow permissions를 **Read and write**로 둡니다.

참고: 앱이 완전히 종료된 상태의 백그라운드 푸시는 아직 서버 푸시 연동이 필요합니다. 설치형 PWA/Chromium 계열에서 지원되는 경우에는 Periodic Background Sync로 데이터 캐시 갱신을 best-effort로 시도합니다.
