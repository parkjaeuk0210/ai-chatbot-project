const STORAGE_KEY = 'pera.renderer.mode';
const VALID_MODES = new Set(['konva', 'gpu', 'auto']);

export const RendererMode = Object.freeze({
  KONVA: 'konva',
  GPU: 'gpu',
  AUTO: 'auto',
});

export function normalizeRendererMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'wgpu' || normalized === 'webgpu') return RendererMode.GPU;
  return VALID_MODES.has(normalized) ? normalized : null;
}

export function resolveRendererMode(options = {}) {
  const search = options.search ?? globalThis.location?.search ?? '';
  const storage = options.storage ?? globalThis.localStorage;

  const queryMode = normalizeRendererMode(new URLSearchParams(search).get('renderer'));
  if (queryMode) {
    return { mode: queryMode, source: 'query' };
  }

  try {
    const storedMode = normalizeRendererMode(storage?.getItem(STORAGE_KEY));
    if (storedMode) {
      return { mode: storedMode, source: 'storage' };
    }
  } catch {
    // Storage can be unavailable in privacy modes. The safe default still applies.
  }

  return { mode: RendererMode.KONVA, source: 'default' };
}

export function setRendererMode(mode, options = {}) {
  const normalized = normalizeRendererMode(mode);
  if (!normalized) {
    throw new TypeError(`Unsupported renderer mode: ${mode}`);
  }

  const storage = options.storage ?? globalThis.localStorage;
  storage?.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function clearRendererMode(options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  storage?.removeItem(STORAGE_KEY);
}

export function shouldAttemptGpu(mode) {
  const normalized = normalizeRendererMode(mode);
  return normalized === RendererMode.GPU || normalized === RendererMode.AUTO;
}

export { STORAGE_KEY as RENDERER_MODE_STORAGE_KEY };
