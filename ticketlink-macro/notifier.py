"""
완료 알림
좌석 선택 완료 시 소리 & 터미널 알림
"""
import subprocess
import sys


def notify_success(message: str = "좌석 선택 완료!"):
    """성공 알림"""
    print("\n" + "=" * 50)
    print(f"🎉🎉🎉 {message} 🎉🎉🎉")
    print("=" * 50)
    print("⚠️  빨리 결제를 완료하세요!")
    print("=" * 50 + "\n")

    # macOS 시스템 알림 소리
    try:
        # 알림음 5번 반복
        for _ in range(5):
            subprocess.Popen(
                ["afplay", "/System/Library/Sounds/Glass.aiff"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    except:
        # 소리 재생 실패 시 beep
        print("\a" * 5)

    # macOS 알림 센터
    try:
        subprocess.run(
            [
                "osascript",
                "-e",
                f'display notification "{message}" with title "LG Twins 매크로" sound name "Glass"',
            ],
            timeout=5,
        )
    except:
        pass


def notify_failure(message: str = "좌석 선택 실패"):
    """실패 알림"""
    print("\n" + "=" * 50)
    print(f"❌ {message}")
    print("=" * 50 + "\n")

    try:
        subprocess.Popen(
            ["afplay", "/System/Library/Sounds/Basso.aiff"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except:
        print("\a")


def notify_waiting(message: str):
    """대기 상태 알림"""
    print(f"⏳ {message}", end="\r")
