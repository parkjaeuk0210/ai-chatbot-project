import { kv } from '@vercel/kv';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const MAX_REQUESTS = 20; // 분당 최대 요청 수

export async function rateLimit(request) {
  try {
    // IP 주소 또는 세션 ID를 키로 사용
    const identifier = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'anonymous';
    
    const key = `rate-limit:${identifier}`;
    const now = Date.now();
    
    // 현재 요청 횟수 가져오기
    const requests = await kv.get(key) || [];
    
    // 시간 창 내의 요청만 필터링
    const recentRequests = requests.filter(timestamp => 
      now - timestamp < RATE_LIMIT_WINDOW
    );
    
    // 제한 초과 확인
    if (recentRequests.length >= MAX_REQUESTS) {
      const oldestRequest = Math.min(...recentRequests);
      const retryAfter = Math.ceil((oldestRequest + RATE_LIMIT_WINDOW - now) / 1000);
      
      return {
        limited: true,
        retryAfter,
        message: `요청 한도를 초과했습니다. ${retryAfter}초 후에 다시 시도해주세요.`
      };
    }
    
    // 새 요청 추가
    recentRequests.push(now);
    await kv.set(key, recentRequests, { ex: Math.ceil(RATE_LIMIT_WINDOW / 1000) });
    
    return {
      limited: false,
      remaining: MAX_REQUESTS - recentRequests.length
    };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // KV 오류 시 요청 허용 (fail open)
    return { limited: false };
  }
}