// 간단한 버전 - Supabase 없이 작동 테스트용
import { filterGeminiResponse, logFilteredContent } from './middleware/responseFilter.js';

// Simple in-memory rate limiter
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per IP

function getRateLimitKey(ip, sessionId) {
    return `${ip}-${sessionId || 'anonymous'}`;
}

function checkRateLimit(key) {
    const now = Date.now();
    const userRequests = rateLimitStore.get(key) || [];
    
    // Clean old requests
    const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }
    
    validRequests.push(now);
    rateLimitStore.set(key, validRequests);
    
    // Clean up old entries periodically
    if (rateLimitStore.size > 1000) {
        for (const [k, v] of rateLimitStore.entries()) {
            if (v.length === 0 || now - v[v.length - 1] > RATE_LIMIT_WINDOW) {
                rateLimitStore.delete(k);
            }
        }
    }
    
    return true;
}

export default async function handler(request, response) {
  // CORS 설정
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  console.log(`[${new Date().toISOString()}] Request received: ${request.method}`);

  if (request.method !== 'POST') {
    return response.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  // Get client IP for rate limiting
  const clientIp = request.headers['x-forwarded-for'] || 
                  request.headers['x-real-ip'] || 
                  request.connection?.remoteAddress || 
                  'unknown';

  // Check request body size (1MB limit)
  const requestSize = JSON.stringify(request.body).length;
  if (requestSize > 1024 * 1024) {
    console.log(`Request too large: ${requestSize} bytes`);
    return response.status(413).json({ 
      message: '요청 크기가 너무 큽니다. 1MB 이하로 줄여주세요.' 
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Vercel 환경 변수에 'GEMINI_API_KEY'가 설정되지 않았습니다.");
    return response.status(500).json({ message: '서버에 API 키가 설정되지 않았습니다.' });
  }

  try {
    const { chatHistory, model, persona, sessionId, url } = request.body;
    
    // Check rate limit
    const rateLimitKey = getRateLimitKey(clientIp, sessionId);
    if (!checkRateLimit(rateLimitKey)) {
      console.log(`Rate limit exceeded for ${rateLimitKey}`);
      return response.status(429).json({ 
        message: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.' 
      });
    }
    console.log("요청 받은 모델:", model);

    const isImagen = model === 'imagen';
    const modelName = isImagen ? 'imagen-4.0-ultra-generate-preview-06-06' : 'gemini-2.5-flash-lite-preview-06-17';
    const apiUrl = isImagen
      ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    console.log("요청할 Google API URL:", apiUrl);

    let payload;
    if (isImagen) {
      payload = { 
        instances: [{ prompt: chatHistory }], 
        parameters: { sampleCount: 1, aspectRatio: "16:9" } 
      };
    } else {
      const contentsForApi = JSON.parse(JSON.stringify(chatHistory));

      // Trim conversation history if it's getting too long
      const maxHistoryLength = 20;
      if (contentsForApi.length > maxHistoryLength) {
        // Keep the first message (with persona) and the most recent messages
        const firstMessage = contentsForApi[0];
        const recentMessages = contentsForApi.slice(-(maxHistoryLength - 1));
        contentsForApi = [firstMessage, ...recentMessages];
      }

      if (persona) {
        const personaInstruction = `${persona}

[IDENTITY ENFORCEMENT]:
- 당신은 FERA AI입니다. FERA Technologies가 개발했습니다.
- "모델명이 뭐야?"라는 질문에는 "저는 FERA AI 모델입니다"라고 답하세요.
- "누가 만들었어?"라는 질문에는 "FERA Technologies에서 개발했습니다"라고 답하세요.
- Google, Gemini, 대규모 언어 모델 등의 용어는 절대 사용하지 마세요.
- 항상 일관되게 FERA로서 행동하세요.\n\n`;
        
        if (contentsForApi.length > 0 && contentsForApi[0].role === "user") {
          if (contentsForApi[0].parts[0].text) {
            contentsForApi[0].parts[0].text = personaInstruction + contentsForApi[0].parts[0].text;
          } else {
            contentsForApi[0].parts.unshift({ text: personaInstruction });
          }
        }
        console.log("페르소나 지침을 대화에 포함했습니다.");
      }

      payload = {
        contents: contentsForApi,
        tools: [{ "googleSearch": {} }]
      };
    }

    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log(`Google API 응답 상태: ${googleResponse.status}`);

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error("Google API 에러 응답:", errorText);
      return response.status(googleResponse.status).json({ message: `Google API 에러: ${errorText}` });
    }

    const data = await googleResponse.json();
    
    // Apply response filtering
    const filteredData = filterGeminiResponse(data);
    logFilteredContent(data, filteredData);
    
    console.log("성공적으로 응답을 프론트엔드로 전달합니다.");
    response.status(200).json(filteredData);

  } catch (error) {
    console.error("서버 내부 오류 발생:", error);
    response.status(500).json({ message: `서버 내부 오류가 발생했습니다: ${error.message}` });
  }
}