import { kv } from '@vercel/kv';

const CACHE_TTL = 3600; // 1시간 캐시

// 캐시 키 생성 함수 (Node.js crypto 사용)
async function generateCacheKey(model, content, persona) {
  // 간단한 해시 함수 사용 (crypto 모듈 없이)
  const str = JSON.stringify({ model, content, persona });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `cache:${Math.abs(hash).toString(16)}`;
}

// 캐시 읽기
export async function getCache(key) {
  try {
    const cached = await kv.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

// 캐시 저장
export async function setCache(key, data, ttl = CACHE_TTL) {
  try {
    await kv.set(key, JSON.stringify(data), { ex: ttl });
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

// 이미지 생성은 캐싱하면 안 되므로 제외
export function shouldCache(model) {
  return model !== 'imagen';
}

export { generateCacheKey };