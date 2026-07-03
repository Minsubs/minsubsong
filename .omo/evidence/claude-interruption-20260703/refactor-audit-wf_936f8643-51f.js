export const meta = {
  name: 'refactor-audit',
  description: '목표 대비 전면 감사 — 보완/변경/불필요 검토(읽기전용): 목표갭/JS데드코드/CSS데드코드/데이터파이프라인/문서драйфт → 적대검증 → 통합 리포트',
  phases: [
    { title: 'Audit', detail: '병렬 5: 목표갭 / JS / CSS / 데이터 / 문서' },
    { title: 'Verify', detail: '데드코드 주장 적대적 검증(grep 증명)' },
    { title: 'Synthesize', detail: '보완·변경·제거 통합 리포트' },
  ],
}
const REPO = '/Users/minsub/Documents/hanwha/hanwha'
const CTX = `KBO TIDO PWA. 앱 루트 REPO=${REPO} (index.html 223줄, script.js 2622줄, styles.css 4288줄, worker/, scripts/update-data.mjs, data/*.json, tests/). 목표 문서: ${REPO}/docs/ROADMAP.md(단일 소스), HANDOFF.md, PROGRESS.md, docs/BACKEND_PUSH_PLAN.md. **읽기 전용** — Read/Grep/Glob 만, 코드 수정 절대 금지. 최종 출력=구조화 데이터.

[현재 상태 컨텍스트 — 최근 대규모 변경]
- Broadcast Ticket 리디자인(듀얼테마 Night/Paper + 구단색 헤더/액센트, applyTeamAccent). 5화면 전면 재구성.
- 제거됨: 홈 브랜드 히어로/스냅샷/히어로 랭킹패널, 순위 탭의 "리그 기록 리더"(#rankingBoard), 더보기의 "리그 주요 선수"(#playerGrid)와 "수요 검증" 공개 UI(#validation — 신호 수집 trackDemandSignal 은 유지).
- 추가됨: 홈 티켓 히어로(#ticketOpenCard+다가오는오픈)·진행중 스코어보드(#liveScoreboard)·컴팩트 스트립(#liveGamePanel), 더보기 알림센터(#notifyCenter, PUSH_TOPICS_KEY 로컬), iOS 설치 시트/배너, SW push/pushsubscriptionchange + 클라 구독 셸(VAPID_PUBLIC_KEY/PUSH_API_BASE 빈값=inert), worker/ 백엔드(미배포).
- CSS 는 v17~v31 append-only 레이어 누적(4288줄) — 화면 재구성으로 옛 레이어 상당수가 고아 의심. #fff8ef 하드코딩 8건 잔존 보고됨(169,202,274,370,477,617,742,776행 부근).
- GitHub Pages 배포됨(v30). 크론이 data/*.json 하루 4회 갱신.`

const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['dimension', 'findings'],
  properties: {
    dimension: { type: 'string' },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['kind', 'what', 'evidence', 'recommendation', 'impact'],
      properties: {
        kind: { type: 'string', enum: ['보완', '변경', '제거'] },
        what: { type: 'string' },
        evidence: { type: 'string' },
        recommendation: { type: 'string' },
        impact: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    } },
  },
}

phase('Audit')
const [goals, js, css, pipeline, docs] = await parallel([
  () => agent(`${CTX}\n\n[감사 1: 목표 대비 갭] docs/ROADMAP.md 전체(특히 §1 테제 "예매 오픈 놓치지 않게 하는 푸시가 진짜 무기", §2 Now/Next/Later, §6 수익화, §7 미해결 D1~D13)와 HANDOFF/PROGRESS 를 읽고 현재 코드와 대조하라. (a) 목표에 있는데 빠진 것(보완): N3 프로모션·N5 어필리에이트·X0 배포 게이트·수요검증 전략(공개 UI 제거 후 백엔드 익명집계 §9★ 의 중요도 상승) 등, (b) 목표와 어긋나게 변한 것(변경), (c) 목표상 더는 필요 없는 것(제거). 각 발견에 근거(문서 절/코드 위치)를 달아라.`,
    { label: 'audit:goals', phase: 'Audit', schema: AUDIT_SCHEMA, effort: 'high' }),
  () => agent(`${CTX}\n\n[감사 2: script.js 데드코드] 화면 제거(선수/리더/수요검증UI/히어로) 후 고아가 된 JS 를 찾아라: 후보 — renderPlayers/currentPlayerFilter/data-player-filter 핸들러(#playerGrid 없음), renderRankingList/rankingPanel/rankingBoard refs, renderSummary/summaryBoard, dataFiles.players/rankings fetch(제거된 UI 용 데이터 여전히 로드 — 낭비), showGameNotification, liveGameFromCalendar/representativeGame 사용처, demandMetricCards, 미사용 상수/헬퍼. 각 후보의 정의 위치·호출처 전수(grep)·정말 죽었는지/가드로 무해한지 구분. 유지가 맞는 것(향후 계획용)은 그렇게 표기.`,
    { label: 'audit:js', phase: 'Audit', schema: AUDIT_SCHEMA, agentType: 'Explore', effort: 'high' }),
  () => agent(`${CTX}\n\n[감사 3: styles.css 데드코드] 4288줄 중 현재 마크업(index.html + script.js 가 innerHTML 로 생성하는 클래스 전부)에서 더는 참조되지 않는 셀렉터를 레이어별로 찾아라: 후보 — 옛 히어로(hero-overlay/hero-dashboard/hero-content 계열), .standings-table, .player-card, .ranking-card/.ranking-board, .demand-signal-board/.demand-signal-events, .featured-score/.featured-team, 옛 .game-card 변형, .snapshot, #fff8ef 8건(169,202,274,370,477,617,742,776 부근 — 어떤 셀렉터가 아직 살아있는 마크업에 걸리는지), v20 이전 base 레이어 중 통째로 고아인 블록. 살아있는 마크업 클래스 목록을 먼저 추출(스크립트로 grep)한 뒤 대조해 증거를 달아라. 제거 시 절감 줄수 추정.`,
    { label: 'audit:css', phase: 'Audit', schema: AUDIT_SCHEMA, agentType: 'Explore', effort: 'high' }),
  () => agent(`${CTX}\n\n[감사 4: 데이터 파이프라인/성능] scripts/update-data.mjs 가 빌드하는 산출물(players.json/player-rankings.json/summary.json 등) vs 앱이 실제 소비하는 것(script.js dataFiles + 렌더에서 실사용), service-worker.js APP_SHELL precache 목록(사용 안 하는 데이터 precache?), assets(hero-stadium.png 등 미사용 자산), 크론이 커밋하는 불필요 산출물을 대조하라. 각: 유지(향후 계획상 필요)/제거(파이프라인+SW+fetch 3곳 동기 제거 필요) 판정과 절감 효과(전송 바이트/커밋 churn).`,
    { label: 'audit:pipeline', phase: 'Audit', schema: AUDIT_SCHEMA, agentType: 'Explore', effort: 'high' }),
  () => agent(`${CTX}\n\n[감사 5: 문서 드리프트] ROADMAP/HANDOFF/PROGRESS/README/docs/APPSTORE_DEPLOY.md 가 현재 코드와 어긋난 곳을 찾아라: 리디자인·화면 제거(선수/리더/수요검증UI)·알림센터·worker 코드 완성(미배포)·GitHub Pages 배포됨(v30)·수요검증 전략 변화가 문서에 반영 안 된 지점, ROADMAP §4.5 매트릭스/§8 다음 액션의 stale 항목. 다음 세션이 잘못된 문서를 믿지 않게 할 정정 목록.`,
    { label: 'audit:docs', phase: 'Audit', schema: AUDIT_SCHEMA, agentType: 'Explore', effort: 'medium' }),
])

