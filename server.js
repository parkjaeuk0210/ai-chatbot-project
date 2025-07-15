import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setupSwagger } from './api/swagger.js';

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
  
  // Content Security Policy (CSP)
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://generativelanguage.googleapis.com https://*.supabase.co wss://*.supabase.co",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '));
  
  next();
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Swagger UI for API documentation
if (process.env.NODE_ENV !== 'production') {
  setupSwagger(app);
}

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
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