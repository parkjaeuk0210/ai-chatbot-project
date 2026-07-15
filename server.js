import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const rootDirectory = dirname(filename);
const publicDirectory = existsSync(join(rootDirectory, 'public'))
  ? join(rootDirectory, 'public')
  : rootDirectory;
const port = Number(process.env.PORT || 3000);

const app = express();
const vercelConfig = JSON.parse(readFileSync(join(rootDirectory, 'vercel.json'), 'utf8'));
const securityHeaders = vercelConfig.headers?.[0]?.headers || [];

app.disable('x-powered-by');

app.use((request, response, next) => {
  for (const { key, value } of securityHeaders) {
    response.setHeader(key, value);
  }
  next();
});

app.post('/api/chat', express.json({ limit: '4mb' }), (request, response) => {
  const { chatHistory, model, sessionId } = request.body || {};

  if (!sessionId) {
    return response.status(400).json({ message: 'sessionId is required' });
  }

  if (model === 'gemini-image' || model === 'imagen') {
    return response.json({
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

  const messages = Array.isArray(chatHistory) ? chatHistory : [];
  const lastUserText = [...messages]
    .reverse()
    .find((message) => message?.role === 'user')
    ?.parts
    ?.find((part) => typeof part?.text === 'string')
    ?.text
    ?.trim();

  return response.json({
    candidates: [{
      content: {
        role: 'model',
        parts: [{
          text: lastUserText
            ? `로컬 미리보기 응답입니다.\n\n요청: ${lastUserText.slice(0, 220)}`
            : '로컬 미리보기 응답입니다. 메시지를 입력해 UI 흐름을 확인하세요.'
        }]
      }
    }]
  });
});

app.use(express.static(publicDirectory, {
  extensions: ['html'],
  index: 'index.html',
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

app.get('*', (request, response) => {
  response.sendFile(join(publicDirectory, 'index.html'));
});

app.use((error, request, response, next) => {
  if (error?.type === 'entity.too.large') {
    return response.status(413).json({ message: 'Request body is too large' });
  }

  console.error(error);
  return response.status(500).json({ message: 'Local server error' });
});

app.listen(port, () => {
  console.log(`PERA local preview: http://localhost:${port}`);
  console.log(`Serving static assets from: ${publicDirectory}`);
});
