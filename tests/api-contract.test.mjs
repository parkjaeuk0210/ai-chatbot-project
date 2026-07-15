import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeChatHistory,
  normalizeInteractionResponse,
  validateRequest
} from '../api/chat.js';

test('normalizes assistant roles and keeps a user-first conversation', () => {
  const history = normalizeChatHistory([
    { role: 'assistant', parts: [{ text: 'orphaned output' }] },
    { role: 'user', parts: [{ text: 'hello' }] },
    { role: 'assistant', parts: [{ text: 'hi' }] }
  ]);

  assert.equal(history.length, 2);
  assert.equal(history[0].role, 'user');
  assert.equal(history[1].role, 'model');
});

test('validates text and image request contracts', () => {
  const chatErrors = validateRequest({
    model: 'gemini',
    sessionId: 'session-valid-1234',
    chatHistory: [{ role: 'user', parts: [{ text: 'hello' }] }]
  });
  assert.deepEqual(chatErrors, []);

  const imageErrors = validateRequest({
    model: 'gemini-image',
    sessionId: 'session-valid-1234',
    chatHistory: 'Create a quiet glass office at dawn.'
  });
  assert.deepEqual(imageErrors, []);

  assert.ok(validateRequest({ model: 'gemini', chatHistory: [] }).length > 0);
  assert.ok(validateRequest({ model: 'gemini-image', sessionId: 'bad', chatHistory: '' }).length > 0);
});

test('adapts Interactions API image blocks to the browser response contract', () => {
  const normalized = normalizeInteractionResponse({
    id: 'interaction-1',
    steps: [{
      type: 'model_output',
      content: [
        { type: 'text', text: 'Generated image' },
        { type: 'image', mime_type: 'image/png', data: 'aW1hZ2U=' }
      ]
    }]
  });

  assert.equal(normalized.interactionId, 'interaction-1');
  assert.equal(normalized.candidates[0].content.role, 'model');
  assert.equal(normalized.candidates[0].content.parts[1].inlineData.mimeType, 'image/png');
  assert.equal(normalized.candidates[0].content.parts[1].inlineData.data, 'aW1hZ2U=');
});
