// Secure chat API for PERA Studio.
// Handles text chat and image generation through the configured Gemini API key.
import { filterGeminiResponse, logFilteredContent } from './middleware/responseFilter.js';

const IMAGE_MODEL_ALIASES = new Set(['imagen', 'gemini-image', 'image']);
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 20);
const MAX_PERSONA_LENGTH = 6000;
const MAX_TEXT_PROMPT_LENGTH = 120_000;
const MAX_IMAGE_PROMPT_LENGTH = 2000;
const rateLimitStore = new Map();

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getRateLimitKey(request, sessionId) {
  const ip = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || request.socket?.remoteAddress || 'unknown';
  return `${String(ip).split(',')[0].trim()}-${sessionId || 'anonymous'}`;
}

function checkRateLimit(key) {
  const now = Date.now();
  const previous = rateLimitStore.get(key) || [];
  const valid = previous.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW);

  if (valid.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  valid.push(now);
  rateLimitStore.set(key, valid);

  if (rateLimitStore.size > 1000) {
    for (const [entryKey, timestamps] of rateLimitStore.entries()) {
      if (!timestamps.length || now - timestamps[timestamps.length - 1] > RATE_LIMIT_WINDOW) {
        rateLimitStore.delete(entryKey);
      }
    }
  }

  return true;
}

function validateChatInput(data = {}) {
  const errors = [];
  const modelKey = data.model || 'gemini';
  const isImageModel = IMAGE_MODEL_ALIASES.has(modelKey);

  if (!data.sessionId || typeof data.sessionId !== 'string') {
    errors.push('sessionId is required and must be a string');
  }

  if (data.model && !IMAGE_MODEL_ALIASES.has(data.model) && data.model !== 'gemini') {
    errors.push('Invalid model specified');
  }

  if (data.persona && typeof data.persona !== 'string') {
    errors.push('persona must be a string');
  }

  if (data.persona && data.persona.length > MAX_PERSONA_LENGTH) {
    errors.push(`persona is too long (max ${MAX_PERSONA_LENGTH} characters)`);
  }

  if (isImageModel) {
    if (!data.chatHistory || typeof data.chatHistory !== 'string') {
      errors.push('chatHistory must be a string for image generation');
    } else if (data.chatHistory.trim().length === 0) {
      errors.push('chatHistory cannot be empty for image generation');
    } else if (data.chatHistory.length > MAX_IMAGE_PROMPT_LENGTH) {
      errors.push(`chatHistory is too long for image generation (max ${MAX_IMAGE_PROMPT_LENGTH} characters)`);
    }
    return errors;
  }

  if (!Array.isArray(data.chatHistory)) {
    errors.push('chatHistory must be an array');
    return errors;
  }

  if (data.chatHistory.length > 100) {
    errors.push('chatHistory is too long (max 100 messages)');
  }

  data.chatHistory.forEach((message, index) => {
    if (!message || typeof message !== 'object') {
      errors.push(`Invalid message at index ${index}`);
      return;
    }

    if (!['user', 'assistant', 'model'].includes(message.role)) {
      errors.push(`Invalid role at index ${index}`);
    }

    if (!Array.isArray(message.parts)) {
      errors.push(`Invalid parts at index ${index}`);
    }

    const messageSize = JSON.stringify(message).length;
    if (messageSize > MAX_TEXT_PROMPT_LENGTH) {
      errors.push(`Message at index ${index} is too large`);
    }
  });

  return errors;
}

