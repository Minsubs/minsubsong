# 시장조사 리프레시 2026-07 — 수집 원본(raw)

> 상태: **수집 완료 / 합성 미완**(세션 한도로 중단). 6방향 리서치 + 적대검증 12건 verdict 포함.
> 다음 세션: 이 원본으로 최종 문서(MARKET_RESEARCH_2026-07.md) 합성 + Top5 재검증 + ROADMAP 시사점.
> 베이스라인: docs/FEATURE_MARKET_RESEARCH.md (2026-06-11)

## confirmed

```json
{
 "verdict": "confirmed",
 "proof": "1차 출처 직접 확인: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ (WebKit 공식 블로그, 2025-09-15 게시, Safari 26.0 대상). 인용문 원문 그대로 존재: \"Now, we are revising the behavior on iOS 26 and iPadOS 26. By default, every website added to the Home Screen opens as a web app. If the user prefers to add a bookmark for their browser, they can disable 'Open as Web App' when adding to Home Screen — even if the site is configured to be a web app.\" 또한 installability 요건 0에 대한 별도 문장도 원문 확인: \"Simply put, there are now zero requirements for 'installability' in Safari. Users can add any site to their Home Screen and open it as a web app on iOS 26 and iPadOS 26.\" — manifest 불요, 토글로 끄기 가능이라는 하위 주장 3개 모두 일치. 독립 2차 교차검증: MacRumors (https://www.macrumors.com/how-to/save-safari-bookmark-web-app-iphone-home-screen/), heise (https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html), Michael Tsai (https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/) 이 동일 동작(PWA 미지원 사이트 포함 모든 사이트 웹앱 오픈 + 'Open as Web App' 토글)을 보도. 날짜 유효성: iOS 26 은 2025-09 출시로 2026-07 현재 배포 중인 현행 OS — 주장 유효. 과장/오독 없음. [프로젝트 포지션 영향: 유리 — manifest 유무와 무관하게 KBO TIDO PWA 를 iOS 홈 화면 standalone 웹앱으로 설치 가능, Web Push(iOS 16.4+ 홈화면 웹앱 전제) 진입 장벽 하락. 단 이 출처 자체는 '모든 사이트가 푸시 가능'까지 말하지 않음 — 푸시 권한 요건은 별도 확인 사항.]"
}
```

## confirmed

```json
{
 "verdict": "confirmed",
 "proof": "시행일 2026-08-28 확인(2026-08-11 아님). 1차 출처: (1) 문체부 공식 국정성과 페이지 https://www.mcst.go.kr/site/s_policy/govPolicy/performView.jsp?pSeq=1115 — 국회 본회의 통과 2026-01-29, 공포 2026-02-28, 매크로 무관 전면금지·판매금액 50배 이하 과징금·신고포상금·몰수추징 명시. (2) 서울경제 2026-06-24 https://www.sedaily.com/article/20059529 — 문체부 직접 인용 \"오는 8월 28일 개정 공연법과 국민체육진흥법의 시행에 맞춰 하위법령 정비·신고기관 운영 준비\" (문체부 공식 언급 확인). 교차검증: 서울경제 하반기정책 https://www.sedaily.com/article/20061632, 법률신문 https://www.lawtimes.co.kr/news/articleView.html?idxno=217253, EBN https://www.ebn.co.kr/news/articleView.html?idxno=1700649 모두 8-28 일치. 공포 2026-02-28 + 공포후 6개월 기산 → 8월 말 시행으로 산술 정합, '2월 말 공포로 기산이 밀렸다'는 주장의 논리도 성립. 8월 11일 시행을 지지하는 출처는 없음. 포지션 영향: 유리(거래 미개입 알림·정보 레이어 포지션의 규제 안전성 논거 유지)."
}
```

## 리서치 2: KBO 2026 시장 — 관중·매진 추이 / 티켓팅 난이도 / 구단별 예매처 계약 변경 / 하반기 이벤트(올스타전·포스트시즌)

```json
{
 "dimension": "리서치 2: KBO 2026 시장 — 관중·매진 추이 / 티켓팅 난이도 / 구단별 예매처 계약 변경 / 하반기 이벤트(올스타전·포스트시즌)",
 "findings": [
  {
   "claim": "(a) 2026 전반기 관중 신기록: 7/1 기준 388경기 만에 700만 돌파(누적 7,013,844명, 역대 최소경기·최단기간), 평균 18,077명(전년 동기 대비 약 +8%). 600만→700만이 54경기·13일(작년 55경기·14일)로 작년 1,231만 페이스를 상회 — [유리] 티켓 수요 페인 구조적 확대 지속",
   "source": "https://www.mt.co.kr/sports/2026/07/01/2026063023161149211 (2026-07-01)",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인(2025 시즌 1,231만·사상 최대) 대비 2026은 그보다 빠른 페이스. 수요 전제가 더 강해짐"
  },
  {
   "claim": "(a) 2026 전반기 매진율 56.1%(388경기 중 218경기 매진), 평균 좌석점유율 87.7%. 구단별: 한화 홈 37경기 중 34경기 매진(점유율 99.7%, 최다 매진), 삼성 점유율 99.1%, LG 홈관중 1위(960,568명·평균 23,428명) — [유리] '오픈 직후 잡아야 한다' 압력 심화 = 오픈 사전알림 가치 상승",
   "source": "https://www.mt.co.kr/sports/2026/07/01/2026063023161149211",
   "confidence": "confirmed",
   "deltaVsBaseline": "2025 시즌 전체 매진율 45.7%(321/703) → 2026 전반기 56.1%로 약 +10%p 급등. 티켓팅 난이도 한 단계 상승"
  },
  {
   "claim": "(c-핵심 변경) LG 트윈스 예매처가 2026 시즌 인터파크 → 티켓링크로 변경됨. LG 공식 홈페이지 티켓 안내가 '티켓링크 유일 공식 예매처, 경기 7일 전 11시 일반예매 오픈'으로 명시, 티켓링크에 LG 트윈스 전용 판매 페이지(sports/137/59) 존재, NOL(인터파크) 스포츠 야구 섹션에는 두산·키움만 남음 — [불리→즉시 조치] 우리 data/ticketing-calendar.json 은 아직 LG=NOL 티켓(ticket.interpark.com)으로 기록돼 있어 오답 상태",
   "source": "https://www.lgtwins.com/ticket/general · https://www.ticketlink.co.kr/sports/137/59 · https://ticket.interpark.com/Contents/Sports",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 '두산·키움·LG=인터파크(NOL)'에서 LG가 이탈. 10구단 매핑 중 1건 확정 오류 발생 — 데이터 정확성 신뢰 갭 직결"
  },
  {
   "claim": "(c) 두산·키움 = 인터파크(NOL) 유지. NOL 스포츠 페이지 야구 섹션에 두산베어스·키움히어로즈 직접 링크, 키움 공식 티켓 페이지가 '인터파크 유일 공식 예매처, 경기 7일 전 14시 오픈' 명시 — [중립, 데이터 수정 필요] 우리 데이터는 키움 오픈시각을 11:00으로 기록 중이나 공식은 14:00",
   "source": "https://ticket.interpark.com/Contents/Sports · https://heroesbaseball.co.kr/ticket/normal/view.do",
   "confidence": "confirmed",
   "deltaVsBaseline": "예매처는 베이스라인과 동일. 단 키움 오픈시각(14:00)이 리포지토리 데이터(11:00)와 불일치 — 수정 대상"
  },
  {
   "claim": "(c) SSG = 구단 직영 유지(랜더스앱·SSG닷컴, ticket.ssg.com). 2026 시즌부터 티켓링크 채널에서는 SSG 홈경기 예매 불가(완전 직영 전환)라는 안내가 복수 가이드에 등장. 일반예매는 경기 4일 전 오전 11시 — [주의] 티켓링크 '취소표 대기' 대상 6구단(KIA·삼성·한화·NC·KT·SSG) 목록에서 SSG 이탈 가능성 → CANCEL_TICKET_ALERT_RESEARCH.md 갱신 필요",
   "source": "https://ticket.ssg.com/ · https://www.allsinfo.co.kr/2026/03/2026-ssg-ssg.html · https://xocowriter.com/ssg-랜더스-야구-티켓-예매-방법/",
   "confidence": "likely",
   "deltaVsBaseline": "베이스라인 'SSG=SSG티켓'과 대체로 동일하나 '티켓링크 병행 판매 종료'가 신규 델타(1차 출처 공지 원문 미확인)"
  },
  {
   "claim": "(c) NC = 티켓링크 판매 확인(티켓링크 공지 45226이 'NC다이노스 구단의 홈경기 예매' 할인카드 안내) + 구단 공식 앱/홈페이지 병행(시즌권은 앱 전용) — 베이스라인의 'NC=직영(단독)' 표기는 부정확. 참고로 베이스라인 문서 자체도 티켓링크 취소표대기 6구단에 NC를 포함하고 있어 내부 모순이 있었음",
   "source": "https://www.ticketlink.co.kr/help/notice/45226 · https://www.ncdinos.com/auth/ticket.do · https://www.starnewskorea.com/sports/2026/02/07/2026020623080919569",
   "confidence": "confirmed",
   "deltaVsBaseline": "'NC=직영' → 'NC=티켓링크+구단앱 병행'으로 정정 필요 (2026 변경이 아니라 베이스라인 오기 가능성 높음)"
  },
  {
   "claim": "(c) KT = 티켓링크(전용 페이지 sports/137/62) + wizzap 앱/공식 홈 병행 유지. 단 블로그 가이드 기준 일반예매 오픈이 '경기 7일 전 16시'(시즌권 12시·멤버십 13시 순차)로 우리 데이터(11:00)와 다름 — 오픈시각 1차 출처 재검증 필요",
   "source": "https://www.ticketlink.co.kr/sports/137/62 · https://www.ktwiz.co.kr/ticket/reservation · https://www.lifetipssite.com/2026/03/kt.html",
   "confidence": "likely",
   "deltaVsBaseline": "예매처는 베이스라인(KT=티켓링크)과 동일. 오픈시각 16시 주장은 블로그 출처라 unknown에 가까움 — KT 공식 공지로 확정 필요"
  },
  {
   "claim": "(c) 한화 = 티켓링크 유지, KIA(sports/137/58)·삼성 = 티켓링크 유지, 롯데 = 자이언츠 직영(ticket.giantsclub.com) 유지 — 2026 시즌 가이드 복수 출처 일치, 변경 징후 없음",
   "source": "https://brunch.co.kr/@e3029291461944a/100 (2026-03-27) · https://brunch.co.kr/@77d538f56b9b41b/51 · https://www.ticketlink.co.kr/sports/137/58",
   "confidence": "likely",
   "deltaVsBaseline": "변경 없음. 단 KIA·삼성·한화·롯데는 구단 공식 페이지 직접 재확인은 미수행(2차 출처 일치 기반)"
  },
  {
   "claim": "(b) 티켓팅 난이도: 2026 개막전 티켓 '3분 매진' 수준의 피켓팅, 개막전 암표가 정가의 최대 9배(1.4만원→11.9만원, 2.5만원→25만원)에 리셀 — [유리] '정시 오픈 + 취켓팅' 정보 수요 증가",
   "source": "https://www.newspim.com/news/view/20260326000887 (2026-03-26) · https://brunch.co.kr/@77d538f56b9b41b/51",
   "confidence": "confirmed",
   "deltaVsBaseline": "암표 프리미엄이 구체 수치로 보도될 만큼 심화 — 베이스라인엔 없던 신규 근거"
  },
  {
   "claim": "(b) 암표 규제: 매크로 암표 처벌 개정안 시행일이 2026-08-28로, 전반기 내내 단속 공백 상태. 구단 자구책 확산 — SSG는 1인 예매한도 12매→6매 축소, 취소 마감을 경기 4시간 전→당일 오전 10시로 변경. 삼성은 정가 양도 티켓의 암표화로 원구매 팬이 2년 계정정지 당한 사례 보도 — [유리] '거래 안 함·알림만' 포지션은 규제 강화 국면에서 무풍지대. [주의] 취소 마감시각 변경은 취소표 골든타임 가이드 데이터에 반영 필요",
   "source": "https://www.asiae.co.kr/article/2026061915342242583 (2026-06-19) · https://www.newspim.com/news/view/20260326000887",
   "confidence": "confirmed",
   "deltaVsBaseline": "신규: 8/28 법 시행 예정 + 구단별 예매/취소 정책 강화 트렌드. 취소표 관련 파라미터(마감시각·매수한도)가 시즌 중 변동됨"
  },
  {
   "claim": "(d) 올스타전: 7/10(금) 올스타 프라이데이 + 7/11(토) 올스타전, 잠실야구장(잠실 마지막 올스타전). 선예매 6/29(월) 14시(프라이데이, 선착순 7,000매) → 6/30(화) 14시(올스타전, 프라이데이 2매 이상 구매자 한정) → 일반예매 7/1(수) 14시. 판매는 NOL(인터파크) 플랫폼 단독 — [시사점] 일반예매가 이미 열렸으므로(7/1) 남은 앱 가치는 취켓팅 안내",
   "source": "https://m.seoul.co.kr/news/2026/06/25/20260625500276 · https://www.ggilbo.com/news/articleView.html?idxno=1166579 · https://www.etoday.co.kr/news/view/2597311",
   "confidence": "confirmed",
   "deltaVsBaseline": "신규 이벤트 데이터. 특기: 잠실이 LG(티켓링크 이적) 홈인데도 올스타전은 NOL 단독 — 이벤트별 예매처가 정규시즌 매핑과 다를 수 있음을 입증"
  },
  {
   "claim": "(d) 포스트시즌: 2026 포스트시즌 세부 일정·예매 일정은 미발표(통상 10월 중순~11월 초, 와일드카드→준PO→PO→한국시리즈 7전4선승). 예매는 라운드별 홈팀 계약 플랫폼에서 경기 1~2일 전 오픈되는 관행 — 발표 시점(9월 말~10월 초)이 하반기 앱 최대 이벤트 창구",
   "source": "https://namu.wiki/w/2026 신한 SOL KBO 포스트시즌 · https://m.koreabaseball.com/About/GameManage.aspx",
   "confidence": "unknown",
   "deltaVsBaseline": "아직 확정 정보 없음 — 추정으로 채우지 않음. KBO 공식 발표 모니터링 트리거만 설정 가능"
  }
 ],
 "resolvedUnknowns": [
  "베이스라인의 'LG=인터파크(NOL)'는 2026 시즌 더 이상 사실이 아님 — LG 공식 홈페이지 기준 티켓링크 단독(7일 전 11시 오픈)으로 확정",
  "베이스라인의 'NC=직영'은 부정확 — NC 홈경기는 티켓링크에서도 판매됨(티켓링크 공지 45226으로 확인), 구단앱 병행",
  "2025 매진율 45.7% 대비 2026 전반기 매진율 56.1%로 상승 확정 (388경기 중 218경기, 7/1 기준)",
  "2026 올스타전 예매 플랫폼·일정 확정: NOL 단독, 선예매 6/29~30 14시, 일반 7/1 14시",
  "암표 규제 개정안 시행일 확정: 2026-08-28 (전반기는 단속 공백)"
 ],
 "implications": [
  "[즉시 수정] /Users/minsub/Documents/hanwha/hanwha/data/ticketing-calendar.json 의 LG 홈경기 provider가 'NOL 티켓'(ticket.interpark.com)으로 남아 있음 → '티켓링크'(https://www.ticketlink.co.kr/sports/137/59)로 교체. 10구단 통합 캘린더의 핵심 셀링포인트(정확성)가 걸린 확정 버그",
  "[데이터 검증] 오픈시각 불일치 2건: 키움 공식 14:00 vs 우리 데이터 11:00(확정 오류), KT 16:00 주장(블로그) vs 우리 11:00(1차 출처 재확인 필요). 오픈시각이 제품의 알림 트리거이므로 10구단 전체 오픈시각을 구단 공식 공지 기준으로 일제 재검증하는 루프 권장",
  "[문서 갱신] CANCEL_TICKET_ALERT_RESEARCH.md 의 티켓링크 취소표대기 대상 6구단(KIA·삼성·한화·NC·KT·SSG) 목록 재확인 필요 — SSG 이탈(직영 전환) 가능성, LG 신규 편입 가능성. SSG 취소마감 당일 10시 변경도 취소표 골든타임 가이드에 반영",
  "[포지션 유리] 매진율 56.1%로 상승 + 암표 프리미엄 9배 + 8/28 매크로 암표 처벌 시행 → '자동예매·우회 없이 오픈 사전알림만 제공'하는 정보 레이어 포지션의 규제 리스크는 낮아지고 수요 근거는 강해짐",
  "[하반기 로드맵] 올스타전은 일반예매 이미 시작(7/1)이라 취켓팅 안내만 유효. 진짜 이벤트는 포스트시즌(10월) — KBO 발표 즉시 캘린더 반영 + 푸시하는 파이프라인을 BACKEND_PUSH_PLAN 일정에 맞춰 9월 전 가동 필요",
  "[운영 교훈] 예매처 계약은 시즌 단위로 실제 변동함(LG 사례)이 입증됨 + 이벤트(올스타전=NOL 단독)는 정규시즌 매핑과 다를 수 있음 → 분기 1회 이상 10구단 공식 티켓 페이지 1차 출처 재검증 루틴을 데이터 파이프라인에 내장할 것"
 ]
}
```

