"""
LG트윈스 티켓 예매 매크로 설정

- 자격증명: ticketlink-macro/.env 에 보관 (커밋 금지)
- 그 외 튜닝값: 이 파일에서 수정
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 이 파일과 같은 폴더의 .env 를 로드
load_dotenv(Path(__file__).parent / ".env")


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"환경변수 {name} 가 비어 있습니다. ticketlink-macro/.env 파일을 확인하세요. "
            "(.env.example 참고)"
        )
    return value


# ===== 로그인 정보 (.env 에서 로드) =====
# 자동 로그인은 mylgid 봇 탐지로 차단됨 — 본인이 직접 로그인하는 manual 흐름만 지원.
# .env 의 자격증명은 prepare_session 화면에 안내용으로만 표시.
LOGIN_ID = _required("LOGIN_ID")
LOGIN_PW = _required("LOGIN_PW")

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
# 예매 오픈 시간에 맞춰 대기할지 여부 (실 운영 시 True)
WAIT_FOR_OPEN = False
# 예매 오픈 시간 (YYYY-MM-DD HH:MM:SS 형식)
# NOTE: TARGET_DATE 경기의 실제 예매 오픈 시간과 일치하는지 매번 확인할 것
OPEN_TIME = "2026-04-07 11:00:00"

# ===== 브라우저 설정 =====
HEADLESS = False  # True면 브라우저 안 보임 (더 빠름)
SLOW_MO = 0       # 각 동작 사이 딜레이 (ms), 디버깅 시 100~500 추천

# ===== Persistent Context (로그인 세션 영구 보관) =====
# True 면 launch_persistent_context 사용 — 한 번 수동 로그인하면 다음부터 자동 로그인 단계 스킵
# mylgid 봇 탐지 회피 + 속도 향상
USE_PERSISTENT_CONTEXT = True
PROFILE_DIR = str(Path(__file__).parent / "profile")

# Stealth 모드:
# - False     : 아무것도 안 함 (mylgid 로그인 단계에선 가장 안전)
# - "minimal" : navigator.webdriver 만 가림 (NetFunnel 통과용, 권장 디폴트)
# - "full"    : 전체 stealth init script (Chromium 환경 전용 — 시스템 Chrome엔 부작용)
PERSISTENT_CONTEXT_STEALTH = "minimal"
# 시스템 Chrome 사용 (False 면 Playwright 번들 Chromium — mylgid 통과 불가)
PERSISTENT_CONTEXT_CHANNEL = "chrome"

# ===== 속도 최적화 =====
# 광고/추적 도메인 + 폰트/미디어 차단 (티켓팅 페이지 로딩 1~3초 단축)
BLOCK_RESOURCES = True

# 오픈 직후 critical path 에서 인간형 dwell time 제거 (속도 우선)
FAST_MODE = False