phase('Verify')
// 데드코드 주장은 틀리면 라이브 기능을 부수므로 '제거' 항목만 적대적 재검증(grep 증명).
const removals = [...js.findings, ...css.findings, ...pipeline.findings].filter((f) => f.kind === '제거')
const verdicts = await parallel(removals.map((f, i) => () =>
  agent(`${CTX}\n\n[적대 검증 ${i + 1}/${removals.length}] 다음 '제거 후보' 주장을 반박하라 — 정말 어디서도 참조 안 되나? innerHTML 템플릿 문자열/동적 클래스 토글(classList)/테스트 assert/SW precache/update-data 산출까지 전부 grep 으로 확인하고, 하나라도 살아있는 참조가 있으면 refuted=true.\n\n주장: ${f.what}\n근거: ${f.evidence}\n권고: ${f.recommendation}`,
    { label: `verify:${i}`, phase: 'Verify', schema: {
      type: 'object', additionalProperties: false,
      required: ['refuted', 'proof'],
      properties: { refuted: { type: 'boolean' }, proof: { type: 'string' } },
    }, effort: 'medium' })
    .then((v) => ({ ...f, verified: v && !v.refuted, proof: v?.proof }))
))

phase('Synthesize')
const confirmed = verdicts.filter(Boolean)
const report = await agent(`${CTX}\n\n[통합 리포트 합성] 아래 감사 결과를 "보완 / 변경 / 제거" 3분류 통합 리포트로 합성하라. 제거 항목은 verified=true 만 채택(refuted 는 '유지' 로 강등하고 이유 표기). 각 항목: 무엇을/왜/어디를(파일)/공수(S·M·L)/우선순위. 마지막에 권장 실행 순서(다음 리팩토링 배치 구성안: 어떤 항목을 한 PR 로 묶을지)와 총 절감 추정(줄수/전송량).\n\n[목표갭]\n${JSON.stringify(goals)}\n\n[JS]\n${JSON.stringify(js.findings.filter((f) => f.kind !== '제거'))}\n\n[CSS]\n${JSON.stringify(css.findings.filter((f) => f.kind !== '제거'))}\n\n[파이프라인]\n${JSON.stringify(pipeline.findings.filter((f) => f.kind !== '제거'))}\n\n[검증된 제거 후보]\n${JSON.stringify(confirmed)}\n\n[문서]\n${JSON.stringify(docs)}`,
  { label: 'synthesize:report', phase: 'Synthesize', schema: {
    type: 'object', additionalProperties: false,
    required: ['supplement', 'change', 'remove', 'keep', 'batchPlan', 'savings'],
    properties: {
      supplement: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'why', 'files', 'effort', 'priority'], properties: { what: { type: 'string' }, why: { type: 'string' }, files: { type: 'string' }, effort: { type: 'string' }, priority: { type: 'string' } } } },
      change: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'why', 'files', 'effort', 'priority'], properties: { what: { type: 'string' }, why: { type: 'string' }, files: { type: 'string' }, effort: { type: 'string' }, priority: { type: 'string' } } } },
      remove: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'why', 'files', 'effort', 'priority'], properties: { what: { type: 'string' }, why: { type: 'string' }, files: { type: 'string' }, effort: { type: 'string' }, priority: { type: 'string' } } } },
      keep: { type: 'array', items: { type: 'string' } },
      batchPlan: { type: 'array', items: { type: 'string' } },
      savings: { type: 'string' },
    },
  }, effort: 'high' })

return { report, docsFindings: docs.findings }