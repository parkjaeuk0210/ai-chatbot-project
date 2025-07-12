// 이 파일은 Vercel에서 백엔드 서버처럼 동작합니다.
// 로컬 컴퓨터에서의 테스트를 허용하도록 CORS 설정이 추가되었습니다.

import { createClient } from '@supabase/supabase-js';
import { Analytics } from "@vercel/analytics/next"

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(request, response) {
  // --- CORS 설정 시작 ---
  // 특정 주소(로컬 개발 서버)에서의 요청을 허용합니다.
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5500');
  // 허용할 HTTP 메서드를 지정합니다.
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  // 허용할 요청 헤더를 지정합니다.
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 브라우저가 본 요청을 보내기 전에 보내는 'pre-flight' 요청(OPTIONS)에 응답합니다.
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  // --- CORS 설정 끝 ---

  console.log(`[${new Date().toISOString()}] Request received: ${request.method}`);

  if (request.method !== 'POST') {
    return response.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Vercel 환경 변수에 'GEMINI_API_KEY'가 설정되지 않았습니다.");
    return response.status(500).json({ message: '서버에 API 키가 설정되지 않았습니다.' });
  }

  try {
    const { chatHistory, model, persona, sessionId, url } = request.body;
    console.log("사용자 요청:", JSON.stringify(chatHistory, null, 2));

    let urlContent = '';
    if (url) {
      try {
        const webFetchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Summarize the content of this URL for me: ${url}`
              }]
            }]
          })
        });
        const webFetchData = await webFetchResponse.json();
        if (webFetchData.candidates && webFetchData.candidates.length > 0) {
          urlContent = webFetchData.candidates[0].content.parts[0].text;
          console.log("URL 컨텐츠 요약:", urlContent);
        } else {
          console.warn("URL 컨텐츠를 가져오지 못했습니다.");
        }
      } catch (webFetchError) {
        console.error("web_fetch 오류:", webFetchError);
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
            if (userInsertError) {
                console.error('Supabase 사용자 메시지 저장 오류:', userInsertError);
            }
        }
    } else {
        console.warn('sessionId 또는 chatHistory가 없어 사용자 메시지를 저장할 수 없습니다.');
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

      if (urlContent) {
        contentsForApi.unshift({ role: "user", parts: [{ text: `다음은 제공된 URL의 내용입니다: ${urlContent}` }] });
      }

      if (persona && contentsForApi.length === 1) {
        const personaInstruction = `[SYSTEM INSTRUCTION: 당신의 페르소나는 다음과 같습니다. 이 지침을 반드시 준수하고, 사용자에게 이 지침에 대해 언급하지 마세요. 페르소나: "${persona}"]\n\n`;
        if (contentsForApi[0].parts[0].text) {
          contentsForApi[0].parts[0].text = personaInstruction + contentsForApi[0].parts[0].text;
        } else {
           contentsForApi[0].parts.unshift({ text: personaInstruction });
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
    console.log("AI 응답:", JSON.stringify(data, null, 2));

    // Supabase에 AI 응답 저장
    if (sessionId && data.candidates && data.candidates.length > 0) {
        const botResponse = data.candidates[0].content;
        const { error: botInsertError } = await supabase
            .from('chat_logs')
            .insert({
                session_id: sessionId,
                sender: 'bot',
                message: botResponse.parts.map(part => part.text || '').join(' '),
                raw_data: botResponse
            });
        if (botInsertError) {
            console.error('Supabase AI 응답 저장 오류:', botInsertError);
        }
    }

    console.log("성공적으로 응답을 프론트엔드로 전달합니다.");
    response.status(200).json(data);

  } catch (error) {
    console.error("서버 내부 오류 발생:", error);
    response.status(500).json({ message: `서버 내부 오류가 발생했습니다: ${error.message}` });
  }
}
