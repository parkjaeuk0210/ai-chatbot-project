# FERA AI API Documentation

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://fera-ai.vercel.app/api`

## Authentication

For protected endpoints, include the API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### 1. Chat Completion

Send a message to the AI and receive a response.

**Endpoint:** `POST /api/chat`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_API_KEY` (required in production)

**Request Body:**
```json
{
  "chatHistory": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Hello, how are you?"
        }
      ]
    }
  ],
  "sessionId": "session-123456789",
  "model": "gemini",
  "persona": "You are a helpful assistant"
}
```

**Request Parameters:**
- `chatHistory` (required): Array of previous messages in the conversation
  - `role`: Either "user" or "model"
  - `parts`: Array of message parts
    - `text`: The message text
    - `inlineData`: (optional) For image data
      - `mimeType`: MIME type of the image
      - `data`: Base64 encoded image data
- `sessionId` (optional): Unique session identifier
- `model` (optional): Either "gemini" (default) or "imagen"
- `persona` (optional): Custom instructions for the AI

**Response:**
```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          {
            "text": "I'm doing great! How can I help you today?"
          }
        ]
      }
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request`: Invalid input data
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력 데이터가 올바르지 않습니다.",
    "details": [
      {
        "field": "chatHistory",
        "message": "chatHistory must be an array"
      }
    ]
  }
}
```

- `401 Unauthorized`: Missing or invalid API key
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다."
  }
}
```

- `429 Too Many Requests`: Rate limit exceeded
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요."
  }
}
```

- `500 Internal Server Error`: Server error
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "서버 내부 오류가 발생했습니다."
  }
}
```

### 2. Image Generation

Generate an image from a text description.

**Endpoint:** `POST /api/chat`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_API_KEY` (required in production)

**Request Body:**
```json
{
  "chatHistory": "A beautiful sunset over mountains",
  "model": "imagen"
}
```

**Response:**
```json
{
  "predictions": [
    {
      "bytesBase64Encoded": "iVBORw0KGgoAAAANSUhEUgA..."
    }
  ]
}
```

## Rate Limits

- **Without Authentication**: 20 requests per minute per IP
- **With Authentication**: 100 requests per minute per API key

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: When the rate limit window resets (ISO 8601)

## Security

### Input Validation
- Maximum request size: 1MB
- Maximum chat history length: 100 messages
- Maximum message length: 50,000 characters
- Maximum persona length: 1,000 characters

### Sanitization
All user inputs are sanitized to prevent:
- XSS attacks
- Script injection
- SSRF attacks (URL validation)

### CORS Policy
- Allowed origins are restricted in production
- Preflight caching is enabled for 24 hours

## Examples

### Node.js Example
```javascript
const response = await fetch('https://fera-ai.vercel.app/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    chatHistory: [
      {
        role: 'user',
        parts: [{ text: 'What is the weather like today?' }]
      }
    ],
    sessionId: 'my-session-123'
  })
});

const data = await response.json();
console.log(data.candidates[0].content.parts[0].text);
```

### Python Example
```python
import requests

url = "https://fera-ai.vercel.app/api/chat"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
}
data = {
    "chatHistory": [
        {
            "role": "user",
            "parts": [{"text": "What is the weather like today?"}]
        }
    ],
    "sessionId": "my-session-123"
}

response = requests.post(url, json=data, headers=headers)
result = response.json()
print(result["candidates"][0]["content"]["parts"][0]["text"])
```

### cURL Example
```bash
curl -X POST https://fera-ai.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "chatHistory": [
      {
        "role": "user",
        "parts": [{"text": "What is the weather like today?"}]
      }
    ],
    "sessionId": "my-session-123"
  }'
```

## Webhook Events (Coming Soon)

Future support for webhooks to receive notifications about:
- Chat session completion
- Error events
- Usage threshold alerts

## SDK Support (Coming Soon)

Official SDKs planned for:
- JavaScript/TypeScript
- Python
- Go
- Java

---

For questions or support, please open an issue on [GitHub](https://github.com/parkjaeuk0210/ai-chatbot-project/issues).