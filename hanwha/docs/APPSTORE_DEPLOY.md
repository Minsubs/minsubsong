# 앱스토어 배포 — 툴체인 설치 런북 (Phase 9 선행)

> 대상 환경: **Apple Silicon(arm64) macOS 26.x**, Homebrew 설치됨, Node v26.
> 목적: Capacitor로 기존 PWA(`hanwha/`)를 네이티브 셸로 감싸 **Apple App Store + Google Play**에 올리기 위한 빌드 툴체인을 갖춘다.
> 이 문서는 **사용자가 직접 실행하는 휴먼게이트** 단계다. 설치가 끝나면 Phase 9-1(Capacitor 스캐폴딩)부터 자동화 진행한다.

## 0. 현재 상태

- ✅ 웹앱(PWA)은 Phase 8까지 완료·검증됨. GitHub Pages 배포는 그대로 유지(Capacitor와 병행).
- ✅ 갖춰진 것: Node v26, npm 11, Homebrew 5.x, Xcode **Command Line Tools**, npm registry 접근.
- ❌ 없어서 설치해야 하는 것: **전체 Xcode.app**, **CocoaPods**(iOS), **JDK 17 + Android SDK**(Android).
- 결제 필요: Apple Developer Program **$99/년**, Google Play Console **$25(1회)**.

설치 비용/용량 주의: Xcode.app ≈ 7~12GB(App Store 다운로드 느림), Android Studio + SDK ≈ 5~8GB.

---

## 1. iOS 툴체인

### 1-1. Xcode.app 설치
- Mac App Store에서 **Xcode** 설치(또는 https://developer.apple.com/download 에서 .xip).
- 설치 후 한 번 실행해 추가 컴포넌트 설치를 마친다.

### 1-2. 커맨드라인 도구를 Xcode로 전환 + 라이선스 동의
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
xcodebuild -version          # Xcode 16+ 확인
```

### 1-3. CocoaPods 설치 (시스템 ruby 2.6은 구버전이라 Homebrew 권장)
```bash
brew install cocoapods
pod --version                # 1.12+ 확인
```

---

## 2. Android 툴체인

### 2-1. JDK 17 (Android Gradle Plugin 8.x가 요구)
```bash
brew install --cask temurin@17
/usr/libexec/java_home -v 17   # 경로 확인
java -version                  # 17.x 확인 (필요시 JAVA_HOME 지정)
```

### 2-2. Android Studio + SDK
```bash
brew install --cask android-studio
```
- Android Studio를 실행 → **More Actions → SDK Manager**에서 아래 설치:
  - SDK Platforms: 최신 Android API(예: API 35)
  - SDK Tools: Android SDK Build-Tools, Platform-Tools, Command-line Tools, Emulator
- 기본 SDK 경로: `~/Library/Android/sdk`

### 2-3. 환경변수 (zsh → `~/.zshrc`에 추가 후 `source ~/.zshrc`)
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```
```bash
adb --version          # platform-tools 확인
sdkmanager --list | head # SDK 확인
```

---

## 3. 개발자 계정 (제출용 — 빌드만 할 거면 나중에 해도 됨)

- **Apple Developer Program**: https://developer.apple.com/programs/ 에서 $99/년 가입. App Store Connect 접근, 코드 서명, 실기기 배포에 필요. (로컬 시뮬레이터/무료 프로비저닝 7일 테스트는 계정 없이도 가능)
- **Google Play Console**: https://play.google.com/console 에서 $25(1회) 가입.

---

## 4. 설치 후 준비 완료 검증

아래를 모두 통과하면 Phase 9-1로 진행 가능하다. 다음 세션에서 이 블록을 그대로 실행해 확인한다.
```bash
echo "--- iOS ---"
xcodebuild -version
pod --version
xcode-select -p           # /Applications/Xcode.app/... 이어야 함
echo "--- Android ---"
java -version             # 17.x
echo "ANDROID_HOME=$ANDROID_HOME"
adb --version
```

---

## 5. 다음 단계 (툴체인 준비되면 자동화)

`PROGRESS.md`의 Phase 9 계획대로 진행:
- **9-1** Capacitor 스캐폴딩: `@capacitor/core,cli,ios,android` 설치, `capacitor.config`(appId 예 `com.minsub.eagles`, webDir 연결), `npx cap add ios`/`npx cap add android`.
- **9-2** `@capacitor/local-notifications`로 티켓 알림을 네이티브 스케줄로 이관(앱 종료 상태에서도 발화). 웹/네이티브 feature-detect 분기로 PWA도 그대로 동작.
- **9-3** `@capacitor/assets`로 아이콘/스플래시 생성, 스토어 메타데이터(KR/EN), 개인정보처리방침(앱은 개인정보 미수집·localStorage만 사용).
- **9-4** 빌드: iOS `npx cap sync ios` + Xcode 아카이브 / Android `./gradlew bundleRelease`.
- **9-5** 실기기 테스트.
- **9-6** App Store Connect / Play Console 제출.

> Apple 심사(4.2): 단순 웹래퍼는 거부될 수 있어 네이티브 LocalNotifications(9-2) 등으로 minimum functionality를 충족시킨다.
