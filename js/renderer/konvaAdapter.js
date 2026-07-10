import { colorToCss, normalizeColor, normalizeRectangles } from './scene.js';

function resolveContainer(container) {
  if (typeof container === 'string') {
    const element = document.getElementById(container);
    if (!element) throw new Error(`Konva container not found: ${container}`);
    return element;
  }

  if (!(container instanceof HTMLElement)) {
    throw new TypeError('Konva renderer requires an HTMLElement container');
  }
  return container;
}

function measure(container) {
  const bounds = container.getBoundingClientRect();
  return {
    width: Math.max(1, bounds.width || container.clientWidth || 1),
    height: Math.max(1, bounds.height || container.clientHeight || 1),
  };
}

export class KonvaSceneRenderer {
  static create(options = {}) {
    const Konva = options.Konva || globalThis.Konva;
    if (!Konva?.Stage || !Konva?.Layer || !Konva?.Rect) {
      throw new Error('Konva is not available; provide options.Konva or load it globally');
    }

    return new KonvaSceneRenderer(resolveContainer(options.container), Konva);
  }

  constructor(container, Konva) {
    this.container = container;
    this.Konva = Konva;
    this.backend = 'konva';
    this.adapterName = 'Konva Canvas2D';
    this.apiVersion = String(Konva.version || 'unknown');
    this.rectangles = [];
    this.clearColor = [0.043, 0.063, 0.125, 1];
    this.resizeObserver = null;

    const { width, height } = measure(container);
    this.stage = new Konva.Stage({ container, width, height });
    this.backgroundLayer = new Konva.Layer({ listening: false });
    this.contentLayer = new Konva.Layer({ listening: false });
    this.background = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: colorToCss(this.clearColor),
      listening: false,
      perfectDrawEnabled: false,
    });

    this.backgroundLayer.add(this.background);
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.contentLayer);
    this.observeResize();
  }

  observeResize() {
    if (typeof ResizeObserver !== 'function') return;
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = measure(this.container);
      this.resize(width, height);
      this.render();
    });
    this.resizeObserver.observe(this.container);
  }

  resize(width, height) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);
    this.stage.size({ width: safeWidth, height: safeHeight });
    this.background.size({ width: safeWidth, height: safeHeight });
  }

  setClearColor(color) {
    this.clearColor = normalizeColor(color, this.clearColor);
    this.background.fill(colorToCss(this.clearColor));
  }

  setRectangles(rectangles) {
    this.rectangles = normalizeRectangles(rectangles);
    this.contentLayer.destroyChildren();

    this.rectangles.forEach((rectangle) => {
      this.contentLayer.add(new this.Konva.Rect({
        x: rectangle.x,
        y: rectangle.y,
        width: rectangle.width,
        height: rectangle.height,
        fill: colorToCss(rectangle.color),
        listening: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
      }));
    });
  }

  render() {
    this.backgroundLayer.batchDraw();
    this.contentLayer.batchDraw();
  }

  get rectCount() {
    return this.rectangles.length;
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.stage?.destroy();
    this.stage = null;
  }
}

export function createKonvaRenderer(options) {
  return KonvaSceneRenderer.create(options);
}
