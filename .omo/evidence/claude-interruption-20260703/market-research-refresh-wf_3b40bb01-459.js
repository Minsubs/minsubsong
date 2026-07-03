export const meta = {
  name: 'market-research-refresh',
  description: '시장조사 리프레시(2026-07) — 6/11 FMR 대비 델타: 경쟁사/KBO시장/암표법/예매처/플랫폼/수익화 웹리서치 → 검증 → 문서 합성',
  phases: [
    { title: 'Research', detail: '병렬 6: 경쟁사/시장/법률/예매처/플랫폼/수익화' },
    { title: 'Verify', detail: '핵심 주장 적대 재검증' },
    { title: 'Synthesize', detail: 'docs/MARKET_RESEARCH_2026-07.md 작성 + Top5 재검증' },
  ],
}
const REPO = '/Users/minsub/Documents/hanwha/hanwha'
const CTX = `KBO TIDO — 10구단 예매 오픈 통합 캘린더 + (예정)Web Push 알림 PWA. 오늘은 2026-07-03.
베이스라인: ${REPO}/docs/FEATURE_MARKET_RESEARCH.md (2026-06-11 작성 — Read 로 해당 절 먼저 읽고 "무엇이 달라졌나" 델타 중심으로 조사하라). 관련: docs/CANCEL_TICKET_ALERT_RESEARCH.md, docs/BACKEND_PUSH_PLAN.md.
도구: WebSearch/WebFetch 로 1차 출처를 직접 확인(추정 금지, unknown 은 정직하게 unknown 표기). 한국어 검색 활용. 모든 주장에 출처 URL 필수.
불변 원칙(조사 프레임): 자동예매·스크래핑·우회 금지, 거래 안 함(알림·정보 레이어만), 개인정보 최소화 — 각 발견이 이 포지션에 유리/불리한지 표기.
출력은 사람용 문장이 아니라 구조화 데이터.`

const R_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['dimension', 'findings', 'resolvedUnknowns', 'implications'],
  properties: {
    dimension: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claim', 'source', 'confidence', 'deltaVsBaseline'], properties: {
      claim: { type: 'string' }, source: { type: 'string' }, confidence: { type: 'string', enum: ['confirmed', 'likely', 'unknown'] }, deltaVsBaseline: { type: 'string' } } } },
    resolvedUnknowns: { type: 'array', items: { type: 'string' } },
    implications: { type: 'array', items: { type: 'string' } },
  },
}

phase('Research')
const [comp, market, legal, providers, platform, monetize] = await parallel([
  () => agent(`${CTX}\n\n[리서치 1: 직접 경쟁사 현황] 베이스라인 §2.1 대조 델타: (a) 직관메이트 — iOS 출시됐나? 평점/다운로드/취소표 기능(베이스라인 unknown 해소), (b) 오늘야구(yagu.today) — 푸시 도입 여부/기능 변화, (c) KBO Total Base(totalbase.kr) — "티켓 오픈 알림 구독"이 Web Push 인지 메일인지(unknown 해소), PWA 품질, (d) 2026 상반기 신규 진입자(KBO 티켓 알림/캘린더 앱·서비스) 검색. 각각 우리 빈틈(iOS·통합·신뢰 푸시)이 여전히 비어 있는지 판정.`,
    { label: 'research:competitors', phase: 'Research', schema: R_SCHEMA, effort: 'high' }),
  () => agent(`${CTX}\n\n[리서치 2: KBO 2026 시장] (a) 2026 시즌 관중/매진율 추이(작년 1,231만 대비), (b) 티켓 수요·티켓팅 난이도 이슈(전반기 화제 경기·오픈 대란 사례), (c) 구단별 예매처 계약 변경 여부 2026(우리 데이터 정확성 직결 — 한화=티켓링크, 두산·키움·LG=인터파크(NOL), SSG=SSG티켓, NC=직영, 롯데=자이언츠 직영, KIA·KT·삼성=티켓링크 가 여전히 맞나), (d) 올스타전·포스트시즌 예매 일정(하반기 앱 가치 이벤트).`,
    { label: 'research:market', phase: 'Research', schema: R_SCHEMA, effort: 'high' }),
  () => agent(`${CTX}\n\n[리서치 3: 법률/컴플라이언스] 2026-08-11 시행 개정 공연법/암표 관련 법(베이스라인 §4): (a) 시행령·가이드라인 확정 내용(공포번호·부칙 — 베이스라인 unknown), (b) "거래 안 하는 알림·정보 서비스"에 미치는 영향(유리/불리), (c) 매크로 단속 강화가 예매처 안티봇 정책에 줄 영향(우리 컨시어지 안내 문구에 반영할 것), (d) 정보통신망법 §50 관련 최신 해석/집행 사례(정보성 푸시 경계).`,
    { label: 'research:legal', phase: 'Research', schema: R_SCHEMA, effort: 'high' }),
  () => agent(`${CTX}\n\n[리서치 4: 예매처/제휴 채널] (a) NOL(인터파크) 리브랜딩 현황 — 스포츠 예매 최종 URL 구조(ticket.interpark.com/Contents/Sports vs nol.interpark.com — 우리 코드가 전자 사용 중, 리다이렉트/폐기 계획 확인), (b) 각 예매처 취소표 대기/예매대기 서비스 변화(티켓링크 취소표대기·인터파크 예매대기 요금/정책), (c) 예매처·구단 어필리에이트/파트너 프로그램 유무(베이스라인 unknown — NHN링크 파트너API 포함), (d) 예매처 API/제휴 문의 채널.`,
    { label: 'research:providers', phase: 'Research', schema: R_SCHEMA, effort: 'high' }),
  () => agent(`${CTX}\n\n[리서치 5: 플랫폼/기술] (a) iOS Web Push 2026 현황 — iOS 26(또는 최신) 에서 PWA 푸시 변화/개선, Declarative Web Push 채택 현황(베이스라인 §참고), (b) Android/Chrome Web Push 변화, (c) PWA 의 앱스토어 등재 정책 변화(TWA/PWABuilder), (d) Cloudflare Workers cron 정밀도 관련 최신 정보(D4 PoC 참고자료). 우리 X0 아키텍처에 영향 주는 변화가 있으면 명시.`,
    { label: 'research:platform', phase: 'Research', schema: R_SCHEMA, effort: 'medium' }),
  () => agent(`${CTX}\n\n[리서치 6: 수익화] (a) 여행/숙박 어필리에이트(아고다 파트너스·링크프라이스·쿠팡파트너스 등) 2026 정책/커미션 — 원정 직관 숙소 추천 시나리오 적합성, (b) 국내 스포츠 정보앱 구독 모델 사례/가격대(지불의사 벤치), (c) "예매 오픈 푸시" 류 단독 기능의 유료화 사례(국내외), (d) 공정위 어필리에이트 표기 의무 최신 가이드. 베이스라인 §5 델타.`,
    { label: 'research:monetize', phase: 'Research', schema: R_SCHEMA, effort: 'medium' }),
])

