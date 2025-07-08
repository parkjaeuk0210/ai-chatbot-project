// 이 파일은 Vercel에서 백엔드 서버처럼 동작합니다.
// 안정성과 디버깅을 위해 로그 기능이 강화되었습니다.

export default async function handler(request, response) {
  // 1. 요청이 들어온 시간과 메서드를 로그로 남깁니다.
  console.log(`[${new Date().toISOString()}] Request received: ${request.method}`);

  if (request.method !== 'POST') {
    return response.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  // 2. API 키가 Vercel 환경 변수에 잘 설정되었는지 확인합니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Vercel 환경 변수에 'GEMINI_API_KEY'가 설정되지 않았습니다.");
    return response.status(500).json({ message: '서버에 API 키가 설정되지 않았습니다.' });
  }

  try {
    // 3. 프론트엔드에서 보낸 요청 내용을 로그로 남깁니다.
    const { chatHistory, model } = request.body;
    console.log("요청 받은 모델:", model);

    // 4. 사용할 Google AI 모델과 API 주소를 결정합니다.
    const isImagen = model === 'imagen';
    const modelName = isImagen ? 'imagen-4.0-ultra-generate-preview-06-06' : 'gemini-2.5-flash-lite-preview-06-17';
    const apiUrl = isImagen
      ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    console.log("요청할 Google API URL:", apiUrl);

    // 5. Google AI API에 보낼 데이터(payload)를 구성합니다.
    const payload = isImagen
      // *** 수정된 부분: aspectRatio 파라미터 추가 ***
      ? { instances: [{ prompt: chatHistory }], parameters: { sampleCount: 1, aspectRatio: "16:9" } }
      : { contents: chatHistory, tools: [{ "googleSearch": {} }] };

    // 6. 백엔드 서버에서 Google AI 서버로 실제 API 요청을 보냅니다.
    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 7. Google로부터 받은 응답의 상태를 로그로 남깁니다.
    console.log(`Google API 응답 상태: ${googleResponse.status}`);

    // 8. Google API로부터 에러 응답을 받은 경우, 내용을 로그로 남기고 프론트엔드로 전달합니다.
    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error("Google API 에러 응답:", errorText);
      return response.status(googleResponse.status).json({ message: `Google API 에러: ${errorText}` });
    }

    // 9. 성공적으로 받은 응답을 프론트엔드로 다시 보내줍니다.
    const data = await googleResponse.json();
    console.log("성공적으로 응답을 프론트엔드로 전달합니다.");
    response.status(200).json(data);

  } catch (error) {
    // 10. 우리 백엔드 코드 자체에서 에러가 발생한 경우 로그로 남깁니다.
    console.error("서버 내부 오류 발생:", error);
    response.status(500).json({ message: `서버 내부 오류가 발생했습니다: ${error.message}` });
  }
}
