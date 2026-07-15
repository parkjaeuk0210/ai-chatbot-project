# PERA 배포 가이드

## Vercel 프로젝트 설정

이 저장소는 프레임워크 없는 정적 프런트와 Node.js Serverless Function을 함께 배포합니다.

- Build Command: `npm run build`
- Output Directory: `public` (`vercel.json`에도 명시)
- Install Command: 기본값
- Node.js: 22.x

프로덕션에는 `GEMINI_API_KEY`를 반드시 설정합니다. 모델을 고정해야 할 때만 `GEMINI_CHAT_MODEL`, `GEMINI_IMAGE_MODEL`을 추가합니다.

## 배포 전 게이트

```bash
npm run check
npm test
npm run build
```

세 명령이 통과해야 배포 가능한 상태입니다. 빌드는 기존 `public/`을 삭제한 뒤 승인된 정적 자산만 복사하므로 서버 코드나 개발 파일이 정적 호스팅 영역에 노출되지 않습니다.

## 배포 후 점검

1. `/`에서 채팅·이미지 탭과 설정 대화상자가 정상 동작하는지 확인합니다.
2. `/api/chat`에 POST 요청을 보내고 200 또는 명확한 구성 오류가 반환되는지 확인합니다.
3. 응답 헤더에 CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`가 있는지 확인합니다.
4. 모바일 너비에서 composer가 화면 밖으로 밀리지 않는지 확인합니다.
5. 브라우저 콘솔에 CSP 위반이나 모듈 로딩 오류가 없는지 확인합니다.

## 롤백

문제가 발생하면 Vercel의 직전 READY 배포로 롤백하고, 해당 커밋을 새 브랜치에서 수정합니다. `main`을 직접 덮어쓰지 않습니다.
