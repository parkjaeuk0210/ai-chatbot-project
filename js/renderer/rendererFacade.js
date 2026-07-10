import {
  RendererMode,
  normalizeRendererMode,
  resolveRendererMode,
  shouldAttemptGpu,
} from './featureFlags.js';
import { GpuSceneRenderer } from './gpuRenderer.js';
import { createKonvaRenderer } from './konvaAdapter.js';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export class RendererFacade {
  static async create(options = {}) {
    const resolved = options.mode
      ? { mode: normalizeRendererMode(options.mode), source: 'explicit' }
      : resolveRendererMode(options.featureFlagOptions);

    if (!resolved.mode) {
      throw new TypeError(`Unsupported renderer mode: ${options.mode}`);
    }

    const legacyFactory = options.legacyFactory || createKonvaRenderer;
    const allowLegacyFallback = options.allowLegacyFallback !== false;
    const notify = typeof options.onStatus === 'function' ? options.onStatus : () => {};

    if (!shouldAttemptGpu(resolved.mode)) {
      const renderer = await legacyFactory({
        container: options.legacyContainer,
        Konva: options.Konva,
      });
      return new RendererFacade(renderer, {
        requestedMode: resolved.mode,
        source: resolved.source,
        activeMode: RendererMode.KONVA,
        backend: renderer.backend || RendererMode.KONVA,
        fallbackReason: null,
      }, notify);
    }

    try {
      const renderer = await GpuSceneRenderer.create({
        canvas: options.canvas,
        moduleUrl: options.moduleUrl,
      });
      return new RendererFacade(renderer, {
        requestedMode: resolved.mode,
        source: resolved.source,
        activeMode: RendererMode.GPU,
        backend: renderer.backend,
        fallbackReason: null,
      }, notify);
    } catch (gpuError) {
      if (!allowLegacyFallback || typeof legacyFactory !== 'function') {
        throw gpuError;
      }

      try {
        const renderer = await legacyFactory({
          container: options.legacyContainer,
          Konva: options.Konva,
        });
        return new RendererFacade(renderer, {
          requestedMode: resolved.mode,
          source: resolved.source,
          activeMode: RendererMode.KONVA,
          backend: renderer.backend || RendererMode.KONVA,
          fallbackReason: errorMessage(gpuError),
        }, notify);
      } catch (legacyError) {
        throw new AggregateError(
          [gpuError, legacyError],
          'Both the GPU renderer and the Konva fallback failed to initialize',
        );
      }
    }
  }

  constructor(renderer, status, notify) {
    this.renderer = renderer;
    this.status = Object.freeze({ ...status });
    notify(this.status);
  }

  resize(width, height, devicePixelRatio) {
    this.renderer.resize(width, height, devicePixelRatio);
  }

  setClearColor(color) {
    this.renderer.setClearColor(color);
  }

  setRectangles(rectangles) {
    this.renderer.setRectangles(rectangles);
  }

  setScene(scene = {}) {
    if (scene.clearColor) this.setClearColor(scene.clearColor);
    if (scene.rectangles) this.setRectangles(scene.rectangles);
  }

  render() {
    this.renderer.render();
  }

  get backend() {
    return this.renderer.backend;
  }

  get adapterName() {
    return this.renderer.adapterName;
  }

  get apiVersion() {
    return this.renderer.apiVersion;
  }

  get rectCount() {
    return this.renderer.rectCount;
  }

  destroy() {
    this.renderer?.destroy?.();
    this.renderer = null;
  }
}
