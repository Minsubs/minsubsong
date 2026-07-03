# KBO TIDO Design System

## 1. Atmosphere & Identity

KBO TIDO는 야구장 전광판과 종이 입장권을 섞은 빠르고 실용적인 브로드캐스트 화면이다. 정보 밀도는 높지만 현재 경기, 예매 오픈, 다음 행동이 즉시 구분되어야 한다. 시그니처는 팀별 강조색이 적용되는 티켓 스텁, 바코드, 모노스페이스 일련번호다.

## 2. Color

### Palette

`styles.css`의 `:root`와 `:root.dark`가 실제 토큰 원본이다. 아래 표는 그 의미를 고정하며, 구단 선택 시 `--accent` 계열은 런타임에서 해당 구단색으로 바뀔 수 있다.

| Role | Token | Light | Dark | Usage |
|---|---|---|---|---|
| Background | `--bg` | `#f2ece0` | `#0c0d11` | 페이지 배경 |
| Surface | `--surface` | `#fbf7ee` | `#15171d` | 카드와 패널 |
| Surface/strong | `--surface-strong` | `#ffffff` | `#1b1e25` | 강조 표면 |
| Surface/secondary | `--surface-2` | `#f5efe2` | `#1b1e25` | 스텁과 보조 영역 |
| Text | `--text` | `#1a1712` | `#ffffff` | 본문과 제목 |
| Text/muted | `--muted` | `#756a52` | `#8a92a0` | 설명과 메타데이터 |
| Border | `--line` | `#c4b89c` | `#262a32` | 구분선과 카드 외곽선 |
| Accent | `--accent` | `#c62d1a` | `#ff4d1c` | CTA, 선택, 포커스, 팀색 |
| Accent/strong | `--accent-strong` | `#a82414` | `#ff4d1c` | 강조 텍스트와 hover |
| Accent/secondary | `--accent-2` | `#d8442b` | `#ff6a3c` | 그라데이션 보조색 |
| Positive | `--pos` | `#1f8f4e` | `#3ad07a` | 성공과 예매 가능 상태 |
| Live | `--live` | `#c62d1a` | `#ff4d67` | 라이브 상태 |
| On accent | `--on-accent` | `#fbf7ee` | `#0c0d11` | 강조색 위 텍스트 |
| Focus ring | `--ring` | `rgba(198,45,26,.45)` | `rgba(255,77,28,.5)` | 키보드 포커스 |

### Rules

- 새 색은 먼저 루트 토큰에 의미를 부여한 뒤 사용한다.
- 상태가 아닌 장식에는 라이브·성공색을 사용하지 않는다.
- 구단 개인화는 `--accent`, `--accent-strong`, `--accent-2`, `--on-accent`만 교체한다.
- 레거시 별칭(`--orange`, `--mint`, `--blue`)은 호환용이며 신규 규칙에서는 의미 토큰을 우선한다.

## 3. Typography

### Scale

기존 UI는 반응형 `clamp()`를 사용한다. 다음 역할 범위 안에서만 새 크기를 선택한다.

| Level | Size | Weight | Line Height | Usage |
|---|---:|---:|---:|---|
| Display | `clamp(2.6rem, 7vw, 5rem)` | 900 | 1.0–1.05 | 티켓 히어로 숫자와 주요 헤드라인 |
| H1 | `clamp(1.8rem, 3.2vw, 3.1rem)` | 800–900 | 1.05–1.15 | 화면 제목 |
| H2 | `clamp(1.45rem, 2vw, 2rem)` | 800–900 | 1.15 | 섹션 제목 |
| H3 | `1.08rem–1.3rem` | 700–900 | 1.2–1.4 | 카드 제목 |
| Body | `0.95rem–1rem` | 400–600 | 1.6–1.7 | 기본 본문 |
| Body/sm | `0.84rem–0.9rem` | 400–600 | 1.45–1.6 | 보조 설명 |
| Caption | `0.72rem–0.78rem` | 500–700 | 1.4 | 메타데이터 |
| Serial | `0.56rem–0.72rem` | 600–700 | 1.3 | 티켓 일련번호와 오버라인 |

### Font Stack

- Display: `var(--font-display)` — 압축된 시스템 산세리프 계열
- Mono: `var(--font-mono)` — 일련번호, 시간, 수치
- Body: 시스템 산세리프

### Rules