## confirmed

```json
{
 "verdict": "confirmed",
 "proof": "1차 출처(iTunes Lookup API, 2026-07-03 직접 호출)로 전 항목 재검증 완료. curl https://itunes.apple.com/lookup?id=6762068849&country=kr 실측값: trackName='오늘야구', releaseDate='2026-04-19T07:00:00Z'(베이스라인 2026-06-11 직전 ✓), version='1.0.6', currentVersionReleaseDate='2026-05-21T16:14:57Z' ✓, averageUserRating=4.66667(≈4.7), userRatingCount=3 ✓, sellerName='Dosivan'(단, artistName='Donghyeon Lim' — '개발자 Dosivan'은 판매자명 기준으로 정확, 개인 개발자 실명은 임동현) ✓. 앱 설명 전문(1,525자) 검색 결과: 'NTP 시간 동기화로 예매 오픈 정각까지 0.01초 단위 카운트다운 + PiP' ✓, '찜한 경기와 예매 오픈 시간이 iOS 기본 캘린더에 자동으로 추가 + 알림 설정' ✓, 'Apple/Google/카카오 로그인, 웹(yagu.today) 연동' ✓, '홈 화면 위젯 3종(다음 경기/주간/월간)' ✓. '푸시'/'push' 문자열 0회 — 알림 언급은 iOS 캘린더 알림뿐이므로 '앱 설명에 서버 푸시 언급 없음' ✓ (단, 설명 부재≠서버푸시 기능 부재이므로 실제 미구현 여부는 unknown 유지 권장). 베이스라인 /Users/minsub/Documents/hanwha/hanwha/docs/FEATURE_MARKET_RESEARCH.md 확인: 40행·61행에서 오늘야구를 '웹' 채널로만 기재 → iOS 앱 미반영 ✓. 추가 델타: 최소 iOS 17.0, 앱스토어 카테고리 '스포츠', 앱 설명에 'KBO 비공식 팬앱, 공개 정보 기반' 고지 명시(우리의 스크래핑 금지·정보레이어 포지션과 동일 프레임 — 경쟁 위협도 상승에 유리하지 않은 발견: iOS 네이티브+캘린더 알림으로 iOS 공백 논거 일부 침식, 다만 서버 푸시 부재로 'Web Push 알림' 차별점은 유지). 출처: https://itunes.apple.com/lookup?id=6762068849&country=kr · https://apps.apple.com/kr/app/%EC%98%A4%EB%8A%98%EC%95%BC%EA%B5%AC/id6762068849"
}
```

## confirmed

```json
{
 "verdict": "confirmed",
 "proof": "Independently re-ran the iTunes Search API on 2026-07-03: (1) search?term=직관메이트&country=kr&entity=software → resultCount 0; (2) search?term=inviewmate&country=kr&entity=software → 0; (3) exact-match lookup?bundleId=com.inviewmate.app → 0 in both KR and global storefronts (strongest evidence — rules out name variants); (4) global search?term=inviewmate returned 46 fuzzy matches, none by inviewmate (TeamViewer/CCTV viewers); (5) broad search?term=직관&country=kr (25 KBO-fan apps incl. 직관로그, 매치클락, 자리어때) does not include 직관메이트; (6) WebSearch found no iOS release news. Android side re-verified: https://play.google.com/store/apps/details?id=com.inviewmate.app still live today (\"직관메이트 - 야구 예매 일정 알림 응원가 앱\"). Residual risk: iTunes API could miss a rebranded app under a different bundleId, but no signal supports this. Delta vs 2026-06-11 baseline: none — still Android-only. Position impact: favorable (iOS/PWA gap intact). Sources: https://itunes.apple.com/search?term=%EC%A7%81%EA%B4%80%EB%A9%94%EC%9D%B4%ED%8A%B8&country=kr&entity=software · https://itunes.apple.com/lookup?bundleId=com.inviewmate.app&country=kr · https://itunes.apple.com/search?term=inviewmate&entity=software · https://play.google.com/store/apps/details?id=com.inviewmate.app"
}
```

## confirmed

```json
{
 "verdict": "confirmed",
 "proof": "주장 (c) 재검증 결과 — 2026-07-03 독립 재검색 기준.\n\n[1] NOL 티켓 성과형 어필리에이트 부재: 확인. 독립 질의 3종(\"NOL 티켓 어필리에이트 제휴마케팅\", \"링크프라이스 인터파크 티켓 NOL 머천트 CPS\", \"세시간전 NOL 티켓 공연 어필리에이트\") 모두 공개 성과형 프로그램 근거 0건. 검색에 잡히는 것은 예매 수수료 안내(https://ticket.interpark.com/TiKi/Info/BookingGuide.asp?Url=guide_11.html)와 NOL 카드 프로모션뿐. 단, 부재 증명은 원리상 불가능하므로 정확한 상태는 \"공개 채널 미발견 유지\"이며 비공개 B2B 제휴 존재 여부는 unknown.\n\n[2] 티켓링크 어필리에이트 부재: 확인. \"티켓링크 어필리에이트 파트너 성과형\" 질의에서 국내 티켓링크 프로그램 0건(TicketNetwork/Ticketmaster 등 해외만 검출). 나무위키·공식 사이트에도 언급 없음.\n\n[3] 티켓링크 배너 광고 지면 판매 계속 운영: 확인(강화됨). (a) https://www.ticketlink.co.kr/advertisement curl 결과 HTTP 200 정상 유지(단 JS 렌더링 페이지라 본문 텍스트 직접 검증은 못함). (b) 1차에 준하는 독립 교차 증거: 광고지면 중개 애즈순(ads-soon)에 티켓링크 배너 상품 소개서 다수 게재 — 스포츠 팝업 배너 https://www.ads-soon.com/product/details/274, 상단 띠 배너 https://www.ads-soon.com/product/details/281, 스포츠 레이어 배너(20만원~) https://www.ads-soon.com/product/details/277, 공연전시 이미지텍스트(200만원~) https://www.ads-soon.com/product/details/280. \"프로스포츠 티켓 점유 80%+, MAU 250만+\" 소구로 지면 판매 활발 → 배너 광고가 유일한 공개 광고 채널이라는 원주장과 정합.\n\n[4] 반박 시도에서 나온 인접 사실(주장 자체는 흔들지 않으나 기록 가치): NOL 모기업 야놀자의 '숙박' 상품은 세시간전(모먼트스튜디오)·링크프라이스 경유 CPS 어필리에이트가 공개 운영 중(2025-03-19 기사 https://www.startupn.kr/news/articleView.html?idxno=51153, 숙박만 명시·티켓/공연 언급 없음 — WebFetch 로 원문 확인). 즉 \"티켓 예매 상품\"의 성과형 채널 부재는 유지되지만, NOL 생태계 전체가 어필리에이트 무경험 조직은 아님 → 향후 티켓으로 확장될 가능성 모니터링 필요. 프로젝트 포지션(알림·정보 레이어, 거래 안 함)에는 유리: 숙박 어필리에이트(세시간전/링크프라이스)가 이미 검증된 대체 BM 경로임을 재확인.\n\n한계: [1][2]는 부재 주장이라 원리적으로 confirmed ceiling 이 \"재검색에서도 미발견\"임. ticketlink advertisement 페이지 본문은 JS 렌더링으로 직접 파싱 불가(200 응답 + 제3자 지면판매 증거로 보강)."
}
```

