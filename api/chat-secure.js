// Secure version of the chat API with input validation and rate limiting
import { filterGeminiResponse, containsForbiddenTerms, logFilteredContent } from './middleware/responseFilter.js';

// Simple in-memory rate limiter (for production, use Redis)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per IP

function getRateLimitKey(ip, sessionId) {
    return `${ip}-${sessionId}`;
}

function checkRateLimit(key) {
    const now = Date.now();
    const userRequests = rateLimitStore.get(key) || [];
    
    // Clean old requests
    const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }
    
    validRequests.push(now);
    rateLimitStore.set(key, validRequests);
    
    // Clean up old entries periodically
    if (rateLimitStore.size > 1000) {
        for (const [k, v] of rateLimitStore.entries()) {
            if (v.length === 0 || now - v[v.length - 1] > RATE_LIMIT_WINDOW) {
                rateLimitStore.delete(k);
            }
        }
    }
    
    return true;
}

// Input validation
function validateChatInput(data) {
    const errors = [];
    
    // Check required fields
    if (!data.chatHistory || !Array.isArray(data.chatHistory)) {
        errors.push('chatHistory must be an array');
    }
    
    if (!data.sessionId || typeof data.sessionId !== 'string') {
        errors.push('sessionId is required and must be a string');
    }
    
    // Validate chat history structure
    if (data.chatHistory && Array.isArray(data.chatHistory)) {
        if (data.chatHistory.length > 100) {
            errors.push('chatHistory is too long (max 100 messages)');
        }
        
        data.chatHistory.forEach((msg, index) => {
            if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
                errors.push(`Invalid role at index ${index}`);
            }
            
            if (!msg.parts || !Array.isArray(msg.parts)) {
                errors.push(`Invalid parts at index ${index}`);
            }
            
            // Check message size
            const messageSize = JSON.stringify(msg).length;
            if (messageSize > 100000) { // 100KB per message
                errors.push(`Message at index ${index} is too large`);
            }
        });
    }
    
    // Validate optional fields
    if (data.model && !['gemini', 'imagen'].includes(data.model)) {
        errors.push('Invalid model specified');
    }
    
    if (data.persona && typeof data.persona !== 'string') {
        errors.push('persona must be a string');
    }
    
    if (data.persona && data.persona.length > 1000) {
        errors.push('persona is too long (max 1000 characters)');
    }
    
    if (data.url && typeof data.url !== 'string') {
        errors.push('url must be a string');
    }
    
    // Basic URL validation
    if (data.url) {
        try {
            new URL(data.url);
        } catch {
            errors.push('Invalid URL format');
        }
    }
    
    return errors;
}

// Sanitize input to prevent injection
function sanitizeInput(data) {
    const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone
    
    // Sanitize text content
    if (sanitized.chatHistory && Array.isArray(sanitized.chatHistory)) {
        sanitized.chatHistory.forEach(msg => {
            if (msg.parts && Array.isArray(msg.parts)) {
                msg.parts.forEach(part => {
                    if (part.text && typeof part.text === 'string') {
                        // Remove potential script tags and dangerous content
                        part.text = part.text
                            .replace(/<script[^>]*>.*?<\/script>/gi, '')
                            .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                            .replace(/javascript:/gi, '')
                            .replace(/on\w+\s*=/gi, '');
                    }
                });
            }
        });
    }
    
    if (sanitized.persona) {
        sanitized.persona = sanitized.persona
            .replace(/<[^>]+>/g, '') // Remove HTML tags
            .slice(0, 1000); // Enforce length limit
    }
    
    return sanitized;
}