phase('Verify')
// 로드맵을 바꿀 수 있는 고임팩트 주장만 골라 적대 재검증(독립 재검색).
const all = [comp, market, legal, providers, platform, monetize].filter(Boolean)
const hot = all.flatMap((d) => d.findings.filter((f) => f.confidence !== 'unknown' && /경쟁|출시|변경|시행|폐기|중단|신규|어필리에이트|iOS/.test(f.claim)).slice(0, 2))
const verdicts = await parallel(hot.map((f, i) => () =>
  agent(`${CTX}\n\n[적대 검증 ${i + 1}/${hot.length}] 다음 주장을 독립적으로 재검색해 반박을 시도하라. 출처가 1차인지, 날짜가 2026년 현재 유효한지, 과장/오독은 없는지. 확인 불가면 refuted 가 아니라 unknown 강등.\n\n주장: ${f.claim}\n원출처: ${f.source}`,
    { label: `verify:${i}`, phase: 'Verify', schema: {
      type: 'object', additionalProperties: false,
      required: ['verdict', 'proof'],
      properties: { verdict: { type: 'string', enum: ['confirmed', 'refuted', 'unknown'] }, proof: { type: 'string' } },
    }, effort: 'medium' })
    .then((v) => ({ ...f, verdict: v?.verdict ?? 'unknown', proof: v?.proof }))
))

phase('Synthesize')
const doc = await agent(`${CTX}\n\n[합성: 새 시장조사 문서 작성] 아래 리서치+검증 결과로 ${REPO}/docs/MARKET_RESEARCH_2026-07.md 를 Write 로 작성하라(이 단계만 쓰기 허용, 이 파일 하나만). 구조: 1) 요약(핵심 결론 5줄 + 6/11 베이스라인 대비 "무엇이 달라졌나" 델타 표) 2) 경쟁 환경 갱신 3) 시장(2026 시즌) 4) 법률(8/11 시행 대비 체크리스트) 5) 예매처/제휴 6) 플랫폼 7) 수익화 8) **추천 Top5 재검증**(기존 Top5 유지/변경 판정+이유) 9) 미해결 unknown(정직하게) 10) ROADMAP 시사점(변경 제안 목록 — 문서만, ROADMAP 자체는 건드리지 말 것). 모든 주장에 출처, 검증 verdict(refuted 는 본문에서 제외하고 부록에 기록). 작성 후 파일 경로와 요약을 반환.\n\n[경쟁]${JSON.stringify(comp)}\n[시장]${JSON.stringify(market)}\n[법률]${JSON.stringify(legal)}\n[예매처]${JSON.stringify(providers)}\n[플랫폼]${JSON.stringify(platform)}\n[수익화]${JSON.stringify(monetize)}\n[검증]${JSON.stringify(verdicts.filter(Boolean))}`,
  { label: 'synthesize:doc', phase: 'Synthesize', schema: {
    type: 'object', additionalProperties: false,
    required: ['filePath', 'summary', 'top5Changed', 'roadmapImplications'],
    properties: {
      filePath: { type: 'string' }, summary: { type: 'string' },
      top5Changed: { type: 'boolean' },
      roadmapImplications: { type: 'array', items: { type: 'string' } },
    },
  }, effort: 'high' })

return { doc, verifiedCount: verdicts.filter(Boolean).length }