- 경기 수치에는 tabular numerals를 사용한다.
- 일반 본문은 14px보다 작게 만들지 않는다. 14px 미만은 짧은 라벨과 일련번호에만 허용한다.
- 긴 제목은 `clamp()`와 자연 줄바꿈으로 모바일 오버플로를 막는다.

## 4. Spacing & Layout

### Base Unit

기본 단위는 4px다.

| Token | Value | Usage |
|---|---:|---|
| `--space-1` | 4px | 아이콘과 라벨 |
| `--space-2` | 8px | 인라인 그룹 |
| `--space-3` | 12px | 컴팩트 카드 |
| `--space-4` | 16px | 표준 카드 패딩 |
| `--space-5` | 20px | 모바일 페이지 여백 |
| `--space-6` | 24px | 큰 카드 패딩 |
| `--space-8` | 32px | 카드 그룹 사이 |
| `--space-10` | 40px | 섹션 내부 간격 |
| `--space-12` | 48px | 섹션 경계 |
| `--space-16` | 64px | 페이지 수준 간격 |

### Grid

- 주요 콘텐츠 최대 폭: 1180px
- 표준 바깥 여백: 데스크톱 20px 이상, 모바일 12px 이상
- 주요 반응형 경계: 560px, 620px, 760px, 919/920px, 1280px
- 모바일은 단일 열과 하단 내비게이션, 데스크톱은 상단 탭과 다열 카드가 기본이다.

### Existing Deviations

- 기존 CSS에는 6px, 10px, 14px, 18px처럼 4px 격자 밖 값이 남아 있다.
- 이번 기준서는 현행 동작을 기록한다. 별도 승인 없는 정리 작업에서 간격을 재설계하지 않는다.

## 5. Components

### Ticket Card

- **Structure**: 일련번호/바코드, 매치업, 오픈 시각, 상태, CTA
- **Variants**: 예매 전, 임박, 예매 중, 로딩, 오류
- **Spacing**: `--space-3`부터 `--space-6`
- **States**: hover lift, keyboard focus ring, disabled action
- **Accessibility**: 실제 이동은 링크, 동작은 버튼으로 제공한다.
- **Motion**: transform과 box-shadow만 150–180ms로 전환한다.

### Navigation

- **Structure**: 데스크톱 `.view-tabs`, 모바일 `.bottom-nav`
- **States**: default, hover, active/`aria-current`, focus-visible
- **Accessibility**: 모바일 터치 타깃은 최소 44px, 하단 탭은 48px 이상이다.

### Data Card and Table

- **Structure**: 제목/메타데이터, 핵심 수치, 보조 상태
- **Variants**: 일반 카드, 라이브, 내 구단 강조, 빈 상태, 오류 상태
- **Accessibility**: 표는 행/열 의미를 유지하고 가로 스크롤을 허용한다.

### Actions and Chips

- **Structure**: `.primary-action`, `.secondary-action`, `.chip`, 필터 버튼
- **States**: hover, active, focus-visible, disabled
- **Accessibility**: 색만으로 선택 상태를 표현하지 않고 텍스트 또는 ARIA 상태를 병행한다.

### Empty and Error State

- **Structure**: 아이콘, 짧은 제목, 해결 가능한 안내
- **Variants**: inline, panel, error
- **Accessibility**: 동적 빈 상태는 `role="status"`, 오류는 `role="alert"`를 사용한다.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Micro | 150–180ms | ease | 버튼, 칩, 카드 hover |
| Standard | 200–300ms | ease/ease-in-out | 시트와 패널 전환 |
| Live emphasis | 1.4–2s | ease-in-out | 라이브·스켈레톤 반복 신호 |

### Rules

- 위치 변화는 `transform`, 가시성 변화는 `opacity`를 사용한다.
- 반복 애니메이션과 시트 애니메이션은 `prefers-reduced-motion`에서 비활성화한다.
- hover와 focus가 동일한 정보 접근성을 제공해야 한다.

## 7. Depth & Surface

### Strategy: Mixed Ticket Layers

- 기본 카드: `1px solid var(--line)`과 `var(--surface)`.
- 상호작용 또는 중요 카드: `var(--shadow-soft)`; hover 시 `var(--shadow)`.
- 모달과 설치 시트: 강한 표면과 명확한 포커스 링.
- 티켓 절취선과 바코드는 점선/반복 그라데이션을 사용할 수 있으나 정보 전달을 방해하지 않는다.
- 동일 계층에서 border와 shadow를 무분별하게 중첩하지 않는다.
