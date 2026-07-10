import { normalizeColor, packRectangles } from './scene.js';

const DEFAULT_MODULE_URL = '/renderer/pkg/pera_renderer.js';

function requireCanvas(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('GpuSceneRenderer requires an HTMLCanvasElement');
  }
  return canvas;
}

function measuredSize(canvas) {
  const bounds = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, bounds.width || canvas.clientWidth || 1),
    height: Math.max(1, bounds.height || canvas.clientHeight || 1),
  };
}

export class GpuSceneRenderer {
  static async create(options = {}) {
    const canvas = requireCanvas(options.canvas);
    const moduleUrl = options.moduleUrl || DEFAULT_MODULE_URL;
    const module = await import(moduleUrl);

    if (typeof module.default !== 'function' || typeof module.create_renderer !== 'function') {
      throw new Error(`Invalid PERA renderer module at ${moduleUrl}`);
    }

    await module.default();
    const wasmRenderer = await module.create_renderer(canvas);
    const renderer = new GpuSceneRenderer(canvas, wasmRenderer, module);
    renderer.resizeToCanvas();
    renderer.observeResize();
    return renderer;
  }

  constructor(canvas, wasmRenderer, module) {
    this.canvas = canvas;
    this.wasmRenderer = wasmRenderer;
    this.module = module;
    this.resizeObserver = null;
    this.rectangles = [];
    this.backend = wasmRenderer.backend;
    this.adapterName = wasmRenderer.adapter_name;
    this.apiVersion = module.renderer_api_version?.() || 'unknown';
  }

  observeResize() {
    if (typeof ResizeObserver !== 'function') return;
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeToCanvas();
      this.render();
    });
    this.resizeObserver.observe(this.canvas);
  }

  resizeToCanvas() {
    const { width, height } = measuredSize(this.canvas);
    this.resize(width, height, globalThis.devicePixelRatio || 1);
  }

  resize(width, height, devicePixelRatio = globalThis.devicePixelRatio || 1) {
    this.wasmRenderer.resize(width, height, devicePixelRatio);
  }

  setClearColor(color) {
    const [red, green, blue, alpha] = normalizeColor(color, [0.043, 0.063, 0.125, 1]);
    this.wasmRenderer.set_clear_color(red, green, blue, alpha);
  }

  setRectangles(rectangles) {
    this.rectangles = rectangles;
    this.wasmRenderer.set_rectangles(packRectangles(rectangles));
  }

  render() {
    this.wasmRenderer.render();
  }

  get rectCount() {
    return this.wasmRenderer.rect_count;
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.wasmRenderer?.free?.();
    this.wasmRenderer = null;
  }
}

export { DEFAULT_MODULE_URL as DEFAULT_RENDERER_MODULE_URL };
