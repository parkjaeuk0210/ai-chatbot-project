export default async function handler(request, response) {
  // 1. 프론트엔드에서 보낸 요청이 POST 방식이 아니면 에러 처리
  if (request.method !== 'POST') {
    return response.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  // 2. 안전하게 보관된 API 키를 가져옵니다.
  // process.env.GEMINI_API_KEY는 Vercel에 설정할 환경 변수 이름입니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: '서버에 API 키가 설정되지 않았습니다.' });
  }

  // 3. 프론트엔드에서 보낸 채팅 기록(chatHistory)을 받습니다.
  const { chatHistory, model } = request.body;

  // 4. 사용할 Google AI 모델과 API 주소를 결정합니다.
  const modelName = model === 'imagen' ? 'imagen-4.0-ultra-generate-preview-06-06' : 'gemini-2.5-flash-lite-preview-06-17';
  const isImagen = model === 'imagen';
  const apiUrl = isImagen
    ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // 5. Google AI API에 보낼 데이터(payload)를 구성합니다.
  let payload;
  if (isImagen) {
    // Imagen 모델용 payload
    payload = {
      instances: [{ prompt: chatHistory }], // 이미지 생성 프롬프트
      parameters: { sampleCount: 1 }
    };
  } else {
    // Gemini 모델용 payload
    payload = {
      contents: chatHistory,
      tools: [{ "googleSearch": {} }]
    };
  }


  try {
    // 6. 백엔드 서버에서 Google AI 서버로 실제 API 요청을 보냅니다.
    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!googleResponse.ok) {
        const errorData = await googleResponse.json();
        console.error('Google API Error:', errorData);
        return response.status(googleResponse.status).json({ message: errorData.error.message });
    }

    const data = await googleResponse.json();
    
    // 7. 성공적으로 받은 응답을 프론트엔드로 다시 보내줍니다.
    response.status(200).json(data);

  } catch (error) {
    console.error('Internal Server Error:', error);
    response.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
  }
}