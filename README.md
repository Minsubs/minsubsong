# KBO Ticket Helper Workspace

이 worktree는 `hanwha/` PWA를 중심으로 한 **KBO 티켓팅 도우미** 제품 작업 공간입니다.

현재 방향은 한화 단일 팬앱이 아니라, 10구단 예매 오픈 일정과 알림 수요를 검증하고 이후 취소표 관심 경기 알림까지 확장할 수 있는 상업화 후보 제품입니다.

## 현재 우선순위

1. `ticketlink-macro/` 같은 자동예매/우회성 코드와 제품 코드를 분리한다.
2. 10구단 예매 캘린더와 티켓 알림이 실제로 쓰이는지 무료 PWA로 검증한다.
3. 취소표 관심 경기 알림은 자동예매/우회 없이, 공식 예매처가 허용하는 범위의 상태 확인 또는 제휴 데이터가 확보될 때 Phase 3로 진행한다.
4. 알림 저장률, 예매처 클릭률, 구단 필터 사용량을 보고 네이티브 알림/제휴/스토어 배포 여부를 결정한다.

## 앱 위치

- 앱 루트: `hanwha/`
- 주요 문서:
  - `hanwha/README.md`
  - `hanwha/PROGRESS.md`
  - `hanwha/HANDOFF.md`
  - `hanwha/docs/DATA_INTEGRATION.md`
  - `hanwha/docs/APPSTORE_DEPLOY.md`
