"""
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // CORS pre-flight 요청 처리
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5500');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return response.status(200).end();
  }
  
  // POST 요청만 허용
  if (request.method !== 'POST') {
    return response.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  try {
    const { sessionId, chatHistory } = request.body;

    if (!sessionId || !chatHistory) {
      return response.status(400).json({ message: 'sessionId와 chatHistory는 필수입니다.' });
    }

    // 고유한 sessionId를 key로 사용하여 채팅 기록을 Vercel KV에 저장
    await kv.set(`chat:${sessionId}`, chatHistory);

    console.log(`채팅 기록 저장 완료: ${sessionId}`);
    return response.status(200).json({ message: '채팅 기록이 성공적으로 저장되었습니다.' });

  } catch (error) {
    console.error('채팅 기록 저장 중 오류 발생:', error);
    return response.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
  }
}
""