## confirmed

```json
{
 "verdict": "confirmed",
 "proof": "3개 하위 주장 모두 1차 출처로 독립 재확인, 반박 실패 → confirmed.\n\n(1) LG 공식 홈페이지 티켓 안내 (https://www.lgtwins.com/ticket/general, 2026-07-03 직접 fetch): 페이지에 \"2026 시즌 일반 티켓\", \"2026 티켓 예매 안내\" 등 2026 시즌 표기 명시. 예매 문의처가 \"티켓링크 고객센터 : 1588-7890 ▶ 2번 (프로야구)\"로 안내되고, \"홈경기 관람 7일 전 11시부터 당일 경기 시작 후 1시간 까지 예매 가능합니다\" 문구 확인 — 주장의 '경기 7일 전 11시 일반예매 오픈'과 정확히 일치. 인터파크/NOL 언급 없음. 단, \"티켓링크 유일 공식 예매처\"라는 문구가 그대로 있는지는 fetch 요약상 직접 인용 못 함(고객센터 안내 + 인터파크 부재로 간접 확인) — 표현은 다소 과장 가능성 있으나 실질(예매처=티켓링크)은 유효.\n\n(2) 티켓링크 LG 전용 페이지 (https://www.ticketlink.co.kr/sports/137/59): 페이지가 JS 렌더링이라 직접 fetch로는 구단명 미노출(unknown 요소). 그러나 Google 검색 결과에서 해당 URL이 제목 \"LG 트윈스\"로 색인돼 있음을 확인, 또한 137/xx 패턴이 KBO 구단 페이지(한화=137/63, 우리 데이터에도 사용 중)와 일치 — 간접 2중 corroboration.\n\n(3) NOL/인터파크 스포츠 (https://ticket.interpark.com/Contents/Sports, 직접 fetch): 야구 섹션 구단 목록에 두산베어스·키움히어로즈만 존재, LG 트윈스는 구단 예매 메뉴에 없음(하단 'LG트윈스 굿즈샵' 상품 링크만 존재 — 굿즈이지 예매 아님). 주장과 일치.\n\n(4) 로컬 오답 상태 확인: /Users/minsub/Documents/hanwha/hanwha/data/ticketing-calendar.json 의 LG 홈경기 항목(07.04, 07.05, 07.16~19, 07.21~23, 07.28~30 등) 전부 \"provider\": \"NOL 티켓\", \"url\": \"https://ticket.interpark.com/Contents/Sports\" 로 기록 — 실제(티켓링크)와 불일치, 오답 상태 맞음. 추가로 07.31/08.01 두산 홈경기는 NOL 유지가 옳음(두산은 NOL 잔류 확인됨).\n\n불변 원칙 관점: [불리→즉시 조치] 판정 타당. 공개 안내 페이지 기반 정보 수정이므로 스크래핑/우회 원칙과 무충돌. 조치: ticketing-calendar.json 의 LG 홈경기 provider를 티켓링크(https://www.ticketlink.co.kr/sports/137/59)로 교체 필요 (openDaysBefore=7, openTime=11:00 은 그대로 유효)."
}
```

## 리서치 4: 예매처/제휴 채널 (NOL 리브랜딩 · 대기서비스 · 어필리에이트 · 제휴 문의 채널)

```json
{
 "dimension": "리서치 4: 예매처/제휴 채널 (NOL 리브랜딩 · 대기서비스 · 어필리에이트 · 제휴 문의 채널)",
 "findings": [
  {
   "claim": "(a) 우리 코드가 62곳에서 쓰는 https://ticket.interpark.com/Contents/Sports 는 2026-07-03 현재 HTTP 200·리다이렉트 0회로 정상 서비스 중이며, 페이지 타이틀은 'NOL 티켓 | 스포츠 예매'로 NOL 브랜딩 완료 상태. 단 og:url(canonical)은 https://tickets.interpark.com 을 가리킴",
   "source": "직접 확인: curl -IL https://ticket.interpark.com/Contents/Sports (200, redirects:0) + HTML og:url/title 추출, 2026-07-03",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인(2026-06-11)은 URL 유효를 전제만 함 → 유효 재확인. 신규: canonical이 신도메인(tickets.interpark.com)으로 이동 = 구 URL은 레거시 취급 시작. 포지션: 중립(딥링크는 여전히 작동 = 컨시어지 모델 유지 가능, 단 유지보수 리스크)"
  },
  {
   "claim": "(a) tickets.interpark.com 루트는 302로 nol.interpark.com/ticket 으로 리다이렉트되고, 신도메인에는 스포츠 장르 페이지가 없음(tickets.interpark.com/contents/genre/sports → /contents/genre/musical 로 튕김). 즉 스포츠 예매는 아직 레거시 ticket.interpark.com 경로에만 존재",
   "source": "직접 확인: WebFetch가 302 Found (tickets.interpark.com → nol.interpark.com/ticket) 보고 + curl로 genre/sports → genre/musical 리다이렉트 1회 관측, 2026-07-03",
   "confidence": "confirmed",
   "deltaVsBaseline": "신규 발견. 스포츠는 신도메인 이관이 아직 안 됐으므로 당장 URL 교체 불필요 — 그러나 이관 시점에 일괄 깨질 리스크. 포지션: 불리(도메인 churn 감시 필요)"
  },
  {
   "claim": "(a) nol.interpark.com/ticket 상단에 'NOL 티켓이 NOL로 통합됩니다!' 공지 배너가 떠 있고 안내 페이지는 events.interpark.com/exhibition?exhibitionCode=260609002 (코드상 2026-06-09 게시 = 우리 베이스라인 작성 이틀 전후). 통합 완료일·구 도메인 폐기 일정은 안내 페이지가 이미지 기반이라 미확인(unknown)",
   "source": "직접 확인: WebFetch https://nol.interpark.com/ticket (배너 원문 인용) + https://events.interpark.com/exhibition?exhibitionCode=260609002 (이미지라 본문 추출 실패), 2026-07-03",
   "confidence": "confirmed",
   "deltaVsBaseline": "신규. 베이스라인에 없던 'NOL 티켓 → NOL 포털 흡수' 공식 예고. 최종 목적지는 nol.yanolja.com 계열로 추정(프로야구 예매가 nol.yanolja.com/ticket 에도 이미 노출). 포지션: 불리(예매처 URL 3단 전환기: ticket.interpark.com → nol.interpark.com → nol.yanolja.com)"
  },
  {
   "claim": "(a) 놀유니버스는 2026-04-28 '인터파크 페이', 2026-05-27 'NOL 인터파크 통합 앱'(야놀자·투어·티켓 통합판)을 종료하고 주력 앱 'NOL'로 서비스 집중 중. 단독 'NOL 티켓' 앱(App Store id440487844 / com.interpark.app.ticket)은 현재 정상 운영",
   "source": "https://www.etnews.com/20260430000312 (전자신문 2026-04-30) · https://apps.apple.com/kr/app/nol-티켓/id440487844 · https://play.google.com/store/apps/details?id=com.interpark.app.ticket",
   "confidence": "confirmed",
   "deltaVsBaseline": "신규(베이스라인 이후 발생). 야놀자 그룹의 앱 통폐합이 진행형이라는 직접 증거 — 티켓 웹 URL 구조도 후속 개편 가능성 높음. 포지션: 중립~불리(감시 대상)"
  },
  {
   "claim": "(b) 인터파크(NOL) 예매대기 서비스는 변화 없음: 좌석당 1,000원, 실예매 성공 시에만 과금(미성사 시 환불), 동일 ID당 5회 한도, 안내 후 6시간 내 우선구매, 카카오톡/SMS/이메일 알림. 레거시 ASP 가이드 URL(BookingGuide.asp?Url=guide_13.html)도 200으로 생존 — 우리 script.js의 guideUrl 그대로 유효",
   "source": "직접 확인: WebFetch https://ticket.interpark.com/TiKi/Info/BookingGuide.asp?Url=guide_13.html (200), 2026-07-03",
   "confidence": "confirmed",
   "deltaVsBaseline": "무변화(요금·한도·채널 모두 베이스라인과 동일). 포지션: 유리(공식 대기 기능 지속 = 취소표 컨시어지 안내 대상 유지, 시장 검증 계속)"
  },
  {
   "claim": "(b) 티켓링크 취소표 대기 서비스는 계속 운영 중(공식 가이드 URL 200 생존)이나, 2026-04 작성 서드파티 글은 이용료가 '구단·좌석 등급별 차등(예: 2매 3,200원)'이라고 주장 — 베이스라인의 '2,000원 고정'과 다름. 단 해당 출처는 LG를 티켓링크 구단으로 잘못 기재한 신뢰도 낮은 블로그이고, 공식 가이드는 JS 렌더링이라 원문 요금 확인 불가 → 현행 요금은 unknown",
   "source": "https://xocowriter.com/티켓링크-야구-취소표-풀리는-시간/ (2026-04-06, 신뢰도 낮음) · https://www.ticketlink.co.kr/help/guide/waitingGuide (SPA, 본문 추출 실패 — curl로 200만 확인), 2026-07-03",
   "confidence": "unknown",
   "deltaVsBaseline": "요금 구조 변경 가능성(고정 2,000원 → 구단·좌석별 차등) 신호 있으나 1차 출처 검증 실패. 앱 내 실측 또는 고객센터(1588-4567) 확인 필요. 포지션: 중립 — 단 우리 UI/문서에 '2,000원' 고정 표기는 즉시 위험"
  },
  {
   "claim": "(b) 2026 구단-예매처 매핑: LG·두산·키움=인터파크(NOL), KIA·삼성·한화·NC·KT=티켓링크, SSG=2026시즌부터 SSG닷컴(ticket.ssg.com)이 공식 판매처(구단 앱 병행), 롯데=자체 앱(ticket.giantsclub.com). LG의 인터파크 잔류는 구단 공식 채널로 확인 — 즉 베이스라인 매핑 유지, SSG만 티켓링크 이탈이 실행됨",
   "source": "LG: https://www.facebook.com/LGTWINSSEOUL/posts/1579247294201543 (2026 홈경기 인터파크 예매 안내) · SSG: https://www.shinsegaegroupnewsroom.com/ssg-landers-ssg-com-ticket-partnership/ + https://ticket.ssg.com/ · 종합: https://brunch.co.kr/@77d538f56b9b41b/51 (2026-03-18)",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 취소표대기 대상 '야구 6구단(SSG 포함)' → SSG가 SSG닷컴 직영 전환으로 티켓링크 대기 대상에서 빠졌을 가능성 높음(공식 목록 미확인=unknown). 우리 data/ticketing-calendar.json은 이미 ticket.ssg.com 사용 중 = 수정 불요. 포지션: 유리(SSG 협상 창구 단일화 유지)"
  },
  {
   "claim": "(c) NOL 티켓·티켓링크 모두 공개 성과형 어필리에이트/파트너 프로그램 여전히 미발견(미운영 추정 유지). 티켓링크는 배너 광고 지면 판매 채널(ticketlink.co.kr/advertisement)만 계속 운영",
   "source": "WebSearch 다중 질의(NOL 제휴마케팅/링크프라이스/티켓링크 파트너, 2026-07-03) 전부 공개 프로그램 부재 · https://www.ticketlink.co.kr/advertisement",
   "confidence": "likely",
   "deltaVsBaseline": "무변화(베이스라인 unknown/미운영 추정 → 재확인, 여전히 부재 증명은 불가). 포지션: 불리(예매처 어필리에이트는 계속 1차 BM 불가) — 대신 화면 내 여행/숙박 CPS 노선 유효"
  },
  {
   "claim": "(c) NHN링크 파트너 연동 API의 실재 증거(점핏 채용공고 50834353)는 2026-07-03 현재도 HTTP 200으로 접근 가능 — B2B 제휴 피드 협상 경로 유효. 또한 야놀자·여기어때 숙박 상품의 링크프라이스 CPS 어필리에이트가 운영 중임이 확인됨(우리 수익화 1순위 '여행/숙박 어필리에이트'의 실행 가능성 보강). 야놀자(NOL)와 인터파크 티켓이 같은 그룹이라 향후 NOL 통합 어필리에이트에 티켓이 포함될 가능성은 unknown",
   "source": "직접 확인: curl https://jumpit.saramin.co.kr/position/50834353 → 200 · https://www.startupn.kr/news/articleView.html?idxno=51153 (링크프라이스·야놀자·여기어때 숙박 CPS)",
   "confidence": "confirmed",
   "deltaVsBaseline": "파트너API 증거 지속(무변화). 숙박 CPS 실운영 확인은 보강 델타. 포지션: 유리(B2B 카드 유지 + 수익화 1순위 실행 가능) — 단 NOL 계열 숙박 CPS를 쓸 경우 예매처와 동일 그룹이라는 이해관계 표기에 추가 주의"
  },
  {
   "claim": "(d) 제휴 문의 채널 현황: 놀유니버스 공식 사이트에 전용 제휴/B2B 폼은 없고 nolpr@nol-universe.com(PR)·help.interpark@nol-universe.com(인터파크 CS)·NOL 티켓 고객센터 1544-1555 뿐(오늘 직접 확인). NHN링크는 membership@nhnlink.co.kr / 1588-4567(베이스라인 값, 금회 미재검증), SSG는 쓱파트너스 02-317-9542 / 081402@ssg.com + 구단 1577-3419(베이스라인 값). 어느 예매처도 셀프서브 제휴 채널 신설 없음",
   "source": "직접 확인: https://nol-universe.com/ (2026-07-03) · NHN링크/SSG 연락처: /Users/minsub/Documents/hanwha/hanwha/docs/CANCEL_TICKET_ALERT_RESEARCH.md (2026-06-11 확인분)",
   "confidence": "likely",
   "deltaVsBaseline": "무변화 + 놀유니버스 연락처 최신화. 인터파크 페이·통합앱 정리로 놀유니버스 조직이 유동적 — BD 접촉 시 수신처 변동 가능. 포지션: 중립"
  }
 ],
 "resolvedUnknowns": [
  "ticket.interpark.com/Contents/Sports 리다이렉트/폐기 여부 → 해소: 2026-07-03 현재 200·무리다이렉트로 생존, 단 canonical은 tickets.interpark.com이고 루트는 nol.interpark.com/ticket로 302 + 'NOL로 통합' 공지 게시 = 폐기 예고 단계",
  "인터파크 예매대기 정책 변동 여부 → 해소: 1,000원/좌석·성공 시 과금·5회·6시간 그대로 (무변화 확정)",
  "SSG의 티켓링크 이탈 여부 → 해소: 2026시즌 공식 판매처 = SSG닷컴(ticket.ssg.com)+구단앱 확정, 우리 데이터는 이미 반영됨",
  "NHN링크 파트너 API 증거 유효성 → 해소: 채용공고 여전히 접근 가능(200)"
 ],
 "implications": [
  "당장 코드 수정 불필요: ticket.interpark.com/Contents/Sports(62건)와 guide_13.html 딥링크 모두 생존. 단 NOL 통합 공지가 떴으므로 예매처 URL을 데이터/설정 한 곳으로 모으고(현재 ticketing-calendar.json + script.js 하드코딩 혼재), 주간 curl 리다이렉트 감시(200/302/최종 URL 로깅)를 스냅샷 갱신 루틴에 추가할 것",
  "스포츠 장르는 아직 신도메인(tickets.interpark.com/nol.interpark.com)에 없음 → 선제 URL 교체는 오히려 위험. 이관 감지 시점에 일괄 교체가 정답",
  "UI/문서에서 '티켓링크 취소표대기 2,000원' 고정 표기 금지 — 요금이 구단·좌석별 차등으로 바뀌었을 가능성(미검증). '이용료는 구단·좌석에 따라 상이, 실예매 시에만 부과' 수준으로 완화하고 FEATURE_MARKET_RESEARCH.md 3장 표(47행) 갱신 필요",
  "티켓링크 취소표대기 대상 구단 목록(베이스라인 6구단)에서 SSG 제외 여부를 앱 실측으로 확인 후 컨시어지 안내 데이터 갱신 필요 — SSG 팬에게는 ticket.ssg.com 딥링크가 정답",
  "BM 우선순위 유지: 예매처 어필리에이트 여전히 부재(1차 BM 불가), 여행/숙박 CPS(야놀자·여기어때 via 링크프라이스)는 실운영 확인 — 단 야놀자=NOL=인터파크 동일 그룹이므로 공정위 이해관계 표기 문구에 그룹 관계까지 고려",
  "B2B 접촉 카드 유효: NHN링크(파트너API 실재 지속)·SSG(창구 단일화) 우선순위 변동 없음. 놀유니버스는 조직 개편 중이라 접촉 타이밍상 후순위 권장"
 ]
}
```

