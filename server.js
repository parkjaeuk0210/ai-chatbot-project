import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const vercelConfig = JSON.parse(readFileSync(join(__dirname, 'vercel.json'), 'utf8'));
const securityHeaders = vercelConfig.headers?.[0]?.headers || [];

app.use((req, res, next) => {
  securityHeaders.forEach(({ key, value }) => {
    res.setHeader(key, value);
  });
  next();
});

// 정적 파일 제공 (Vercel과 동일하게)
app.use(express.static('.'));

// API 엔드포인트 모킹 (로컬 테스트용)
app.post('/api/chat', express.json({ limit: '2mb' }), (req, res) => {
  console.log('API request received:', {
    model: req.body.model,
    sessionId: req.body.sessionId,
    hasHistory: Boolean(req.body.chatHistory)
  });

  if (req.body.model === 'gemini-image') {
    return res.json({
      candidates: [{
        content: {
          role: 'model',
          parts: [{
            inlineData: {
              mimeType: 'image/png',
              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
            }
          }]
        }
      }]
    });
  }

  res.json({
    candidates: [{
      content: {
        role: 'model',
        parts: [{
          text: `로컬 서버에서의 테스트 응답입니다. 세션: ${req.body.sessionId || 'unknown'}`
        }]
      }
    }]
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