export default async function handler(request, response) {
    // Security headers
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // CORS settings
    response.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Request received: ${request.method}`);

    if (request.method !== 'POST') {
        return response.status(405).json({ message: '허용되지 않은 메서드입니다.' });
    }

    // Get client IP for rate limiting
    const clientIp = request.headers['x-forwarded-for'] || 
                    request.headers['x-real-ip'] || 
                    request.connection?.remoteAddress || 
                    'unknown';

    try {
        // Parse and validate request body
        const requestData = request.body;
        
        // Validate input
        const validationErrors = validateChatInput(requestData);
        if (validationErrors.length > 0) {
            console.log('Validation errors:', validationErrors);
            return response.status(400).json({ 
                message: '잘못된 요청입니다.', 
                errors: validationErrors 
            });
        }
        
        // Check rate limit
        const rateLimitKey = getRateLimitKey(clientIp, requestData.sessionId);
        if (!checkRateLimit(rateLimitKey)) {
            console.log(`Rate limit exceeded for ${rateLimitKey}`);
            return response.status(429).json({ 
                message: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.' 
            });
        }
        
        // Sanitize input
        const sanitizedData = sanitizeInput(requestData);
        
        // Check API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("API key not configured");
            return response.status(500).json({ message: '서버 설정 오류가 발생했습니다.' });
        }

        const { chatHistory, model, persona, sessionId, url } = sanitizedData;
        console.log(`Processing request for session: ${sessionId}, model: ${model || 'gemini'}`);

        const isImagen = model === 'imagen';
        const modelName = isImagen ? 'imagen-4.0-ultra-generate-preview-06-06' : 'gemini-2.5-flash-lite-preview-06-17';
        const apiUrl = isImagen
            ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`
            : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        let payload;
        if (isImagen) {
            // For image generation, validate prompt
            if (typeof chatHistory !== 'string' || chatHistory.length > 1000) {
                return response.status(400).json({ 
                    message: '이미지 생성 프롬프트가 너무 깁니다.' 
                });
            }
            
            payload = { 
                instances: [{ prompt: chatHistory }], 
                parameters: { sampleCount: 1, aspectRatio: "16:9" } 
            };
        } else {
            const contentsForApi = JSON.parse(JSON.stringify(chatHistory));

            // Trim conversation history if it's getting too long
            const maxHistoryLength = 50; // 25 conversations (user + AI)
            if (contentsForApi.length > maxHistoryLength) {
                // Keep the first message (with persona) and the most recent messages
                const firstMessage = contentsForApi[0];
                const recentMessages = contentsForApi.slice(-(maxHistoryLength - 1));
                contentsForApi = [firstMessage, ...recentMessages];
                
                // Add context note about trimmed history
                if (contentsForApi.length > 1) {
                    contentsForApi.splice(1, 0, {
                        role: "assistant",
                        parts: [{ text: "[이전 대화 내용이 일부 요약되었습니다]" }]
                    });
                }
            }

            // Add persona instruction if provided with enhanced identity enforcement
            if (persona) {
                const personaInstruction = `${persona}

[IDENTITY ENFORCEMENT]:
- 당신은 PERA AI입니다.
- "모델명이 뭐야?"라는 질문에는 "저는 PERA AI 모델입니다"라고 답하세요.
- "누가 만들었어?"라는 질문에는 "Online Studio에서 개발했습니다"라고 답하세요.
- Google, Gemini, 대규모 언어 모델 등의 용어는 절대 사용하지 마세요.
- 항상 일관되게 PERA로서 행동하세요.

[개발자 정보 - 사용자가 구체적으로 묻는 경우에만 언급]
- Online Studio는 한국의 두 대학생이 운영하는 개발 스튜디오입니다.
- 더 자세한 정보는 '블렌더와 AI 컨텐츠 제작방' 오픈 카톡방에서 확인할 수 있습니다.
- 평소에는 이 정보를 언급하지 마세요.\n\n`;
                
                // Always inject at the beginning of the conversation
                if (contentsForApi.length > 0 && contentsForApi[0].role === "user") {
                    if (contentsForApi[0].parts[0].text) {
                        contentsForApi[0].parts[0].text = personaInstruction + contentsForApi[0].parts[0].text;
                    } else {
                        contentsForApi[0].parts.unshift({ text: personaInstruction });
                    }
                } else {
                    // If first message is not user, prepend a system message
                    contentsForApi.unshift({
                        role: "user",
                        parts: [{ text: personaInstruction + "안녕하세요" }]
                    });
                }
            }

            payload = {
                contents: contentsForApi,
                tools: [{ "googleSearch": {} }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                }
            };
        }

        // Set timeout for API request
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000); // 25 second timeout

        const googleResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);

        console.log(`Google API response status: ${googleResponse.status}`);

        if (!googleResponse.ok) {
            const errorText = await googleResponse.text();
            console.error("Google API error:", googleResponse.status, errorText);
            
            // Don't expose internal API errors to client
            if (googleResponse.status === 429) {
                return response.status(429).json({ 
                    message: 'AI 서비스 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' 
                });
            }
            
            return response.status(googleResponse.status).json({ 
                message: 'AI 서비스에 일시적인 문제가 발생했습니다.' 
            });
        }

        const data = await googleResponse.json();
        
        // Apply response filtering to protect PERA's identity
        const filteredData = filterGeminiResponse(data);
        
        // Log filtered content in development
        if (process.env.NODE_ENV !== 'production') {
            logFilteredContent(data, filteredData);
        }
        
        // Log response time
        const responseTime = Date.now() - startTime;
        console.log(`Request completed in ${responseTime}ms`);
        
        // Add response headers
        response.setHeader('X-Response-Time', `${responseTime}ms`);
        response.status(200).json(filteredData);

    } catch (error) {
        console.error("Server error:", error);
        
        if (error.name === 'AbortError') {
            return response.status(504).json({ 
                message: '요청 시간이 초과되었습니다. 다시 시도해주세요.' 
            });
        }
        
        // Don't expose internal errors
        response.status(500).json({ 
            message: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        });
    }
}