const STORAGE_KEY = 'pera.renderer.mode';
const VALID_MODES = new Set(['konva', 'gpu', 'auto']);

export const RendererMode = Object.freeze({
  KONVA: 'konva',
  GPU: 'gpu',
  AUTO: 'auto',
});

function defaultSearch() {
  try {
    return globalThis.location?.search ?? '';
  } catch {
    return '';
  }
}

function resolveStorage(options) {
  if (Object.hasOwn(options, 'storage')) {
    return options.storage;
  }

  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function normalizeRendererMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'wgpu' || normalized === 'webgpu') return RendererMode.GPU;
  return VALID_MODES.has(normalized) ? normalized : null;
}

export function resolveRendererMode(options = {}) {
  const search = options.search ?? defaultSearch();
  const storage = resolveStorage(options);

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

  try {
    resolveStorage(options)?.setItem(STORAGE_KEY, normalized);
  } catch {
    // The query parameter can still select the renderer when storage is blocked.
  }
  return normalized;
}

export function clearRendererMode(options = {}) {
  try {
    resolveStorage(options)?.removeItem(STORAGE_KEY);
  } catch {
    // Clearing an unavailable storage backend is already effectively complete.
  }
}

export function shouldAttemptGpu(mode) {
  const normalized = normalizeRendererMode(mode);
  return normalized === RendererMode.GPU || normalized === RendererMode.AUTO;
}

export { STORAGE_KEY as RENDERER_MODE_STORAGE_KEY };
