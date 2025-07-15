# FERA AI 채팅봇 프로젝트

🤖 Google Gemini API를 활용한 실시간 AI 채팅 애플리케이션

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/parkjaeuk0210/ai-chatbot-project)

## 🚀 주요 기능

- 💬 **실시간 AI 채팅** - Google Gemini API를 통한 자연스러운 대화
- 🎨 **이미지 생성** - Imagen API를 활용한 텍스트-이미지 변환
- 📄 **파일 업로드** - 이미지 및 PDF 파일 처리 지원
- 🌐 **다국어 지원** - 한국어, 영어, 일본어, 중국어, 인도네시아어
- 🌓 **다크모드** - 눈의 피로를 줄이는 다크 테마
- 📱 **PWA 지원** - 오프라인 작동 및 앱 설치 가능
- 🔒 **보안 강화** - Rate limiting, Input validation, CSP 헤더

## 📋 기술 스택

- **Frontend**: TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js
- **API**: Google Gemini API, Imagen API
- **Database**: Supabase (선택사항)
- **Deployment**: Vercel

## 🛠️ 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/parkjaeuk0210/ai-chatbot-project.git
cd ai-chatbot-project
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 값을 입력합니다:

```bash
cp .env.example .env
```

필수 환경 변수:
- `GEMINI_API_KEY`: Google Gemini API 키
- `SUPABASE_URL`: Supabase 프로젝트 URL (선택사항)
- `SUPABASE_ANON_KEY`: Supabase 익명 키 (선택사항)

### 4. 개발 서버 실행
```bash
# Vite 개발 서버
npm run dev

# 또는 Express 서버
npm run serve
```

### 5. 프로덕션 빌드
```bash
npm run build
```

## 📁 프로젝트 구조

```
ai-chatbot-project/
├── api/                    # API 엔드포인트
│   ├── chat.js            # 메인 채팅 API
│   ├── chat-simple.js     # 간소화된 채팅 API
│   ├── chat-secure.js     # 인증이 적용된 API
│   └── middleware/        # Express 미들웨어
├── js/                    # Frontend JavaScript/TypeScript
│   ├── app.ts            # 메인 애플리케이션
│   ├── chat.ts           # 채팅 관리 모듈
│   ├── security.ts       # 보안 유틸리티
│   ├── utils.ts          # 공통 유틸리티
│   ├── services/         # API 서비스
│   └── i18n/             # 다국어 지원
├── css/                  # 스타일시트
├── icons/                # PWA 아이콘
├── index.html           # 메인 HTML
├── manifest.json        # PWA 매니페스트
└── sw.js                # Service Worker

```

## 🔧 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# TypeScript 타입 체크
npm run type-check

# ESLint 실행
npm run lint

# 코드 자동 수정
npm run lint:fix

# Prettier 포맷팅
npm run format

# 프로덕션 빌드
npm run build
```

## 🔐 보안 기능

- **Rate Limiting**: IP별 분당 20회 요청 제한
- **Input Validation**: 모든 입력값 검증 및 sanitization
- **XSS Protection**: HTML 이스케이프 및 CSP 헤더
- **CORS Policy**: 허가된 origin만 접근 가능
- **API Key Authentication**: 프로덕션 환경에서 API 키 인증

## 🌍 다국어 설정

브라우저 설정에 따라 자동으로 언어가 선택되며, 다음 언어를 지원합니다:
- 🇰🇷 한국어 (ko)
- 🇺🇸 영어 (en)
- 🇯🇵 일본어 (ja)
- 🇨🇳 중국어 (zh)
- 🇮🇩 인도네시아어 (id)

## 📝 환경 변수 설명

| 변수명 | 설명 | 필수 여부 |
|--------|------|----------|
| `GEMINI_API_KEY` | Google Gemini API 키 | ✅ 필수 |
| `SUPABASE_URL` | Supabase 프로젝트 URL | ⚪ 선택 |
| `SUPABASE_ANON_KEY` | Supabase 익명 키 | ⚪ 선택 |
| `PRODUCTION_URL` | 프로덕션 URL (CORS 설정) | ⚪ 선택 |
| `VALID_API_KEYS` | API 인증 키 (쉼표로 구분) | ⚪ 선택 |
| `NODE_ENV` | 환경 설정 (development/production) | ⚪ 선택 |

## 🚀 배포

### Vercel 배포
1. [Vercel](https://vercel.com)에 로그인
2. "New Project" 클릭
3. GitHub 저장소 연결
4. 환경 변수 설정
5. Deploy 클릭

### 수동 배포
```bash
# 빌드
npm run build

# 빌드된 파일은 dist/ 폴더에 생성됩니다
```

## 🤝 기여 방법

1. Fork 저장소
2. Feature 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

## 📄 라이선스

이 프로젝트는 ISC 라이선스 하에 배포됩니다.

## 👥 개발팀

- **Online Studio** - 한국의 두 대학생이 운영하는 개발 스튜디오

## 📞 문의

- 이슈: [GitHub Issues](https://github.com/parkjaeuk0210/ai-chatbot-project/issues)
- 이메일: [이메일 주소]

---

Made with ❤️ by Online Studio