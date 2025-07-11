// Edge Runtime 버전
export const config = {
  runtime: 'edge',
  regions: ['icn1'], // 서울 리전
};

export default async function handler(request) {
  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONS 요청 처리
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // POST 요청만 허용
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ message: '허용되지 않은 메서드입니다.' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ message: '서버에 API 키가 설정되지 않았습니다.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { chatHistory, model, persona, sessionId, url } = await request.json();
    
    const isImagen = model === 'imagen';
    const modelName = isImagen 
      ? 'imagen-4.0-ultra-generate-preview-06-06' 
      : 'gemini-2.5-flash-lite-preview-06-17';
    
    const apiUrl = isImagen
      ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      return new Response(
        JSON.stringify({ message: `Google API 에러: ${errorText}` }),
        { 
          status: googleResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await googleResponse.json();
    
    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ message: `서버 내부 오류가 발생했습니다: ${error.message}` }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}