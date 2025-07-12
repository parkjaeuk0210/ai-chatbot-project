// 간단한 버전 - Supabase 없이 작동 테스트용

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Vercel 환경 변수에 'GEMINI_API_KEY'가 설정되지 않았습니다.");
    return response.status(500).json({ message: '서버에 API 키가 설정되지 않았습니다.' });
  }

  try {
    const { chatHistory, model, persona, sessionId, url } = request.body;
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
    console.log("성공적으로 응답을 프론트엔드로 전달합니다.");
    response.status(200).json(data);

  } catch (error) {
    console.error("서버 내부 오류 발생:", error);
    response.status(500).json({ message: `서버 내부 오류가 발생했습니다: ${error.message}` });
  }
}