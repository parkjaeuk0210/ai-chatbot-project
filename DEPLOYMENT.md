# 🚀 PERA AI 챗봇 - 보안 강화 버전 배포 가이드

## 📋 주요 개선사항

### 1. 보안 강화
- **XSS 방지**: 모든 사용자 입력에 대한 sanitization 적용
- **API 보안**: Rate limiting 및 입력 검증 구현
- **CSP 헤더**: unsafe-inline 제거, nonce 기반 정책 적용
- **보안 헤더**: HSTS, X-Frame-Options 등 추가

### 2. 성능 최적화
- **코드 분리**: JS/CSS 모듈화로 유지보수성 향상
- **메시지 가상화**: 대량 채팅 시 메모리 효율성 개선
- **이미지 압축**: 1MB 이상 이미지 자동 압축

### 3. 코드 품질
- **에러 처리**: 상세한 에러 메시지 및 복구 방안 제공
- **입력 검증**: 모든 사용자 입력에 대한 검증
- **모듈화**: 기능별 파일 분리

## 🔧 배포 방법

### 1. 파일 구조 확인
```
ai-chatbot-project/
├── index-secure.html      # 보안 강화된 메인 파일
├── css/
│   └── styles.css        # 분리된 CSS
├── js/
│   ├── app.js           # 메인 애플리케이션
│   ├── chat.js          # 채팅 기능 모듈
│   └── utils.js         # 유틸리티 함수
├── api/
│   ├── chat-simple.js   # 기존 API (호환성)
│   └── chat-secure.js   # 보안 강화 API
└── vercel-secure.json   # 보안 강화 설정
```

### 2. 환경 변수 설정
Vercel 대시보드에서 다음 환경 변수 추가:
- `GEMINI_API_KEY`: Google AI API 키
- `ALLOWED_ORIGIN`: 허용할 도메인 (예: https://your-domain.vercel.app)

### 3. 배포 명령어
```bash
# 1. 기존 파일 백업
cp index.html index-backup.html
cp vercel.json vercel-backup.json

# 2. 보안 강화 파일로 교체
cp index-secure.html index.html
cp vercel-secure.json vercel.json

# 3. Vercel 배포
vercel --prod
```

### 4. 배포 후 확인사항
- [ ] CSP 헤더가 제대로 적용되었는지 확인
- [ ] Rate limiting이 작동하는지 테스트
- [ ] 모든 기능이 정상 작동하는지 확인
- [ ] 콘솔에 보안 경고가 없는지 확인

## ⚠️ 주의사항

1. **CSP Nonce**: 프로덕션에서는 각 요청마다 고유한 nonce 생성 필요
2. **Rate Limiting**: 현재 메모리 기반 구현, 프로덕션에서는 Redis 권장
3. **API 키 보안**: 환경 변수로만 관리, 코드에 하드코딩 금지

## 🔄 롤백 방법
문제 발생 시:
```bash
cp index-backup.html index.html
cp vercel-backup.json vercel.json
vercel --prod
```

## 📊 모니터링
- Vercel Analytics로 성능 모니터링
- 로그에서 rate limit 초과 및 보안 이벤트 확인
- 정기적인 보안 감사 실시

## 🆘 문제 해결
- **CSP 오류**: vercel.json의 CSP 정책 검토
- **API 연결 실패**: 환경 변수 및 CORS 설정 확인
- **성능 저하**: 메시지 가상화 임계값 조정