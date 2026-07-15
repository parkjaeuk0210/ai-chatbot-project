# PERA AI 배포 가이드

## 현재 운영 구조

```txt
index.html      # 기본 프론트 엔트리
css/            # 로컬 빌드된 Tailwind CSS 및 앱 스타일
js/main.js      # 브라우저 앱 로직
js/i18n/        # 다국어 리소스
api/chat.js     # 단일 Vercel API 핸들러
vercel.json     # 배포 설정
server.js       # 로컬 정적 서버 및 /api/chat 목업
```

프론트는 `/api/chat` 하나만 호출합니다. 이전의 레거시/보안/Edge API 분기 구조와 Tailwind CDN 의존성은 제거되었습니다.

## 환경 변수

Vercel 프로젝트에 다음 값을 설정하세요.

```txt
GEMINI_API_KEY     # Gemini API 키
ALLOWED_ORIGIN     # 허용할 프론트 도메인, 미설정 시 * 사용
```

## 로컬 확인

```bash
npm install
npm run build
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. 포트가 사용 중이면 다음처럼 실행합니다.

```bash
PORT=3001 npm run dev
```

## 배포 전 확인

```bash
npm test
npm run build
npm audit --omit=dev
```

두 명령이 모두 통과한 뒤 main 브랜치에 push하면 Vercel 자동 배포가 진행됩니다.

## 주의

`vercel.json`의 CSP는 인라인 스크립트와 인라인 스타일을 허용하지 않습니다. 새 프론트 코드는 `index.html`에 직접 `<script>`/`<style>`을 추가하지 말고 `js/` 또는 `css/` 파일로 분리하세요.
