# AI Chatbot Project - PERA AI

## 로컬 실행 방법 (Vercel과 동일한 환경)

1. 의존성 설치:
```bash
npm install
```

2. 프론트 CSS 빌드:
```bash
npm run build
```

3. 로컬 서버 실행:
```bash
npm run dev
```

4. 브라우저에서 접속:
```
http://localhost:3000
```

3000번 포트가 이미 사용 중이면 다음처럼 다른 포트를 지정할 수 있습니다:
```bash
PORT=3001 npm run dev
```

## 특징
- 로컬 환경이 Vercel 배포 환경과 동일하게 작동
- Express 서버로 정적 파일 제공
- 로컬 Tailwind CSS 빌드 사용
- 외부 스크립트는 PDF.js만 허용하는 CSP 적용
- `/api/chat` 엔드포인트를 Gemini 응답 형태로 모킹

## 배포
Vercel에 자동 배포됨 (main 브랜치 push 시)
