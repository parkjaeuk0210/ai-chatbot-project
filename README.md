# PERA Studio

PERA Studio는 채팅, 파일/URL 컨텍스트, 이미지 생성, 결과물 작업대를 한 화면에 통합한 AI 작업실입니다.

## 주요 변경점

- **PERA Studio AppShell**: 좌측 탐색, 중앙 대화, 우측 Workbench 3패널 구조
- **Smart Composer**: 파일/URL 컨텍스트 칩, `/요약`, `/표`, `/퀴즈`, `/이미지` 명령, 작업 모드 선택
- **Workbench**: 긴 답변, 표, 문서, 이미지 결과물을 자동 저장하고 복사/다운로드/재삽입 가능
- **모바일 최적화**: 탐색/작업대를 슬라이드 패널로 제공하고 composer를 모바일 우선으로 재구성
- **로컬 개발 서버 정리**: `npm run dev`로 Vercel API 형태를 모의 실행
- **투명한 Trust Layer**: UI에서 PERA 브랜드를 유지하되 provider-backed 응답임을 숨기지 않는 구조

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 접속:

```txt
http://localhost:3000
```

로컬 서버는 `/api/chat-secure`를 모의 응답으로 처리합니다. 실제 Gemini API 연동은 Vercel 배포 환경의 `api/chat-secure.js`와 `GEMINI_API_KEY` 환경 변수로 동작합니다.

## 사용 방법

1. 좌측 빠른 시작 카드 또는 중앙 입력창으로 작업을 시작합니다.
2. `＋ 첨부`로 이미지/PDF를 추가하거나 `URL` 버튼, URL 붙여넣기로 컨텍스트를 추가합니다.
3. `/요약`, `/표`, `/퀴즈`, `/이미지` 명령을 사용해 작업 모드를 빠르게 전환합니다.
4. 생성된 긴 답변과 이미지는 우측 Workbench에 저장됩니다.
5. Workbench 결과물은 복사, 다운로드, 대화 재삽입이 가능합니다.

## 배포

Vercel에 배포할 때는 환경 변수에 `GEMINI_API_KEY`를 설정하세요.

```bash
npm run check
```

## 구조

```txt
index.html              # PERA Studio HTML 엔트리
css/styles.css          # Tailwind CDN 없는 v2 디자인 시스템
js/app.js               # AppShell, composer, context, workbench orchestration
js/chat.js              # 메시지 렌더링 및 API client
js/utils.js             # 파일/PDF/보안 유틸리티
api/chat-secure.js      # Vercel Serverless API
api/middleware/responseFilter.js
server.js               # 로컬 개발 서버
```
