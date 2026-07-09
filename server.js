import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.static(__dirname));

function createMockTextResponse(body) {
  const lastMessage = Array.isArray(body.chatHistory)
    ? [...body.chatHistory].reverse().find((message) => message.role === 'user')
    : null;
  const userText = lastMessage?.parts?.find((part) => part.text)?.text || '요청 내용';

  return {
    candidates: [
      {
        content: {
          role: 'assistant',
          parts: [
            {
              text: `로컬 개발 서버의 PERA Studio 모의 응답입니다.\n\n요청을 받았습니다: ${userText.slice(0, 260)}\n\n- 실제 배포 환경에서는 /api/chat-secure가 Gemini API로 연결됩니다.\n- UI, 첨부, 작업대 흐름을 로컬에서 먼저 확인할 수 있습니다.`,
            },
          ],
        },
      },
    ],
  };
}

app.post(['/api/chat', '/api/chat-secure'], (req, res) => {
  if (req.body?.model === 'gemini-image') {
    return res.json({
      candidates: [
        {
          content: {
            role: 'assistant',
            parts: [{ text: `로컬 모의 이미지 응답입니다. 프롬프트: ${String(req.body.chatHistory || '').slice(0, 240)}` }],
          },
        },
      ],
    });
  }

  return res.json(createMockTextResponse(req.body || {}));
});

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PERA Studio running at http://localhost:${PORT}`);
});
