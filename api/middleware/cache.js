import { kv } from '@vercel/kv';
import crypto from 'crypto';

const CACHE_TTL = 3600; // 1시간 캐시

// 캐시 키 생성 함수
function generateCacheKey(model, content, persona) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify({ model, content, persona }));
  return `cache:${hash.digest('hex')}`;
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