## 리서치 1: 직접 경쟁사 현황 — 베이스라인 §2.1(2026-06-11) 대비 델타 (확인일 2026-07-03)

```json
{
 "dimension": "리서치 1: 직접 경쟁사 현황 — 베이스라인 §2.1(2026-06-11) 대비 델타 (확인일 2026-07-03)",
 "findings": [
  {
   "claim": "(a) 직관메이트 iOS 미출시 확정 — iTunes Search API(country=kr, entity=software)에서 '직관메이트'·'inviewmate' 모두 resultCount 0. 여전히 Android 단독.",
   "source": "https://itunes.apple.com/search?term=%EC%A7%81%EA%B4%80%EB%A9%94%EC%9D%B4%ED%8A%B8&country=kr&entity=software (2026-07-03 직접 호출, 0건)",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 'Android만' 유지·재확인. 우리 iOS 빈틈에 유리."
  },
  {
   "claim": "(a) 직관메이트 평점 4.8(리뷰 11개), 다운로드 100+ — 규모가 매우 작아 실질 위협 낮음. 베이스라인 unknown(평점·다운로드) 해소.",
   "source": "https://play.google.com/store/apps/details?id=com.inviewmate.app&hl=ko (원문 HTML JSON-LD: ratingValue 4.818, ratingCount 11, \"100+\")",
   "confidence": "confirmed",
   "deltaVsBaseline": "unknown → 해소. 정면 겹침이지만 트래킹 위협 아님. 유리."
  },
  {
   "claim": "(a) 직관메이트 취소표 기능 없음 — Play 페이지 전체(설명·리뷰·업데이트 노트 포함 1.17MB HTML)에 '취소' 단어 0회. 기능은 예매 일정 푸시 + 티켓링크 딥링크 + 직관 기록 + 응원가.",
   "source": "https://play.google.com/store/apps/details?id=com.inviewmate.app&hl=ko (원문 grep: '취소표' False, '취소' False)",
   "confidence": "confirmed",
   "deltaVsBaseline": "unknown → 해소(없음). 유리."
  },
  {
   "claim": "(a) 직관메이트 페이지 내 최신 날짜 문자열이 2025.10.16 — 2026 시즌 개막 후 업데이트 흔적 없음(유지보수 정체 추정).",
   "source": "https://play.google.com/store/apps/details?id=com.inviewmate.app&hl=ko (원문 날짜 문자열 추출: 2025.10.16, 2025.6.3)",
   "confidence": "likely",
   "deltaVsBaseline": "신규 신호. '신뢰성 있는 알림' 포지션에 유리 (단 날짜 필드 매핑은 페이지 구조상 단정 불가)."
  },
  {
   "claim": "(b) 오늘야구가 iOS 네이티브 앱 출시 — 2026-04-19 릴리즈(베이스라인 작성 6-11 직전, §2.1 미반영), v1.0.6(2026-05-21), 평점 4.7(리뷰 3개), 개발자 Dosivan. 기능: NTP 동기 0.01초 예매 타이머+PiP, 찜 경기·예매 오픈 시간의 iOS 기본 캘린더 자동 등록(로컬 캘린더 알림), 웹(yagu.today) 계정 연동(Apple/Google/카카오), 위젯 3종. 앱 설명에 서버 푸시 알림 언급 없음.",
   "source": "https://itunes.apple.com/lookup?id=6762068849&country=kr (releaseDate 2026-04-19, currentVersionReleaseDate 2026-05-21, averageUserRating 4.67, userRatingCount 3) · https://apps.apple.com/kr/app/%EC%98%A4%EB%8A%98%EC%95%BC%EA%B5%AC/id6762068849",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 '오늘야구=웹' → 뒤집힘. iOS 공백 잠식 시작 = 불리. 단 알림은 로컬 캘린더/타이머 방식이라 '서버 푸시로 잘 도착하는 알림' 빈틈은 여전히 비어 있음."
  },
  {
   "claim": "(b) 오늘야구 웹은 Web Push 아님 확정 — 메인 HTML에 serviceWorker 등록 코드 없음, /sw.js·/firebase-messaging-sw.js 모두 404. HTML 내 'push' 15회는 전부 Next.js 내부(__next_f.push)·GTM. manifest.json은 존재(standalone)하나 SVG 아이콘 1종뿐.",
   "source": "https://yagu.today/ 원문 HTML grep + curl -w %{http_code} https://yagu.today/sw.js → 404, /firebase-messaging-sw.js → 404 (2026-07-03)",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 '푸시 여부 unknown' → 웹 푸시 아님으로 해소. 유리."
  },
  {
   "claim": "(b) 오늘야구 메인에 '내 직관 — 직관 관리 + 예매 알림 구독' 카드 신설(/my-games, 로그인 후 클라이언트 렌더). 구독 알림의 실제 전달 채널은 정적 HTML에서 확인 불가 — 웹 푸시는 아니므로(SW 부재) 이메일 또는 iOS 앱 연동 알림으로 추정되나 미확인.",
   "source": "https://yagu.today/ 원문 HTML ('직관 관리 + 예매 알림 구독' href=/my-games) · https://yagu.today/my-games (36KB, 알림 관련 키워드 0회 = 로그인 후 렌더)",
   "confidence": "unknown",
   "deltaVsBaseline": "신규 기능(베이스라인엔 없던 문구). 채널 unknown 잔존 — 단 'Web Push 아님'까지는 확정."
  },
  {
   "claim": "(b) 오늘야구 Android 앱은 Play 검색에서 미발견 — iOS·웹만 운영 중으로 보임.",
   "source": "WebSearch '\"오늘야구\" 안드로이드 구글플레이 앱' (동명·유사 앱만 검출, Dosivan 발행 앱 없음)",
   "confidence": "likely",
   "deltaVsBaseline": "신규 확인. Android 쪽은 직관메이트(100+ DL)만 → 통합·크로스플랫폼 빈틈 유지."
  },
  {
   "claim": "(c) Total Base '티켓 오픈 알림 구독' = 이메일 기반 확정 — 경기별 bridge 페이지 원문에 이메일 입력창(inputNotifyEmail), localStorage 'kbo_notify_email', 알림 시점 라디오(10분/30분/1시간 전), 멤버십 등급 단계별(선예매 단계별) '알림 받기' 버튼(data-step-name/data-open-time) 존재. 로그인('이메일로 3초 가입') 필요.",
   "source": "https://www.totalbase.kr/schedules/bridge?gameId=20260825HHSK02026 원문 HTML (2026-07-03) · https://www.totalbase.kr/login",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 'Web Push인지 메일인지 unknown' → 이메일로 해소. 우리 Web Push 채널 차별성 유지 = 유리. 단 '멤버십 등급별 오픈 단계 알림' UX 깊이는 벤치마크 대상."
  },
  {
   "claim": "(c) Total Base PWA 품질: sw.js가 자체 주석으로 'PWA 설치 조건을 만족시키기 위한 더미 서비스 워커'라고 명시 — install에서 skipWaiting만, fetch는 no-op, push/notification 핸들러 전무. manifest는 standalone + 192/512 maskable 아이콘으로 설치 요건은 충족. 즉 '설치되는 껍데기 PWA'이며 Web Push 인프라 없음.",
   "source": "https://www.totalbase.kr/sw.js 원문 (더미 주석 직접 확인) · https://www.totalbase.kr/manifest.json · https://www.totalbase.kr/firebase-messaging-sw.js → 404",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 '웹+PWA' 평가에서 품질 실체 해소 — 푸시 가능 PWA 아님. 우리 '진짜 Web Push PWA' 포지션에 유리."
  },
  {
   "claim": "(d) 2026 상반기 KBO 특화 신규 진입자(티켓 알림/캘린더) 미발견 — 유일한 유의미 변화는 오늘야구 iOS 앱(2026-04). 범용 서비스로 openingticket.com('예매처별 티켓 오픈 캘린더 + 오픈 임박 알림')이 검색에 등장하나 정적 HTML(1.4KB SPA 셸)에 KBO/야구 언급 0회 — KBO 커버리지·알림 방식 unknown.",
   "source": "WebSearch 'KBO 야구 티켓 오픈 알림 앱 2026 신규 출시' 및 'KBO 예매 오픈 캘린더 티켓팅 알림 사이트 신규 상반기' · https://openingticket.com/ 원문 HTML",
   "confidence": "likely",
   "deltaVsBaseline": "신규 조사 항목. KBO 특화 신규 위협 없음 = 유리 (openingticket.com은 후속 확인 필요)."
  }
 ],
 "resolvedUnknowns": [
  "직관메이트 평점·다운로드 → 4.8/리뷰 11개, 다운로드 100+ (Play 원문 JSON-LD)",
  "직관메이트 취소표 기능 → 없음 (Play 페이지 전문에 '취소' 0회)",
  "직관메이트 iOS → 미출시 (iTunes Search API 0건)",
  "Total Base '티켓 오픈 알림 구독' 방식 → 이메일 (10/30/60분 전 선택, 로그인 필수). Web Push 아님 — sw.js는 자칭 더미",
  "오늘야구 푸시 여부 → 웹은 Web Push 아님(SW 자체가 없음). 신규 iOS 앱은 로컬 캘린더 알림+NTP 타이머 방식, 서버 푸시 설명 없음. 웹 '예매 알림 구독'의 전달 채널만 unknown 잔존"
 ],
 "implications": [
  "핵심 빈틈 '10구단 통합 + iOS 포함 + 신뢰 서버 푸시(Web Push)'는 2026-07-03 현재도 비어 있음 — 3사 모두 Web Push 미보유 확정(직관메이트=Android FCM만, Total Base=이메일, 오늘야구=SW 부재/로컬 캘린더).",
  "단 시간 창이 좁아짐: 오늘야구가 2026-04 iOS 네이티브 앱으로 iOS 공백을 먼저 치고 들어옴(NTP 정밀 타이머·PiP·캘린더 자동등록·웹 연동). 우리 PWA의 대항 논리는 '설치 장벽 없음 + 오픈 전 서버 푸시 도달'로 명확히 해야 함. iOS 캘린더 자동등록은 우리도 .ics/캘린더 연동으로 대응 가능한 저비용 기능.",
  "Total Base의 '멤버십 등급별 선예매 단계 알림 + 10/30/60분 전 선택' UX는 베이스라인 §2.2-3(선예매 개인화 빈틈)을 일부 잠식 — 다만 채널이 이메일이라 도달 즉시성에서 우리 Web Push가 우위. 시점 선택 옵션(10/30/60분)은 우리 푸시 설계(BACKEND_PUSH_PLAN.md)에 반영 권장.",
  "직관메이트는 다운로드 100+·시즌 중 업데이트 정체로 §2.1의 '정면 겹침' 위협 등급을 하향해도 됨.",
  "컴플라이언스 프레임: 3사 모두 알림·정보 레이어(비거래·비자동예매)로 동일 — 우리 불변 원칙(자동예매·스크래핑 금지, 거래 안 함)과 충돌하는 시장 관행 변화 없음. Total Base는 이메일 수집(개인정보), 우리는 익명 구독 토큰 기반 Web Push → 개인정보 최소화 포지션에서도 우위 주장 가능.",
  "후속 확인 권장: (1) 오늘야구 /my-games 알림 채널(로그인 후 실사용 확인), (2) openingticket.com의 KBO 커버리지·알림 방식, (3) 오늘야구 iOS 앱에 향후 서버 푸시 추가 여부 모니터링."
 ]
}
```

