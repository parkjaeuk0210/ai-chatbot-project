// 이 파일은 Vercel에서 백엔드 서버처럼 동작합니다.
// 페르소나 기능을 지원하도록 수정되었습니다.

export default async function handler(request, response) {
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
    // *** 수정된 부분: persona를 요청 본문에서 받아옵니다. ***
    const { chatHistory, model, persona } = request.body;
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
      // *** 수정된 부분: Gemini 요청 시 payload 구성 변경 ***
      payload = {
        contents: chatHistory,
        tools: [{ "googleSearch": {} }]
      };
      // 페르소나 정보가 있으면 system instruction으로 추가
      if (persona) {
        payload.system = {
          parts: [{ text: persona }]
        };
        console.log("적용된 페르소나:", persona);
      }
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
