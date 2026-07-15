# 로컬에서 Vercel 배포 환경 재현하기

## 문제 상황
- 로컬: 버튼이 정상 작동
- Vercel: 버튼이 작동하지 않음

## 로컬에서 Vercel과 동일한 문제 재현 방법

### 방법 1: Express 서버 사용 (권장)
```bash
npm install
npm run build
npm run dev
```
브라우저에서 http://localhost:3000 접속

3000번 포트가 이미 사용 중이면 다음처럼 다른 포트를 지정합니다.

```bash
PORT=3001 npm run dev
```

### 방법 2: Python 정적 서버 사용
```bash
python3 local-server.py
```
브라우저에서 http://localhost:8000 접속

### 방법 3: 브라우저에서 file:// 프로토콜로 열기
```bash
# Windows
start index.html

# Mac
open index.html

# Linux
xdg-open index.html
```

### 방법 4: Chrome에서 보안 설정으로 테스트
Chrome을 다음 플래그로 실행:
```bash
# Windows
chrome.exe --disable-web-security --user-data-dir="C:/temp"

# Mac/Linux
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev"
```

## 문제 원인 분석

### 로컬 서버 (npm run dev 등) 사용 시:
- CORS 정책이 느슨함
- 정적 파일과 `/api/chat` 목업이 같은 Origin에서 제공됨
- 로컬에서 빌드된 CSS와 분리된 JS 파일이 로드됨

### Vercel 배포 시:
- `vercel.json`의 CSP와 보안 헤더 적용
- ES6 모듈 로딩 시 MIME 타입 검증
- `/api/chat`은 실제 Gemini API 키를 사용

## 디버깅 방법

1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭 확인
3. Network 탭에서 JS 파일 로딩 확인
4. 다음 오류 확인:
   - MIME type 오류
   - CORS 오류
   - Module not found 오류
   - CSP violation 오류