## 리서치 3: 법률/컴플라이언스 — 2026-08 시행 개정 공연법·국민체육진흥법(암표법) + 정보통신망법 §50 델타 (베이스라인 FEATURE_MARKET_RESEARCH.md §4·CANCEL_TICKET_ALERT_RESEARCH.md §3, 2026-06-11 기준)

```json
{
 "dimension": "리서치 3: 법률/컴플라이언스 — 2026-08 시행 개정 공연법·국민체육진흥법(암표법) + 정보통신망법 §50 델타 (베이스라인 FEATURE_MARKET_RESEARCH.md §4·CANCEL_TICKET_ALERT_RESEARCH.md §3, 2026-06-11 기준)",
 "findings": [
  {
   "claim": "(a) 시행일 변경 — 개정 공연법·국민체육진흥법(암표 전면금지·50배 과징금)의 실제 시행일은 2026-08-11이 아니라 2026-08-28이다. 국회 통과 2026-01-29 후 공포가 2월 말로 늦어져 '공포 후 6개월' 기산이 밀렸다. 문체부도 '8월 28일 시행'을 공식 언급.",
   "source": "https://www.sedaily.com/article/20059529 · https://www.starnewskorea.com/sports/2026/06/25/2026062418551019058 · https://sports.khan.co.kr/en/article/202606301517007/",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인·CANCEL_TICKET_ALERT_RESEARCH.md의 '2026-08-11 시행'은 낡음(당시 법무법인 뉴스레터의 조기공포 가정 기반). 프로젝트 문서 3곳(FEATURE_MARKET_RESEARCH.md, CANCEL_TICKET_ALERT_RESEARCH.md 2곳) 날짜 수정 필요. 변호사 검토 데드라인도 8/28 기준으로 재설정."
  },
  {
   "claim": "(a) 공포 경위 — 국무회의 의결 2026-02-24, 공포는 2026-02-27~28(문체부 페이지는 2/28, 인터파크 안내 요약은 2/27로 2차 출처 간 1일 상충). 공포 법률번호(법률 제○호)는 국가법령정보센터 동적 페이지 접근 실패로 원문 미확인 — unknown 유지.",
   "source": "https://www.ajunews.com/view/20260224133201629 (국무회의 2/24) · https://www.mcst.go.kr/site/s_policy/govPolicy/performView.jsp?pSeq=1115 (공포 2/28) · https://biz.heraldcorp.com/article/10785058 ('2월 말 공포')",
   "confidence": "likely",
   "deltaVsBaseline": "베이스라인 unknown('공포 법률 번호·부칙') 부분 해소: 공포일은 2월 말로 특정, 부칙 기산(공포 후 6개월→8/28) 확인. 공포번호 자체는 여전히 unknown — 법령정보센터 관보 직접 확인 필요(변호사 검토 시 함께)."
  },
  {
   "claim": "(a) 조문 확정 — 공연법 제4조의2(부정판매 금지)·제4조의3(신고기관), 국민체육진흥법 제6조의2. 부정구매='정보시스템의 보안조치를 기술적으로 우회하는 등 공정한 구입 과정을 우회·방해하여 재판매를 목적으로 구매', 부정판매='판매자 동의 없이 구입가 초과 금액으로 상습·영업적 판매·알선'. 판매금액 50배 이하 과징금+몰수·추징, 신고기관에 자료제출 요구권(거부 시 과태료 500만원), 신고포상금 신설.",
   "source": "https://www.shinkim.com/kor/media/newsletter/3154 · https://www.lawtimes.co.kr/news/articleView.html?idxno=217253",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 unknown이던 국민체육진흥법 조문번호(제6조의2)가 2차 출처 다수로 재확인됨. 부정구매·부정판매 모두 '재판매 목적/판매 행위' 요건 — 거래 없는 알림·정보 서비스는 구성요건 자체에 해당 없음(유리)."
  },
  {
   "claim": "(a) 시행령 진행 상황 — 개정법 위임사항(기술적·관리적 조치, 과징금 산정, 신고기관 지정) 시행령 개정안이 입법예고 중이며 의견제출 기한 2026-07-06(오늘 07-03 기준 아직 열려 있음). 초안 내용: 통신판매중개업자(플랫폼)에 부정판매 여부 자체 판단 후 게시물 삭제·거래제한 의무 부과, 과징금 산정 시 반복성·영업성·실제 이득 고려. 문체부 연구용역(2026-02~05) 후 성안. 확정 공포는 아직 안 됨 — 최종 확정 내용은 unknown.",
   "source": "https://biz.heraldcorp.com/article/10785058 (기한 7/6) · https://www.ddaily.co.kr/page/view/2026062911223899665 (초안 플랫폼 의무) · https://sports.khan.co.kr/en/article/202606301517007/ (과징금 기준·학회 논의) · https://www.mcst.go.kr/kor/s_notice/notice/noticeView.jsp?pSeq=13480 (입법예고 공고, 본문 동적 렌더링으로 미확인)",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인에는 시행령 존재 자체가 없던 신규 정보. 의무 주체는 '입장권 판매자·통신판매중개업자'로 한정 — 예매를 중개하지 않는 우리는 의무 대상 아님(유리). 단 향후 양도·거래 게시 기능을 붙이면 중개업자 의무 트리거 위험(불리 잠재)."
  },
  {
   "claim": "(b) 알림·정보 서비스 영향 — 개정법·시행령 초안·전문가 논의(한국스포츠엔터테인먼트법학회 2026-06-30, 디지털데일리 2026-06-29) 어디에도 '거래 없는 알림·정보 서비스'를 규율하는 내용 없음. 규제 초점은 (1)재판매 목적 부정구매 (2)웃돈 재판매 (3)판매자·중개플랫폼 의무. 업계 우려도 중고나라·번개장터 등 '거래 중개' 플랫폼의 판단 책임에 집중. 문체부는 2026-01-05~06-16 신고 데이터로 프로야구 포함 암표상 15명을 6/23 경찰 수사 의뢰 — 단속은 '판매자' 대상.",
   "source": "https://www.ddaily.co.kr/page/view/2026062911223899665 · https://sports.khan.co.kr/en/article/202606301517007/ · https://www.starnewskorea.com/sports/2026/06/25/2026062418551019058",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인의 '규제 강화가 오히려 우리 포지션 안전성을 높인다' 판단이 시행령 단계에서도 유지·강화됨(유리). 추가 델타: 신고기관 지정·신고포상금 신설로 '암표신고센터 안내' 컨시어지 기능의 근거가 법정 제도로 격상 — 안내 대상 기관이 8/28 이후 '문체부 지정 신고기관'으로 공식화될 예정이므로 앱 내 안내 링크를 그때 갱신해야 함."
  },
  {
   "claim": "(c) 예매처 안티봇 강화 — NHN링크(티켓링크)는 에버스핀 'Eversafe' 도입으로 매크로뿐 아니라 '스크래핑(자동화된 정보 수집)'을 명시적으로 실시간 차단 대상으로 공표(다중 기기 동시접속·조작된 IP/브라우저 식별). 2026-05-13 경찰청 국가수사본부와 '매크로 부정예매 메커니즘 분석' 설명회 개최(사이버수사관 70명), 경찰청 감사장 수상, 문체부·경찰청과 암표방지 민관협의체 참여. 인터파크는 매크로 등 비정상 예매에 3개월 이상 예매제한·영구정지·예매 전체취소 제재 기준 운영. 개정법이 판매자 기술적 조치를 '법적 의무'로 만들어 안티봇은 더 강화될 전망.",
   "source": "https://www.geconomy.co.kr/news/article.html?no=302189 (Eversafe, 스크래핑 차단 명시) · https://www.newspim.com/news/view/20260514001092 (경찰청 협력) · http://ticket.interpark.com/TiKi/Info/BookingGuide.asp?Url=guide_18.html (인터파크 제재 기준)",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인의 'CAPTCHA·계정차단 운영 중' 대비 격상: 스크래핑이 차단 대상으로 '명시'되고 예매처-경찰 직접 협력 채널이 생김. 자동화 조회는 기술 차단 즉시+형사 리스크(정통망법 §48)+제휴 영구 소멸 3중 리스크로, '제휴 전 상태 감시 전면 보류' 판정을 유지·강화(우리 원칙에 유리 — 경쟁자도 못 함). 컨시어지 안내 문구에 반영할 것: ①본 서비스는 예매를 대행·자동화하지 않고 공식 예매처로 연결만 함 ②매크로·자동화 프로그램 사용 시 예매취소·계정 영구정지 및 2026-08-28부터 형사처벌·50배 과징금 대상 ③정가 초과 양도(웃돈 재판매)는 매크로 무관 전면 불법 ④암표는 신고기관(암표신고센터)에 신고 안내."
  },
  {
   "claim": "(d-1) 정보통신망법 대개정 — 2026-03-12 국회 통과, 03-24 국무회의 의결: 불법스팸(광고성 정보 위반) 전송자·방지의무 소홀 사업자에 기존 과태료와 별도로 '관련 매출액 6% 이하 과징금' 신설 + 부당이익 몰수·추징 + 대량문자 전송자격인증 사업자 위탁 의무. 시행은 공포 후 6개월(2026 하반기, 정확한 시행일 unknown). 과태료 기준(§76): 사전동의·(광고) 표기·야간전송 위반 1회 750만/2회 1,500만/3회 3,000만원.",
   "source": "https://www.korea.kr/news/policyNewsView.do?newsId=148961427&call_from=rsslink · https://blog.bizgo.io/trend/telecom-business-act-amendment-spam-penalty/ · https://www.korea.kr/news/policyNewsView.do?newsId=148961346&call_from=rsslink",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 '위반 과태료 최대 3천만원'에서 '매출액 6% 과징금+몰수·추징'으로 제재 상한이 구조적으로 격상(신규). BACKEND_PUSH_PLAN의 '정보성 전용, 광고성 푸시 금지' 정책의 가치가 커짐(유리) — 반대로 어필리에이트 등 광고성 수익화를 푸시에 얹으면 리스크가 종전보다 훨씬 큼(불리 잠재). '광고성 금지' 정책 명문화(BACKEND_PUSH_PLAN 8장 #5)를 미룰 이유가 없어짐."
  },
  {
   "claim": "(d-2) KISA '불법스팸 방지를 위한 정보통신망법 안내서' 제7차 개정본(2026-03-04 게시) — ①수신동의 UI에서 '혜택 알림'·'정보제공' 등 모호한 표현으로 광고 수신동의를 받는 것 금지(동의 무효 리스크) ②앱푸시 광고 수신거부 시 로그인 등 복잡한 절차 요구 불가 ③쿠폰·마일리지·적립금을 일방 제공한 뒤 발급·소멸 안내를 보내는 것도 광고성 — 사전 명시적 동의 필요. 정보성(사용자가 직접 구독한 예매 오픈 알림 등) vs 광고성 이분 구조 자체는 유지.",
   "source": "https://www.cela.kr/4/?bmode=view&idx=170326647 (제7차 개정본 요약) · https://developers.fingerpush.com/app-push/guide/ads (앱푸시 광고 실무 기준)",
   "confidence": "likely",
   "deltaVsBaseline": "베이스라인엔 없던 신규 해석 기준. 우리 온보딩·설정 화면에 직접 반영 필요: 알림 구독 동의 문구를 '예매 오픈 알림'처럼 내용을 특정해 명명하고 '혜택 알림' 류 포괄 문구 금지, 알림 해제는 원탭으로. KISA 원문 PDF는 직접 확인 못 함(법무법인 요약 의존) — 구현 직전 KISA 원문 대조 권장."
  },
  {
   "claim": "(d-3) 집행 주체 개편 — 불법스팸 조사·단속 주체가 방송통신위원회에서 '방송미디어통신위원회'(kmcc.go.kr)로 개편됨. 위반 시 과태료 부과 또는 검찰송치. 정보성 푸시 자체에 대한 새로운 규제·집행 사례는 확인되지 않음(unknown — '정보성 푸시가 문제된 집행 사례 없음'을 부존재로 단정할 수는 없음).",
   "source": "https://www.kmcc.go.kr/user.do?page=A04100207&dc=K04100207",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인의 '방통위' 표기는 기관명 갱신 필요. 정보성/광고성 경계에 대한 법 개정은 없고 안내서(7차)로 광고성 판정 범위가 실무적으로 넓어지는 방향 — '조금이라도 영리 색이 있으면 광고성으로 보수적 분류' 원칙이 안전."
  },
  {
   "claim": "(추가·b/c 공통) 2차 티켓시장 규제 역풍 논의 — 정가 초과 재판매 전면금지가 글로벌 추세(규제된 리세일 허용) 대비 강력해 시장 음성화·해외 플랫폼 풍선효과 우려가 학계·업계에서 제기됨(디지털데일리 2026-06-29, 헤럴드경제). 향후 시행령 보완·재개정 가능성 있음.",
   "source": "https://www.ddaily.co.kr/page/view/2026062911223899665 · https://biz.heraldcorp.com/article/10785058",
   "confidence": "confirmed",
   "deltaVsBaseline": "신규 맥락. 우리에게 중립~유리: 리세일 모델 이식 불가 판정(베이스라인 §4)은 더 굳어졌고, '거래 안 하는 정보 레이어' 포지션의 상대적 안전성이 재확인됨. 단 법이 재개정되어 '규제된 리세일'이 허용되더라도 우리 원칙(거래 안 함)은 유지가 전제."
  }
 ],
 "resolvedUnknowns": [
  "베이스라인 unknown '2026-08-11 시행 개정법의 공포 법률 번호·부칙' → 부분 해소: 공포일 2026-02-27~28, 부칙 기산으로 실제 시행일은 2026-08-28(8-11 아님, 다수 출처 교차 확인). 공포번호 자체는 여전히 unknown(법령정보센터 동적 페이지 접근 실패 — 관보/변호사 검토 시 확인).",
  "베이스라인 unknown '국민체육진흥법 매크로 조항의 정확한 조문 번호' → 제6조의2로 재확인(공연법은 제4조의2·제4조의3) — 단 여전히 법무법인 뉴스레터 등 2차 출처 기반, 법령 원문 직접 대조는 미완.",
  "시행령 위임 내용(기술적·관리적 조치의 구체) → 초안 확인: 판매자·통신판매중개업자 대상, 플랫폼의 부정판매 게시물 자체 판단·삭제·거래제한 의무. 입법예고 의견제출 기한 2026-07-06, 최종 확정본은 unknown(8/28 전 재확인 필요).",
  "정보통신망법 §50 최신 동향 → 2026-03 개정(매출액 6% 과징금·몰수추징) + KISA 안내서 7차 개정(2026-03-04, 모호한 동의 문구 금지·앱푸시 수신거부 간소화) + 집행기관 방송미디어통신위원회로 개편 확인. 정보성 푸시가 직접 문제된 집행 사례는 발견 못 함(unknown)."
 ],
 "implications": [
  "문서 수정(즉시): FEATURE_MARKET_RESEARCH.md §4·CANCEL_TICKET_ALERT_RESEARCH.md(§3.1, §7)·관련 문구의 시행일 '2026-08-11' → '2026-08-28'로 일괄 수정하고, '방통위' → '방송미디어통신위원회' 기관명 갱신.",
  "컨시어지 안내 문구(P1 예매 오픈 알림에 동봉): ①KBO TIDO는 예매를 대행·자동화하지 않으며 공식 예매처로 연결만 한다 ②매크로·자동화 프로그램 이용은 예매취소·계정 영구정지 대상이며 2026-08-28부터는 매크로 여부와 무관하게 부정구매·웃돈 재판매가 전면 불법(판매금액 50배 이하 과징금·몰수추징) ③정가 초과 양도 티켓은 사지도 팔지도 말 것 ④암표 발견 시 암표신고센터(8/28 이후 문체부 지정 신고기관) 신고 — 신고포상금 제도 신설.",
  "푸시 온보딩/동의 UX(BACKEND_PUSH_PLAN 반영): 구독 동의 문구를 '예매 오픈 알림' 등 내용 특정형으로 작성('혜택 알림'·'정보제공' 류 포괄 문구 금지 — KISA 7차 안내서), 해제는 원탭, '정보성 전용·광고성 푸시 금지' 정책을 지금 명문화(개정 정통망법 매출액 6% 과징금으로 위반 비용 격상 — 8장 미해결 #5를 결정으로 전환 권고).",
  "전략 포지션 재확인: 개정법·시행령 모두 '거래·중개' 행위를 규율 — 거래 안 하는 알림·정보 레이어는 규제 밖(유리). 단 양도·동행 티켓 거래 게시판 등 커뮤니티형 기능은 통신판매중개업자 의무(게시물 자체 판단·삭제)를 트리거할 수 있으므로 로드맵 배제 유지.",
  "자동화 조회 금지 재강화: 티켓링크가 '스크래핑'을 명시적 실시간 차단 대상으로 공표하고 경찰청과 직접 협력 — 제휴 전 잔여석/취소표 자동 감시는 기술·형사·제휴 3중 리스크로 전면 보류 판정 유지.",
  "기회(선택, 기한 임박): 시행령 입법예고 의견제출이 2026-07-06 마감 — '알림·정보 서비스는 규제 대상이 아님을 명확화해달라'는 의견 제출 가능(효익 낮음, 비용 낮음). 불참해도 리스크 없음.",
  "후속 검증 루프(8/28 전): 공포 법률번호·부칙 원문(관보), 시행령 확정 공포본, KISA 안내서 7차 원문 PDF, 문체부 지정 신고기관 명단 — 변호사 검토 1회에 묶어서 처리 권장."
 ]
}
```

