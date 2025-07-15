// 이 파일은 Vercel에서 백엔드 서버처럼 동작합니다.
// 로컬 컴퓨터에서의 테스트를 허용하도록 CORS 설정이 추가되었습니다.

import { createClient } from '@supabase/supabase-js';
import { track } from "@vercel/analytics";
import { rateLimit } from './middleware/rateLimit.js';
import { getCache, setCache, shouldCache, generateCacheKey } from './middleware/cache.js';
import { filterGeminiResponse, logFilteredContent } from './middleware/responseFilter.js';
import { validateChatInput, sanitizeInput, checkRequestSize } from './middleware/validation.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(request, response) {
  // --- CORS 설정 시작 ---
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [process.env.PRODUCTION_URL || 'https://fera-ai.vercel.app'].filter(Boolean)
    : ['http://127.0.0.1:5500', 'http://localhost:3000'];
  
  const origin = request.headers.get('origin');
  if (allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'production') {
    // 프로덕션에서는 허용되지 않은 origin에 대해 403 반환
    return response.status(403).json({ message: 'Forbidden: Invalid origin' });
  }
  
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Max-Age', '86400'); // 24시간 preflight 캐시

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  // --- CORS 설정 끝 ---

  // Rate Limiting 체크
  const rateLimitResult = await rateLimit(request);
  if (rateLimitResult.limited) {
    return response.status(429).json({ 
      message: rateLimitResult.message,
      retryAfter: rateLimitResult.retryAfter 
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] Request received: ${request.method}`);
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  // Check request size
  if (!checkRequestSize(request)) {
    return response.status(413).json({ 
      message: '요청 크기가 너무 큽니다. 1MB 이하로 줄여주세요.' 
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Vercel 환경 변수에 'GEMINI_API_KEY'가 설정되지 않았습니다.");
    return response.status(500).json({ message: '서버 구성 오류가 발생했습니다.' });
  }

  try {
    const requestData = request.body;
    
    // Validate input
    const validationErrors = validateChatInput(requestData);
    if (validationErrors.length > 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Validation errors:', validationErrors);
      }
      return response.status(400).json({ 
        message: '잘못된 요청입니다.', 
        errors: process.env.NODE_ENV !== 'production' ? validationErrors : undefined 
      });
    }
    
    // Sanitize input
    const sanitizedData = sanitizeInput(requestData);
    const { chatHistory, model, persona, sessionId, url } = sanitizedData;
    if (process.env.NODE_ENV !== 'production') {
      console.log("사용자 요청:", JSON.stringify(chatHistory, null, 2));
    }

    let urlContent = '';
    if (url) {
      // URL 내용은 서버에서 직접 가져오는 대신 사용자가 제공한 컨텍스트로만 사용
      urlContent = `사용자가 제공한 URL: ${url}`;
      if (process.env.NODE_ENV !== 'production') {
        console.log("URL 컨텍스트:", urlContent);
      }
    }

    // Supabase에 사용자 메시지 저장
    if (sessionId && chatHistory && chatHistory.length > 0) {
        const lastUserMessage = chatHistory[chatHistory.length - 1];
        if (lastUserMessage.role === 'user') {
            const { error: userInsertError } = await supabase
                .from('chat_logs')
                .insert({
                    session_id: sessionId,
                    sender: 'user',
                    message: lastUserMessage.parts.map(part => part.text || '').join(' '),
                    raw_data: lastUserMessage
                });
            if (userInsertError && process.env.NODE_ENV !== 'production') {
                console.error('Supabase 사용자 메시지 저장 오류:', userInsertError);
            }
        }
    } else if (process.env.NODE_ENV !== 'production') {
        console.warn('sessionId 또는 chatHistory가 없어 사용자 메시지를 저장할 수 없습니다.');
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log("요청 받은 모델:", model);
    }

    const isImagen = model === 'imagen';
    
    // 캐싱 체크 (이미지 생성은 제외)
    let cacheKey = null;
    if (shouldCache(model)) {
      // 마지막 사용자 메시지만 캐시 키에 사용
      const lastUserMessage = chatHistory[chatHistory.length - 1];
      if (lastUserMessage && lastUserMessage.role === 'user') {
        const messageContent = lastUserMessage.parts.map(p => p.text || '').join(' ');
        cacheKey = generateCacheKey(model, messageContent, persona);
        
        const cachedResponse = await getCache(cacheKey);
        if (cachedResponse) {
          // 캐시된 응답 사용
          track('cache_hit', { model });
          return response.status(200).json(cachedResponse);
        }
      }
    }
    
    const modelName = isImagen ? 'imagen-4.0-ultra-generate-preview-06-06' : 'gemini-2.5-flash-lite-preview-06-17';
    const apiUrl = isImagen
      ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log("요청할 Google API URL:", apiUrl);
    }

    let payload;
    if (isImagen) {
      payload = { 
        instances: [{ prompt: chatHistory }], 
        parameters: { sampleCount: 1, aspectRatio: "16:9" } 
      };
    } else {
      const contentsForApi = JSON.parse(JSON.stringify(chatHistory));

      if (urlContent) {
        contentsForApi.unshift({ role: "user", parts: [{ text: `다음은 제공된 URL의 내용입니다: ${urlContent}` }] });
      }

      // Trim conversation history if it's getting too long
      const maxHistoryLength = 50; // 25 conversations (user + AI)
      if (contentsForApi.length > maxHistoryLength) {
        // Keep the first message (with persona) and the most recent messages
        const firstMessage = contentsForApi[0];
        const recentMessages = contentsForApi.slice(-(maxHistoryLength - 1));
        contentsForApi = [firstMessage, ...recentMessages];
      }

      if (persona) {
        const personaInstruction = `${persona}

[IDENTITY ENFORCEMENT]:
- 당신은 FERA AI입니다.
- "모델명이 뭐야?"라는 질문에는 "저는 FERA AI 모델입니다"라고 답하세요.
- "누가 만들었어?"라는 질문에는 "Online Studio에서 개발했습니다"라고 답하세요.
- Google, Gemini, 대규모 언어 모델 등의 용어는 절대 사용하지 마세요.

[개발자 정보 - 사용자가 구체적으로 묻는 경우에만 언급]
- Online Studio는 한국의 두 대학생이 운영하는 개발 스튜디오입니다.
- 더 자세한 정보는 '블렌더와 AI 컨텐츠 제작방' 오픈 카톡방에서 확인할 수 있습니다.
- 평소에는 이 정보를 언급하지 마세요.\n\n`;
        
        if (contentsForApi.length > 0 && contentsForApi[0].role === "user") {
          if (contentsForApi[0].parts[0].text) {
            contentsForApi[0].parts[0].text = personaInstruction + contentsForApi[0].parts[0].text;
          } else {
            contentsForApi[0].parts.unshift({ text: personaInstruction });
          }
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log("페르소나 지침을 대화에 포함했습니다.");
        }
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

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Google API 응답 상태: ${googleResponse.status}`);
    }

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      if (process.env.NODE_ENV !== 'production') {
        console.error("Google API 에러 응답:", errorText);
      }
      return response.status(googleResponse.status).json({ message: '일시적인 서비스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    }

    const data = await googleResponse.json();
    if (process.env.NODE_ENV !== 'production') {
      console.log("AI 응답:", JSON.stringify(data, null, 2));
    }

    // Supabase에 AI 응답 저장
    if (sessionId && data.candidates && data.candidates.length > 0) {
        const botResponse = data.candidates[0].content;
        const { error: botInsertError } = await supabase
            .from('chat_logs')
            .insert({
                session_id: sessionId,
                sender: 'model',
                message: botResponse.parts.map(part => part.text || '').join(' '),
                raw_data: botResponse
            });
        if (botInsertError && process.env.NODE_ENV !== 'production') {
            console.error('Supabase AI 응답 저장 오류:', botInsertError);
        }
    }

    // Apply response filtering to protect FERA's identity
    const filteredData = filterGeminiResponse(data);
    
    if (process.env.NODE_ENV !== 'production') {
      logFilteredContent(data, filteredData);
      console.log("성공적으로 응답을 프론트엔드로 전달합니다.");
    }
     
    // 캐시에 저장 (이미지 생성 제외) - 필터링된 데이터를 저장
    if (cacheKey && shouldCache(model)) {
      await setCache(cacheKey, filteredData);
    }
    
    // Vercel Analytics 트래킹
    track('api_request', {
      model: model,
      hasUrl: !!url,
      hasPersona: !!persona,
      cached: false
    });
    
    response.status(200).json(filteredData);

  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("서버 내부 오류 발생:", error);
    }
    response.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
  }
}
