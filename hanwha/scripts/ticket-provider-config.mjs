export const TICKET_PROVIDER_TEAMS = Object.freeze([
  "한화",
  "SSG",
  "NC",
  "두산",
  "롯데",
  "KIA",
  "키움",
  "LG",
  "KT",
  "삼성",
]);

export const TICKET_AUDIT_MAX_AGE_DAYS = 92;

const evidence = (status, verifiedAt, sourceUrl, note) => ({
  status,
  verifiedAt,
  sourceUrl,
  note,
});

// 운영 데이터의 단일 원본. verification 은 감사 전용이며 public data/*.json 에는
// 내보내지 않는다. 예매처(provider)와 오픈 규칙(openRule)을 별도로 검증해
// "공식 채널 확인"을 "시각까지 확인"으로 과장하지 않는다.
export const TICKET_PROVIDERS = Object.freeze({
  한화: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/63",
    note: "한화 홈 예매",
    openLabel: "홈경기 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-03",
        "https://www.koreabaseball.com/kbo/league/map.aspx",
        "KBO 공식 구단 홈페이지/티켓 예매처 안내",
      ),
      openRule: evidence(
        "verified",
        "2026-07-16",
        "https://www.hanwhaeagles.co.kr/FA/CN/PCFACN02.do?id=1829",
        "구단 공식 '2026 홈경기 입장권 안내'(2026-03-18): 예매 오픈 경기 D-7 오전 11시 · 1인 4매(최대 2회) · 취소 경기시작 4시간 전. 예매 채널은 구단 홈/앱 + 티켓링크 병기",
      ),
    },
  },
  SSG: {
    provider: "SSG 티켓",
    url: "https://ticket.ssg.com/",
    note: "SSG 홈 예매",
    openLabel: "SSG 홈 예매 일정 기준",
    openDaysBefore: 4,
    openTime: "11:00",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-14",
        "https://app.ssglanders.com/noticeView?seq=3077",
        "SSG 공식 2026 시즌 예매 채널 안내",
      ),
      openRule: evidence(
        "verified",
        "2026-07-14",
        "https://ticket.ssg.com/",
        "공식 판매 목록의 경기일/오픈일 대조 결과 D-4 11:00",
      ),
    },
  },
  NC: {
    provider: "NC 다이노스",
    url: "https://www.ncdinos.com/",
    note: "NC 홈 예매",
    openLabel: "NC 홈 예매 일정 기준",
    openDaysBefore: 6,
    openTime: "11:00",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-14",
        "https://apps.apple.com/kr/app/nc-dinos/id1495745743",
        "NC 공식 앱의 티켓 예매 기능 확인",
      ),
      openRule: evidence(
        "needs-review",
        null,
        "https://www.ncdinos.com/dinos/notice/view.do?seq=541605",
        "공식 2023·2024 티켓 안내 공지 동일 문구 '일반예매: 경기 시작 6일 전 오전 11시'(D-7 아님 → D-6 교정, 2026-07-16). 시즌티켓 D-2일·민트멤버십 D-1일 선예매. 2026 시즌 고유 1차 공지 재확인 필요",
      ),
    },
  },
  두산: {
    provider: "NOL(야놀자)",
    url: "https://nol.yanolja.com/ticket/genre/sports/bears",
    note: "두산 홈 예매",
    openLabel: "두산 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    earlyOpenLabel: "베어스클럽 선예매 · 일반 1시간 전",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-16",
        "https://www.doosanbears.com/doorundoorun/notice/140",
        "구단 공식 'NOL 통합 안내'(2026-07-14): 7/24(금) 홈경기부터 WEB 예매처 ticket.interpark.com → NOL. NOL 두산 전용관(genre/sports/bears) 가동 확인. 구단 홈/앱 예매는 종전과 동일",
      ),
      openRule: evidence(
        "verified",
        "2026-07-16",
        "https://nol.yanolja.com/ticket/genre/sports/bears",
        "NOL 공식 판매 데이터 대조: 7/24 두산 vs 삼성 bookingOpenTime 2026-07-17 11:00 = D-7 11:00, 이후 8/11까지 10경기 동일 규칙. 베어스클럽 선예매 '일반 1시간 전'은 언론 보도(2차) 참고",
      ),
    },
  },
  롯데: {
    provider: "롯데 자이언츠",
    url: "https://ticket.giantsclub.com/",
    note: "롯데 홈 예매",
    openLabel: "롯데 홈 예매 일정 기준",
    openDaysBefore: 14,
    openTime: "14:00",
    openCaution: "구단 앱 공지 기준 확인",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-03",
        "https://www.koreabaseball.com/kbo/league/map.aspx",
        "KBO 공식 구단 홈페이지/티켓 예매처 안내",
      ),
      openRule: evidence(
        "verified",
        "2026-07-16",
        "https://www.giantsclub.com/html/?pcode=339",
        "구단 공식 요금안내: 일반예매 '시리즈 2주 전 수/금 14시'(회원 전용, ID당 8매) · 선예매 '시리즈 2주 전 화/목 14~18시'. 시리즈 단위라 경기별 실제 D-일수는 12~16일 변동 — D-14 14:00은 근사값",
      ),
    },
  },
  KIA: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/58",
    note: "KIA 홈 예매",
    openLabel: "KIA 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-14",
        "https://tigers.co.kr/contents/press/1036636",
        "KIA 공식 2026 홈 개막전 예매 안내",
      ),
      openRule: evidence(
        "verified",
        "2026-07-14",
        "https://tigers.co.kr/contents/press/1036636",
        "공식 안내에서 경기 7일 전 11:00 확인",
      ),
    },
  },
  키움: {
    provider: "NOL(야놀자)",
    url: "https://nol.yanolja.com/ticket/genre/sports/heroes",
    note: "키움 홈 예매",
    openLabel: "키움 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "14:00",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-16",
        "https://nol.yanolja.com/ticket/genre/sports/heroes",
        "NOL 통합은 구 인터파크 플랫폼 전체 적용 — NOL 키움 전용관 이미 판매 가동(7.21~ 경기), 구 인터파크 팀페이지(PB003)는 'NOL에서 예매하기' 배너로 유도. 구단 홈페이지 예매 채널은 기존 유지",
      ),
      openRule: evidence(
        "verified",
        "2026-07-16",
        "https://nol.yanolja.com/ticket/genre/sports/heroes",
        "구단 공식 안내(heroesbaseball.co.kr, 경기 7일 전 14:00) + NOL 판매 데이터 재확인: 7.21 경기 오픈 7/14 14:00 = D-7 14:00 일치",
      ),
    },
  },
  LG: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/59",
    note: "LG 홈 예매",
    openLabel: "LG 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "구단 공지 기준 확인",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-03",
        "https://www.lgtwins.com/ticket/general",
        "LG 공식 일반 예매 안내",
      ),
      openRule: evidence(
        "verified",
        "2026-07-03",
        "https://www.lgtwins.com/ticket/general",
        "공식 안내에서 경기 7일 전 11:00 확인",
      ),
    },
  },
  KT: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports",
    note: "KT 홈 예매",
    openLabel: "KT 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "16:00",
    openCaution: "구단 공지 기준 확인",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-14",
        "https://www.ktwiz.co.kr/media/wiznews/201267",
        "KT 공식 2026 7월 홈경기 예매 안내",
      ),
      openRule: evidence(
        "verified",
        "2026-07-14",
        "https://www.ktwiz.co.kr/media/wiznews/201267",
        "공식 안내에서 일반/회원 예매 경기 7일 전 16:00 확인",
      ),
    },
  },
  삼성: {
    provider: "티켓링크",
    url: "https://www.ticketlink.co.kr/sports/137/57",
    note: "삼성 홈 예매",
    openLabel: "삼성 홈 예매 일정 기준",
    openDaysBefore: 7,
    openTime: "11:00",
    openCaution: "시리즈 단위 화요일 11:00 일괄 오픈 — 시리즈 후속 경기는 더 일찍 열림",
    verification: {
      provider: evidence(
        "verified",
        "2026-07-16",
        "https://www.samsunglions.com/m/ticket/score_4_1_5.asp",
        "구단 공식 티켓 안내 '입장권 예매는 티켓링크에서 진행됩니다' + 티켓링크 삼성 전용관(sports/137/57)",
      ),
      openRule: evidence(
        "verified",
        "2026-07-16",
        "https://www.ticketlink.co.kr/sports/137/57",
        "티켓링크 삼성 공식 판매목록 대조: 07.28~30 시리즈 → 07.21(화) 11:00 오픈예정, 08.04~05 시리즈 → 07.28(화) 11:00 — 시리즈 첫 경기 기준 D-7 11:00 화요일 일괄 오픈(후속 경기는 D-8~9). 2026 공지: 취소 마감 경기 4시간 전·계정당 6매",
      ),
    },
  },
});