## confirmed

```json
{
 "verdict": "confirmed",
 "proof": "1차 출처인 KBO 공식 티켓 안내(https://www.koreabaseball.com/kbo/league/map.aspx, 2026-07-03 WebFetch 확인)가 한화·KIA·삼성 = 티켓링크, 롯데 = 구단 자체(ticket.giantsclub.com)로 명시 — 주장 (c)의 4개 매핑 전부 일치. 보강 증거: KIA 티켓링크 URL sports/137/58 은 검색 결과 제목 '기아 타이거즈'로 실재 확인(한화는 137/63, 삼성은 137/57); ticket.giantsclub.com 은 라이브 사이트로 확인되고 2026 시즌 가이드들(xocowriter.com 2026 KBO 가이드, many-information.com 삼성 2026, sportstrends.co.kr 롯데 2026)이 동일 예매처 + 2026 신규 정책(롯데 컬러프라이스, 삼성 시리즈 단위 오픈)까지 기술 — 변경 징후 없음. 원출처 brunch 글은 2차(블로그)지만 KBO 공식 페이지가 이를 대체 검증. 과장/오독 없음. [부수 발견, 주장 범위 외] KBO 공식 페이지는 LG를 티켓링크로 분류 — 베이스라인 문서 63행의 'LG·두산·키움 인터파크'와 상충하므로 LG 예매처 주장은 별도 재검증 필요. 포지션 영향: 유리(공식 1차 출처로 예매처 매핑 인용 가능, 스크래핑 불요)."
}
```

## 리서치 6: 수익화 (베이스라인 FEATURE_MARKET_RESEARCH.md §5 델타, 확인일 2026-07-03)

