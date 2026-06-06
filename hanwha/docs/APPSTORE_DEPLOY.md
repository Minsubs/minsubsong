# 앱 배포 준비 런북

대상 제품: **KBO 티켓팅 도우미**

현재 이 문서는 바로 스토어 제출을 위한 문서가 아니라, 수요 검증 이후 네이티브 알림이 필요해졌을 때 사용할 툴체인 준비 문서입니다.

## 진행 조건

스토어/네이티브 작업은 아래 조건을 만족한 뒤 진행합니다.

- 10구단 예매 캘린더가 안정적으로 갱신된다.
- `검증` 탭의 로컬 지표에서 알림 저장과 예매처 클릭 수요가 확인된다.
- 자동예매/우회/무단 취소표 감시와 제품이 명확히 분리되어 있다.
- 취소표 관심 경기 알림을 포함할 경우 예매처별 허용 범위, 트래픽 제한, 개인정보 처리 기준이 문서화되어 있다.
- 과거 macro 히스토리 rewrite/force push 여부가 결정되어 있다.
- 계정 비밀번호 교체 등 휴먼 보안 조치가 끝났다.

## 현재 상태

- PWA는 로컬/정적 배포 기준으로 동작한다.
- 티켓 알림은 앱이 열려 있을 때 브라우저에서 확인한다.
- 네이티브 앱 패키징은 아직 시작하지 않았다.
- 전체 Xcode.app, CocoaPods, JDK 17, Android SDK 설치 여부는 다음 단계에서 확인한다.

## iOS 툴체인

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
xcodebuild -version
brew install cocoapods
pod --version
```

## Android 툴체인

```bash
brew install --cask temurin@17
brew install --cask android-studio
```

`~/.zshrc` 예시:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

검증:

```bash
java -version
echo "ANDROID_HOME=$ANDROID_HOME"
adb --version
```

## 제출 계정

- Apple Developer Program: 유료 연간 계정 필요
- Google Play Console: 유료 1회 등록 필요

실제 제출, 서명, force push, 계정 작업은 모두 휴먼게이트입니다.

## 다음 구현 후보

수요 검증 통과 후에만 진행합니다.

1. Capacitor 스캐폴딩
2. `@capacitor/local-notifications`로 예매 오픈 10분 전 네이티브 알림
3. 취소표 관심 경기 알림의 허용 데이터 소스 또는 제휴 가능성 검토
4. 개인정보처리방침 초안 작성
5. 스토어 메타데이터와 스크린샷 준비
6. 실기기 테스트
7. App Store Connect / Play Console 제출 런북 작성

## 심사 리스크

단순 웹래퍼는 거부될 수 있습니다. 네이티브 단계로 갈 경우 핵심 차별점은 “앱 종료 상태에서도 예매 오픈 전 로컬 알림을 받을 수 있음”이어야 합니다. 취소표 관심 경기 알림은 자동 구매나 우회 기능으로 오해되지 않도록 “공식 예매처로 이동시키는 상태 알림”으로 제한해야 합니다.
