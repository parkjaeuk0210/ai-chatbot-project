# PERA

PERA는 채팅, 이미지 생성, 이미지/PDF 첨부를 하나의 차분한 화면에 통합한 AI 워크스페이스입니다. 기능 수를 늘리는 대신 핵심 작업 흐름을 선명하게 만들고, 접근성·보안·배포 계약을 코드로 검증합니다.

## 제품 원칙

- **한 화면, 두 모드**: 채팅과 이미지 생성만 상단 세그먼트로 전환합니다.
- **복잡성보다 흐름**: 사이드바, 대시보드, Workbench 같은 상시 패널을 두지 않습니다.
- **안전한 렌더링**: 사용자와 모델 콘텐츠는 DOM API와 `textContent`로만 렌더링합니다.
- **접근성 기본값**: 키보드 탭 전환, 명확한 포커스, 라이브 리전, 모션 축소를 지원합니다.
- **명시적 배포 산출물**: `npm run build`가 검증된 정적 파일을 `public/`에 생성합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 로컬 서버는 `/api/chat` 응답을 모의하므로 API 키 없이 UI 흐름을 점검할 수 있습니다.

## 검증과 빌드

```bash
npm run check
npm test
npm run build
```

- `check`: JavaScript 문법, 단일 API 엔드포인트, 외부화된 CSS/JS, CSP/배포 설정을 검사합니다.
- `test`: API 입력/정규화와 다국어·프런트 계약을 검증합니다.
- `build`: 검사와 테스트를 통과한 뒤 `public/` 정적 산출물을 만듭니다.

## Vercel 환경 변수

| 변수 | 필수 | 설명 |
|---|---:|---|
| `GEMINI_API_KEY` | 예 | 서버에서만 사용하는 Gemini API 키 |
| `GEMINI_CHAT_MODEL` | 아니요 | 기본 채팅 모델을 교체할 때 사용 |
| `GEMINI_IMAGE_MODEL` | 아니요 | 기본 이미지 모델을 교체할 때 사용 |
| `ALLOWED_ORIGIN` | 아니요 | 교차 출처 요청을 허용할 origin 목록(쉼표 구분) |

API 키는 브라우저 번들에 포함되지 않습니다. 프런트는 동일 출처의 `/api/chat`만 호출합니다.

## 구조

```text
index.html                 접근 가능한 단일 App Shell
css/styles.css             토큰 기반 반응형 디자인 시스템
js/main.js                 UI 상태와 사용자 흐름
js/i18n/                   한국어·영어·일본어·중국어·인도네시아어
api/chat.js                검증, 제한, Gemini 어댑터
scripts/validate.mjs       구조 및 보안 계약 검사
scripts/build.mjs          public/ 정적 산출물 생성
tests/                     API·프런트 회귀 테스트
server.js                  로컬 정적 서버와 API mock
```

심층 진단과 리팩터링 결정은 [`docs/REFACTOR_AUDIT.md`](docs/REFACTOR_AUDIT.md)에 기록되어 있습니다.