```json
{
 "dimension": "리서치 6: 수익화 (베이스라인 FEATURE_MARKET_RESEARCH.md §5 델타, 확인일 2026-07-03)",
 "findings": [
  {
   "claim": "(a) 아고다 파트너스 커미션은 예약 건수 티어제로 약 4%(~50건)/4.5%(51~300건)/5%(300건+)이며, 과거 최대 7%에서 하향된 구조. 가입은 여전히 개방형(웹사이트/앱 보유 퍼블리셔). 공식 FAQ 페이지는 WebFetch 시 콘텐츠가 비어 반환되어 정확한 현행 요율표의 1차 출처 직접 확인은 실패 — 요율 수치는 2차 출처(2025년 한국어 가이드 블로그) 기반",
   "source": "https://3hoursahead.inblog.ai/아고다-파트너스-수익을-2배-올리는-방법-2025년-최신-39384 · https://inblog.ai/3hoursahead/아고다-파트너스-과연-좋을까-가입-방법부터-예상-수익까지-38035 · 공식(콘텐츠 미확인): https://partners.agoda.com/ko-kr/faq.html",
   "confidence": "likely",
   "deltaVsBaseline": "베이스라인은 '아고다 즉시 가입 가능'만 언급, 요율 미기재. 델타: 요율 4~5% 티어제 + 과거 대비 하향 추세 확인(수익성 기대치 낮춰야). 원칙 양립: 유리(클릭만, PII 없음) — 변화 없음"
  },
  {
   "claim": "(a) Booking.com은 2025년 5월 직접 어필리에이트 프로그램을 사실상 종료 — 월 커미션 €1,000 미만 소형 파트너 수천 곳을 30일 통지로 정리하고 Awin/CJ 등 서드파티 네트워크 경유로 전환시킴. 소형 신규 서비스가 글로벌 OTA 직계약으로 진입하는 문은 좁아지는 추세",
   "source": "https://skift.com/2025/05/30/why-booking-com-cut-thousands-of-affiliate-partners-and-what-comes-next/ · https://www.phocuswire.com/booking-terminates-partnerships-content-creators · https://www.affiversemedia.com/booking-com-suddenly-ends-affiliate-partnerships-what-travel-bloggers-need-to-know/",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인에 없던 신규 사실. 시사점: OTA 직계약 리스크(일방 해지) 실증 사례 → 아고다 단독 의존보다 링크프라이스 같은 국내 네트워크 병행이 리스크 헤지. 포지션 영향: 중립(정보 레이어 원칙과 무관하나 BM 안정성에 경고)"
  },
  {
   "claim": "(a) 링크프라이스에 야놀자·여기어때 숙박 머천트가 CPS로 입점(2025-03 제휴 보도 확인) — 국내 원정 직관 숙소(국내 숙박) 시나리오에 아고다(해외 위주)보다 정합적인 국내 CPS 경로가 열림. 단 머천트별 정확한 커미션율은 로그인 필요로 미확인(unknown)",
   "source": "https://www.startupn.kr/news/articleView.html?idxno=51153 · https://v.daum.net/v/20250319113704968?f=p · https://www.linkprice.com/views/affiliateguide/guide02.html",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인은 '링크프라이스 즉시 가입'만 언급. 델타: 야놀자·여기어때 CPS 경로 확인 — 국내 구장 원정(대전→잠실 등) 숙박 수요와 직결되어 시나리오 적합성 상향. 포지션 영향: 유리(화면 내 링크만, 자동화·PII 불요)"
  },
  {
   "claim": "(a) 쿠팡파트너스 수수료는 기본 3%, 카테고리 차등(가전·도서 3%, 패션·뷰티·식품 5%, 여행·프로모션 최대 8%) 구조 유지 — 관람용품(우비·방석) 보조 라인 전제 변화 없음",
   "source": "https://www.beetlekim.com/entry/kupang-pateuneseu-susuryo · https://partners.coupangcdn.com/partners-guide/partners-guide-20240716100922.pdf",
   "confidence": "likely",
   "deltaVsBaseline": "베이스라인 B모델(굿즈 어필리에이트) 전제 유지 — 유의미한 정책 변화 미발견. 원칙 양립: 유리"
  },
  {
   "claim": "(b) 국내 야구 팬 지불의사 앵커(중계 기준): TVING 광고형 스탠다드 월 5,500원(연간권 시 월 약 4,100~4,158원)이 KBO 시청 최저가이고, SPOTV NOW는 베이직 월 9,900원/프리미엄 월 19,900원. 즉 '야구에 돈 내는' 검증된 가격대는 월 4천~2만원이지만 전부 중계 콘텐츠 대가이며, 일정·기록·알림 등 정보-only 앱의 국내 유료 구독 성공 사례는 이번 조사에서도 미발견(unknown 유지)",
   "source": "https://m.card-gorilla.com/contents/detail/2815 · https://pickle.plus/blog/kbo-프로야구-보려면-티빙-광고형-스탠다드-vs-프리미엄-요금제-비교-48517 · https://kakao.spotvnow.co.kr/ · https://www.mt.co.kr/tech/2026/05/22/2026052114413724289",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 E모델의 '지불의사 unknown' 판단 유지·보강. 델타: 구체 가격 앵커 확보 — 프리미엄 구독을 붙인다면 심리적 상한은 중계 최저가(월 5,500원)보다 확실히 낮아야 함(월 1,000~3,000원대 가설). 포지션 영향: 중립"
  },
  {
   "claim": "(c) '예매 오픈 알림' 단독 기능의 유료화 사례는 국내외 모두 사실상 부재 — 인터파크(NOL) 티켓캐스트, 티켓링크 앱 알림, Bandsintown/SeatGeek/Ticketmaster 알림 모두 무료 기본 제공. 유료화된 것은 알림 자체가 아니라 인접 가치: presale.codes는 프리세일 '코드 열람'을 월 $6.95(연 $29.95, 첫해 $10 프로모션)에 판매(알림은 무료), TicketFlipping 등은 리셀러/브로커용 모니터링 툴박스를 월 구독으로 판매",
   "source": "https://presale.codes/pricing · https://www.ticketalerts.app/ · https://ticket.interpark.com/TiKi/Info/BookingGuide.asp?Url=guide_10.html · https://www.concertsandtickets.com/blog/ticket-alert-tools-guide/ · https://ticketflipping.com/ticketflipping-toolbox/",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 unknown('예매 오픈 푸시 단독 가치의 구독 지불의사')을 부분 해소: 글로벌에서도 순수 오픈 알림은 무료 규범이며, 유료 전환된 사례는 코드 판매·브로커 툴 등 우리 불변 원칙(자동화·우회 금지)과 충돌하는 인접 영역뿐. 시사점: 오픈 푸시는 무료 코어(획득 엔진)로 두고 과금은 편의 묶음(다구단·우선순위·광고제거)에 붙여야 함. 포지션 영향: 원칙 준수 포지션에 유리(유료화 유혹 영역이 곧 금지 영역임을 재확인)"
  },
  {
   "claim": "(d) 공정위는 2025-12-02 「추천보증심사지침 안내서: Q&A로 알아보는 경제적 이해관계 표시」 개정본 배포 — 2024-12 개정 지침 반영: 표시문구는 게시물 제목 또는 첫 부분에 공개, '미래·조건부 대가'(경품 응모·우수후기 선정 목적 게시 등)도 표시 의무 대상으로 명시. 어필리에이트 링크 노출 화면에는 경제적 이해관계 문구(예: '링크로 구매 시 수수료를 받습니다')를 링크 인접·선행 위치에 배치해야 함",
   "source": "https://www.ftc.go.kr/www/selectBbsNttView.do?pageUnit=10&pageIndex=1&searchCnd=all&key=12&bordCd=3&searchCtgry=01,02&nttSn=46709 · https://v.daum.net/v/20251202100149941 · https://www.law.go.kr/행정규칙/추천·보증등에관한표시·광고심사지침",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인 출처(2026-06-11 확인, nttSn=46709)와 동일 문서 계열이나 2025-12-02 개정본 배포 사실과 '미래·조건부 대가 표시 의무' 구체화가 델타. 시사점: 앱 내 숙소 추천 카드에 표기 카피를 제목/첫 부분 규칙에 맞춰 설계 필요. 포지션 영향: 유리(표기만 하면 됨, 화면 내 추천 + 푸시 분리 전략 그대로 유효)"
  },
  {
   "claim": "(c 보조) 광고성 푸시 규제 전제(정통망법 §50: 사전 별도 수신동의+제목 (광고) 표기, 어필리에이트 푸시 금지 → 서비스 알림/광고 채널 분리)는 변경 근거 미발견 — 베이스라인 결론 유지",
   "source": "베이스라인 /Users/minsub/Documents/hanwha/hanwha/docs/FEATURE_MARKET_RESEARCH.md §5 (원출처 https://www.law.go.kr/LSW/lsLawLinkInfo.do?lsId=000030) — 개정 시그널 검색에서 미발견",
   "confidence": "likely",
   "deltaVsBaseline": "델타 없음(규제 완화·강화 시그널 미발견). 포지션 영향: 유리 전제 유지"
  }
 ],
 "resolvedUnknowns": [
  "베이스라인 unknown '예매 오픈 푸시 단독 가치의 구독 지불의사' → 부분 해소: 국내외 모두 순수 오픈 알림은 무료가 규범(인터파크 티켓캐스트·티켓링크·Bandsintown·TicketAlerts.app 등 무료). 유료 사례는 프리세일 코드 판매(presale.codes 월 $6.95)·브로커 툴(TicketFlipping)뿐이며 이는 자동화·우회 금지 원칙과 충돌 영역 → 오픈 푸시 단독 유료화는 사실상 근거 없음, 과금은 편의 번들로",
  "베이스라인에 없던 사실: Booking.com 2025-05 소형 직계약 어필리에이트 대량 해지(Awin/CJ 이관) — OTA 직계약 단명 리스크 확인",
  "링크프라이스 경유 야놀자·여기어때 국내 숙박 CPS 경로 존재 확인(2025-03 제휴) — 국내 원정 숙소 시나리오 정합성 상향. 단 머천트별 커미션율은 여전히 unknown(로그인 필요)",
  "국내 스포츠 정보-only 앱의 유료 구독 성공 사례 → 여전히 unknown(미발견). 대신 지불의사 앵커 확보: TVING 광고형 월 5,500원(KBO 시청 최저가)·SPOTV NOW 9,900/19,900원 — 정보 앱 구독은 이보다 크게 낮아야 한다는 상한 근거",
  "아고다 파트너스 현행 요율의 1차 출처 직접 확인 실패(공식 FAQ 페이지 콘텐츠 미반환) — 2차 출처 기준 4~5% 티어제, 가입 전 파트너 대시보드에서 재확인 필요"
 ],
 "implications": [
  "수익화 1순위(여행/숙박 어필리에이트) 유지하되 채널 구성 수정: 아고다 단독보다 링크프라이스(야놀자·여기어때 국내 숙박 CPS) 우선 + 아고다 보조가 국내 원정 시나리오·플랫폼 리스크(Booking.com식 일방 해지) 양면에서 우월",
  "프리미엄 구독 설계 시 '오픈 푸시 자체'를 유료벽 뒤에 두지 말 것 — 글로벌 규범상 무료 기대 기능이며, 유료화된 인접 사례는 전부 원칙 충돌 영역. 과금 대상은 다구단 동시 알림·우선 발송·광고 제거 같은 편의 번들, 가격 가설은 월 1,000~3,000원대(중계 최저가 5,500원 하회)에서 검증 탭으로 측정",
  "어필리에이트 표기 카피는 2025-12 개정 안내서 기준으로 확정: 추천 카드 제목/첫 부분에 '수수료를 받을 수 있음' 명시 + 링크 인접 배치, 그리고 광고성 내용은 푸시 채널에 절대 미탑재(§50) — BACKEND_PUSH_PLAN 8장 #5(채널 분리 명문화)와 묶어 문서화 권장",
  "베이스라인 §5 표의 A모델 메모 갱신 필요: 아고다 요율 4~5% 티어제(과거 7%에서 하향), Booking.com 직계약 종료(2025-05), 링크프라이스 야놀자·여기어때 입점(2025-03), 공정위 안내서 2025-12 개정 — 4건이 문서 반영 대상 델타"
 ]
}
```

## 리서치 5: 플랫폼/기술 (iOS Web Push · Android/Chrome Web Push · PWA 스토어 등재 · Cloudflare Workers cron)