function sanitizeText(text) {
  return String(text)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

function sanitizeInput(data) {
  const sanitized = JSON.parse(JSON.stringify(data));

  if (Array.isArray(sanitized.chatHistory)) {
    sanitized.chatHistory.forEach((message) => {
      if (Array.isArray(message.parts)) {
        message.parts.forEach((part) => {
          if (typeof part.text === 'string') {
            part.text = sanitizeText(part.text).slice(0, MAX_TEXT_PROMPT_LENGTH);
          }
        });
      }
    });
  } else if (typeof sanitized.chatHistory === 'string') {
    sanitized.chatHistory = sanitizeText(sanitized.chatHistory).slice(0, MAX_IMAGE_PROMPT_LENGTH);
  }

  if (typeof sanitized.persona === 'string') {
    sanitized.persona = sanitizeText(sanitized.persona).slice(0, MAX_PERSONA_LENGTH);
  }

  return sanitized;
}

function mapRole(role) {
  return role === 'assistant' ? 'model' : role;
}

function buildTextPayload(chatHistory, persona, mode) {
  const contentsForApi = chatHistory.slice(-50).map((message) => ({
    ...message,
    role: mapRole(message.role),
  }));

  if (persona) {
    const personaInstruction = [
      persona,
      '',
      '[PERA Studio response contract]',
      '- Answer in the user\'s language unless they ask otherwise.',
      '- Be clear about uncertainty and avoid unsupported claims.',
      '- When context files or URLs are provided, use them explicitly and mention limitations.',
      mode ? `- Current work mode: ${mode}.` : '',
    ].filter(Boolean).join('\n');

    if (contentsForApi[0]?.role === 'user') {
      contentsForApi[0].parts = [{ text: `${personaInstruction}\n\n` }, ...(contentsForApi[0].parts || [])];
    } else {
      contentsForApi.unshift({ role: 'user', parts: [{ text: personaInstruction }] });
    }
  }

  return {
    contents: contentsForApi,
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };
}

function buildImagePayload(prompt) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt.trim() }] }],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
    },
  };
}

async function callGemini(apiUrl, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseText = await googleResponse.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { raw: responseText };
    }

    if (!googleResponse.ok) {
      const message = data?.error?.message || data?.message || 'AI service request failed';
      const error = new Error(message);
      error.status = googleResponse.status;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(request, response) {
  setSecurityHeaders(response);

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  const startedAt = Date.now();

  try {
    const requestData = request.body || {};
    const validationErrors = validateChatInput(requestData);
    if (validationErrors.length) {
      return response.status(400).json({ message: '잘못된 요청입니다.', errors: validationErrors });
    }

    const rateLimitKey = getRateLimitKey(request, requestData.sessionId);
    if (!checkRateLimit(rateLimitKey)) {
      return response.status(429).json({ message: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return response.status(500).json({ message: '서버 설정 오류가 발생했습니다.' });
    }

    const sanitizedData = sanitizeInput(requestData);
    const resolvedModel = sanitizedData.model || 'gemini';
    const isImageModel = IMAGE_MODEL_ALIASES.has(resolvedModel);
    const modelName = isImageModel ? 'gemini-2.5-flash-image-preview' : 'gemini-2.5-flash-lite-preview-06-17';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = isImageModel
      ? buildImagePayload(sanitizedData.chatHistory)
      : buildTextPayload(sanitizedData.chatHistory, sanitizedData.persona, sanitizedData.mode);

    const data = await callGemini(apiUrl, payload);
    const filteredData = filterGeminiResponse(data);

    if (process.env.NODE_ENV !== 'production') {
      logFilteredContent(data, filteredData);
    }

    response.setHeader('X-Response-Time', `${Date.now() - startedAt}ms`);
    return response.status(200).json(filteredData);
  } catch (error) {
    console.error('PERA Studio API error:', error);

    if (error.name === 'AbortError') {
      return response.status(504).json({ message: '요청 시간이 초과되었습니다. 다시 시도해주세요.' });
    }

    if (error.status === 429) {
      return response.status(429).json({ message: 'AI 서비스 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
    }

    if (error.status && error.status >= 400 && error.status < 500) {
      return response.status(error.status).json({ message: 'AI 서비스 요청을 처리할 수 없습니다.' });
    }

    return response.status(500).json({ message: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
}
