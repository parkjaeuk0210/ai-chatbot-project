import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 헤더 설정
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// 정적 파일 제공 (Vercel과 동일하게)
app.use(express.static('.'));

// API 엔드포인트 모킹 (로컬 테스트용)
app.post('/api/chat', express.json(), (req, res) => {
  console.log('API request received:', req.body);
  res.json({
    success: true,
    data: {
      content: '로컬 서버에서의 테스트 응답입니다.',
      sessionId: req.body.sessionId
    }
  });
});

// 모든 경로에 대해 index.html 반환 (SPA 지원)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('This simulates Vercel deployment environment locally');
});