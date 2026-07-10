import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RendererMode,
  clearRendererMode,
  normalizeRendererMode,
  resolveRendererMode,
  setRendererMode,
} from './featureFlags.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test('Konva remains the safe default', () => {
  assert.deepEqual(resolveRendererMode({ search: '', storage: memoryStorage() }), {
    mode: RendererMode.KONVA,
    source: 'default',
  });
});

test('query parameter takes precedence over stored mode', () => {
  const storage = memoryStorage({ 'pera.renderer.mode': 'konva' });
  assert.deepEqual(resolveRendererMode({ search: '?renderer=auto', storage }), {
    mode: RendererMode.AUTO,
    source: 'query',
  });
});

test('wgpu and webgpu aliases normalize to gpu', () => {
  assert.equal(normalizeRendererMode('wgpu'), RendererMode.GPU);
  assert.equal(normalizeRendererMode('webgpu'), RendererMode.GPU);
});

test('stored mode can be set and cleared', () => {
  const storage = memoryStorage();
  setRendererMode('gpu', { storage });
  assert.equal(resolveRendererMode({ search: '', storage }).mode, RendererMode.GPU);
  clearRendererMode({ storage });
  assert.equal(resolveRendererMode({ search: '', storage }).mode, RendererMode.KONVA);
});
