"""
LG트윈스 티켓 예매 매크로 설정
"""

# ===== 로그인 정보 =====
LOGIN_ID = "01034943624"
LOGIN_PW = "qwe123!@"
LOGIN_METHOD = "MY_LG_ID"  # "MY_LG_ID" or "LG_TWINS"

# ===== URL 설정 =====
BASE_URL = "https://www.lgtwins.com"
LOGIN_URL = f"{BASE_URL}/member/login"
TICKET_URL = f"{BASE_URL}/ticket/general"
MAIN_URL = f"{BASE_URL}/main"

# ===== 경기 선택 =====
# 상대팀 (예매하려는 경기의 상대팀)
TARGET_OPPONENT = "랜더스"  # SSG 랜더스
# 특정 날짜 경기 선택 (없으면 None)
TARGET_DATE = "04.10"  # 4월 10일

# ===== 좌석 선호 설정 =====
# 선호 좌석 구역 (우선순위 순서)
PREFERRED_ZONES = [
    "3루",
    "3루 내야",
    "3루 외야",
    "3루 지정석",
]

# 선호 좌석 수
TICKET_COUNT = 2

# ===== 타이밍 설정 =====
# 예매 오픈 시간에 맞춰 대기할지 여부
WAIT_FOR_OPEN = False
# 예매 오픈 시간 (YYYY-MM-DD HH:MM:SS 형식)
OPEN_TIME = "2026-04-07 11:00:00"

# ===== 브라우저 설정 =====
HEADLESS = False  # True면 브라우저 안 보임 (더 빠름)
SLOW_MO = 0       # 각 동작 사이 딜레이 (ms), 디버깅 시 100~500 추천