```json
{
 "dimension": "리서치 5: 플랫폼/기술 (iOS Web Push · Android/Chrome Web Push · PWA 스토어 등재 · Cloudflare Workers cron)",
 "findings": [
  {
   "claim": "(a-iOS26) iOS 26/iPadOS 26(Safari 26.0)부터 홈 화면에 추가한 '모든' 사이트가 manifest 없이도 기본으로 웹앱(standalone)으로 열린다. 'installability' 요건이 사실상 0이 됐고, 사용자가 추가 시 'Open as Web App' 토글로 끌 수도 있다. WebKit 공식 블로그 원문 인용: \"By default, every website added to the Home Screen opens as a web app.\"",
   "source": "https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ (보조: https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인(2026-06-11)·BACKEND_PUSH_PLAN §3에는 없던 신규 사실. '홈 화면 추가 = 설치형 PWA' 진입 장벽이 낮아져 iOS 설치 안내 UX(P0 soft-prompt 선행 단계)의 마찰이 줄어든다. [유리] — 알림·정보 레이어 포지션 그대로 강화"
  },
  {
   "claim": "(a-iOS26) Web Push가 '홈 화면 설치 후에만 가능'한 iOS 제약 자체는 iOS 26에서도 유지된다(일반 Safari 탭 푸시 불가). Safari 26.0 릴리즈 노트에 Web Push/알림 관련 변경 언급 없음.",
   "source": "https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ · https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide · https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en",
   "confidence": "confirmed",
   "deltaVsBaseline": "변화 없음 — BACKEND_PUSH_PLAN §3의 '설치형 PWA에서만 푸시' 전제 유효. iOS 설치 안내 스텝 카드는 여전히 필요하되, 위 항목 덕에 '추가만 하면 웹앱' 이라 안내 문구를 단순화 가능. [중립~유리]"
  },
  {
   "claim": "(a-DWP) Declarative Web Push 채택 현황: iOS/iPadOS 18.4+(2025-03, 설치형 웹앱), macOS 15.5/Safari 18.5+(2025-05, 일반 Safari 탭 포함)에서 지원. 2026년 4월 기준 W3C Working Draft로 Push API 본 스펙에 통합됐고, Apple(Marcos Cáceres)+Mozilla(Kagami Rosylight) 공동 에디터십. Mozilla 표준 포지션 'positive'(2025-02). Chrome·Firefox는 아직 미출시(버그 트래커 단계).",
   "source": "https://aimtell.com/blog/state-of-declarative-web-push-2026 · https://pushpad.xyz/blog/declarative-web-push · https://whatpwacando.today/declarative-web-push/",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인은 'Safari 18.4 신메커니즘, 후속 최적화로 보류'까지만 기술. 델타: W3C 표준화 진전 + Mozilla positive + 포맷이 SW push와 하위호환(미지원 브라우저는 SW로 라우팅)이라 '지금 선언형 페이로드 포맷으로 발송해도 리스크 0'이라는 점이 확정됨. [유리] — X0 발송 페이로드를 처음부터 DWP JSON 스키마(title/navigate 등)로 설계하면 iOS 신뢰성(SW 실패 시 OS 폴백 표시) 공짜 획득"
  },
  {
   "claim": "(b-Chrome) 2026-01부터(Chrome 144/145 시기) Chrome이 Push API 요금제한(rate limit) 도입: '저관여+고발송' 사이트로 매일 판정되면 분당 최소 1,000건 상한, 초과분 HTTP 429. 재범 시 1일→7일→14일 제한 에스컬레이션, 42일 무위반 시 리셋. 판정 3축 = 발송량 대비 체류시간, 권한 프롬프트 빈도, 사이트 관여도(foreground minutes). Notifications API(포그라운드)는 비대상.",
   "source": "https://developer.chrome.com/blog/web-push-rate-limits (1차) · https://izooto.com/blog/chrome-2026-web-push-update-what-it-means-for-publishers · https://pushpushgo.com/en/blog/google-chromes-new-notification-policy",
   "confidence": "confirmed",
   "deltaVsBaseline": "베이스라인에 전혀 없던 신규 정책. 우리 규모(수천 구독, 개인화·저빈도 예매 오픈 알림)는 분당 1,000건 문턱과 무관하고 '관여 높은 정시 알림'이라 판정 대상 아님. 오히려 스팸성 경쟁 푸시가 억제돼 [유리]. 단 X0 발송 워커에 429 응답 처리(백오프)는 방어적으로 넣을 것"
  },
  {
   "claim": "(b-Chrome) Chrome은 최근 상호작용 없는 사이트의 알림 권한을 사용자별로 자동 회수(auto-revocation)하고, Android에서는 온디바이스 ML 스팸 경고 + 알림 스와이프 시 '구독해지' 버튼(2024-10 롤아웃)을 제공. izooto 기사에 따르면 자동 회수는 설치형 PWA에는 적용되지 않음.",
   "source": "https://developer.chrome.com/blog/web-push-rate-limits (자동회수 언급) · https://izooto.com/blog/chrome-2026-web-push-update-what-it-means-for-publishers (PWA 예외) · https://pushalert.co/blog/google-chrome-update-android-safety-tools-unsubscribe-button/ (unsubscribe 버튼) · https://www.forbes.com/sites/zakdoffman/2025/10/14/google-quietly-upgrades-chrome-for-all-3-billion-android-users/",
   "confidence": "likely",
   "deltaVsBaseline": "신규. 'PWA는 자동회수 예외'는 3rd-party 단일 출처라 likely로 표기(1차 Chrome 문서에서 명시 문구 미확인). 함의: Android에서도 브라우저 탭 구독보다 '설치형 PWA 구독'을 유도하는 편이 구독 생존율에 유리 → 우리 PWA-first 전략과 정합. 또한 시즌 오프 등 장기 무상호작용 시 권한 자동 소멸 가능 → pushsubscriptionchange + 구독 상태 재확인 UX 필요. [조건부 유리]"
  },
  {
   "claim": "(c-스토어) TWA/PWABuilder 경로의 Google Play 등재 정책은 2025–2026 큰 변화 없음: TWA + Digital Asset Links + manifest/HTTPS/SW 요건 유지, PWABuilder가 Bubblewrap 기반 패키징 계속 지원(메인 repo 통합). iOS 쪽은 PWABuilder WebView 래퍼가 Apple 가이드라인 4.2(최소 기능성) 리뷰를 추가 네이티브 기능 없이는 통과 못 할 수 있다는 평가 지속.",
   "source": "https://www.mobiloud.com/blog/publishing-pwa-app-store · https://developers.google.com/chromeos/app-development/publish/pwa-in-play · https://github.com/pwa-builder/pwabuilder-google-play · https://blog.pwabuilder.com/docs/android-platform/",
   "confidence": "likely",
   "deltaVsBaseline": "베이스라인 미다룸(신규 조사 축). '변화 없음'의 부정 증명은 어려워 likely. 함의: 직관메이트(Android 단독)와의 격차 좁히기용으로 나중에 TWA로 Play 등재하는 옵션이 계속 열려 있음 — 단 TWA 내 알림은 사이트의 Web Push 그대로라 X0 아키텍처 변경 불요. [중립~유리]"
  },
  {
   "claim": "(d-cron) Cloudflare Workers Cron Triggers 정밀도: 공식 문서는 'UTC 기준 스케줄 실행'만 명시하고 초 단위 발화 시각 보장은 없음. 분 단위 스펙이며, 3rd-party 실무 가이드는 '지정된 분 내 발화하되 정확한 초는 아님, ±30초 변동 감안' 권고. cron 변경(추가/수정/삭제)은 글로벌 전파에 최대 15분 소요. 초 단위 정밀도가 필요하면 Durable Objects Alarms/Agents interval 스케줄이 대안.",
   "source": "https://developers.cloudflare.com/workers/configuration/cron-triggers/ (1차) · https://reintech.io/blog/setting-up-cloudflare-workers-cron-triggers · https://blog.cloudflare.com/cron-triggers-for-scheduled-workers/ · https://developers.cloudflare.com/agents/api-reference/schedule-tasks/",
   "confidence": "confirmed",
   "deltaVsBaseline": "BACKEND_PUSH_PLAN §2.1은 '분 단위 + 즉시 실행'으로 낙관 기술 — 델타: (1) 분 내 ±수십 초 지터는 스펙상 감수해야 함, (2) cron 설정 변경 전파 최대 15분 → 오픈일 당일 cron 표현식을 바꾸는 운영은 금물(상시 1분 cron + 코드에서 openAt 판정이 정석), (3) D4 PoC는 '−15분 임박 푸시' 기준 ±30초면 충분하므로 아키텍처 변경 불요. [중립 — 기존 설계 유효, 운영 규칙만 추가]"
  },
  {
   "claim": "(a-보조) Safari 18.4에서 Screen Wake Lock도 추가됐고, Badge API(앱 아이콘 배지)는 iOS 16.4부터 설치형 웹앱에서 지원 — 미읽음 알림 수 배지 표시 같은 보조 UX 옵션 존재.",
   "source": "https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide · https://www.mobiloud.com/blog/progressive-web-apps-ios",
   "confidence": "likely",
   "deltaVsBaseline": "베이스라인 미기재 보조 사실. DWP JSON의 app_badge 필드와 결합하면 iOS에서 '오늘 오픈 N건' 배지 가능. [유리, 우선순위 낮음]"
  }
 ],
 "resolvedUnknowns": [
  "베이스라인 '후속 검증 필요' 항목 중 Declarative Web Push의 실전 채택 가능 여부 → 해소: W3C WD + SW 하위호환 확정으로 '보류'가 아니라 '페이로드 포맷만 지금 채택'이 정답",
  "Worker cron 실측 지연 PoC(D4)의 사전 기대치 → 부분 해소: 공식 스펙은 분 단위(초 무보장), 실무 통설 ±30초 — PoC는 이 범위 검증으로 축소 가능",
  "iOS 설치 마찰(홈 화면 추가 요건) → 해소: iOS 26부터 manifest 무관 전 사이트 웹앱 기본 오픈"
 ],
 "implications": [
  "X0 페이로드 스키마를 처음부터 Declarative Web Push JSON(web_push:8030/notification.title/navigate/app_badge)과 호환되게 설계하라 — 미지원 브라우저는 자동으로 SW 경로 폴백이라 순수 이득(BACKEND_PUSH_PLAN §9 '후속 최적화'를 P0 설계 결정으로 승격 권고)",
  "발송 워커에 HTTP 429(Chrome rate limit) 백오프 처리를 방어적으로 추가 — 우리 발송 패턴상 실제 발동 가능성은 낮음",
  "Worker cron은 상시 '* * * * *' 1개 고정 + 코드 내부에서 openAt−15분 윈도우 판정 — 오픈일마다 cron 표현식 변경 금지(전파 최대 15분 리스크). ±30초 지터 전제로 발송 윈도우를 ±1분 폭으로 설계",
  "Android에서도 설치형 PWA 구독 유도(자동 권한 회수 예외 가능성 + unsubscribe 버튼 환경) — pushsubscriptionchange 핸들러와 '구독 살아있나' 재확인 UX를 P0 범위에 유지",
  "iOS 26의 '전 사이트 웹앱 기본' 덕에 iOS 온보딩 카피를 '공유→홈 화면에 추가' 한 단계로 단순화 가능 — 단 푸시 권한은 여전히 설치 후에만 요청 가능하므로 순서(설치→권한) 불변",
  "불변 원칙 대비: 이번 조사에서 발견된 모든 변화는 표준 Web Push/공식 스토어 경로 내 변화로, 자동예매·스크래핑 금지/알림 레이어 포지션과 충돌 없음 — 오히려 Chrome의 스팸 푸시 억제와 iOS 설치 장벽 완화는 '신뢰성 있는 저빈도 알림' 포지션에 순풍"
 ]
}
```

## confirmed

```json
{
 "verdict": "confirmed",
 "proof": "독립 재검증 (2026-07-03, WebFetch 직접 확인):\n\n(1) 배너 존재 — CONFIRMED. https://nol.interpark.com/ticket 를 직접 fetch한 결과, 메인 콘텐츠 상단에 배너 원문 \"NOL 티켓이 NOL로 통합됩니다!\" 가 존재하며, 링크 대상은 정확히 https://events.interpark.com/exhibition?exhibitionCode=260609002 임을 확인. 주장과 배너 문구·링크 URL 모두 일치.\n\n(2) 안내 페이지 — CONFIRMED. https://events.interpark.com/exhibition?exhibitionCode=260609002 직접 fetch 결과 페이지 제목 \"[NOL 티켓이 NOL로 통합됩니다.]\" 확인. 본문은 이미지 기반(NOL 소개/통합 혜택/FAQ 네비게이션 + Yanolja 링크)이라 통합 완료일·구 도메인 폐기 일정은 텍스트로 추출 불가 — 주장의 'unknown' 표기가 정확함. 추가로 WebSearch(\"NOL 티켓 NOL 통합 일정 인터파크 도메인 종료 2026\")로도 완료일/도메인 폐기 일정의 1차 출처를 찾지 못해 unknown 유지가 타당.\n\n(3) 게시일 추정(exhibitionCode 260609002 = 2026-06-09) — 이는 코드 패턴(YYMMDD###) 기반 추론이며 1차 출처로 확인 불가. 주장 자체가 이를 '코드상' 추정으로 명시하고 있어 과장 아님. 단, 이 부분만은 추론임을 유지할 것 (unknown 성격).\n\n과장/오독 없음. 출처는 모두 1차(interpark 공식 도메인), 2026-07-03 현재 유효. 포지션 영향: 인터파크 도메인/브랜드 재편 진행 중이라는 사실은 KBO TIDO의 '링크 아웃(딥링크) 대상 URL 안정성' 리스크로, 스크래핑 안 함·정보 레이어만 포지션에는 중립~약간 유리(공식 링크만 갱신하면 됨).\n\n출처: https://nol.interpark.com/ticket ; https://events.interpark.com/exhibition?exhibitionCode=260609002 ; https://nol.interpark.com/ ; https://tickets.interpark.com/"
}
```

