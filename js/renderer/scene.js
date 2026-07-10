const DEFAULT_COLOR = Object.freeze([0.42, 0.55, 1, 1]);

function clampUnit(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function normalizeRgbChannel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return clampUnit(number > 1 ? number / 255 : number);
}

function parseHexColor(value) {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/i.test(hex)) return null;

  const expanded = hex.length <= 4
    ? [...hex].map((character) => character.repeat(2)).join('')
    : hex;
  const hasAlpha = expanded.length === 8;

  return [
    parseInt(expanded.slice(0, 2), 16) / 255,
    parseInt(expanded.slice(2, 4), 16) / 255,
    parseInt(expanded.slice(4, 6), 16) / 255,
    hasAlpha ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  ];
}

function parseFunctionalColor(value) {
  const match = value.match(/^rgba?\((.+)\)$/i);
  if (!match) return null;

  const components = match[1].split(',').map((part) => part.trim());
  if (components.length < 3 || components.length > 4) return null;

  return [
    normalizeRgbChannel(components[0]),
    normalizeRgbChannel(components[1]),
    normalizeRgbChannel(components[2]),
    components.length === 4 ? clampUnit(components[3]) : 1,
  ];
}

export function normalizeColor(input, fallback = DEFAULT_COLOR) {
  if (Array.isArray(input) || ArrayBuffer.isView(input)) {
    const values = Array.from(input);
    if (values.length >= 3) {
      return [
        normalizeRgbChannel(values[0]),
        normalizeRgbChannel(values[1]),
        normalizeRgbChannel(values[2]),
        values.length >= 4 ? clampUnit(values[3]) : 1,
      ];
    }
  }

  if (typeof input === 'string') {
    const value = input.trim();
    if (value.startsWith('#')) {
      const parsed = parseHexColor(value);
      if (parsed) return parsed;
    }

    const parsed = parseFunctionalColor(value);
    if (parsed) return parsed;
  }

  return [...fallback];
}

export function colorToCss(input) {
  const [red, green, blue, alpha] = normalizeColor(input);
  return `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${alpha})`;
}

export function normalizeRectangle(rectangle, index = 0) {
  if (!rectangle || typeof rectangle !== 'object') {
    throw new TypeError(`Rectangle ${index} must be an object`);
  }

  const x = Number(rectangle.x ?? 0);
  const y = Number(rectangle.y ?? 0);
  const width = Number(rectangle.width ?? rectangle.w ?? 0);
  const height = Number(rectangle.height ?? rectangle.h ?? 0);
  const numericValues = [x, y, width, height];

  if (!numericValues.every(Number.isFinite)) {
    throw new TypeError(`Rectangle ${index} contains a non-finite geometry value`);
  }

  return {
    id: rectangle.id ?? `rect-${index}`,
    x,
    y,
    width: Math.max(0, width),
    height: Math.max(0, height),
    color: normalizeColor(rectangle.color ?? rectangle.fill),
  };
}

export function normalizeRectangles(rectangles = []) {
  if (!Array.isArray(rectangles)) {
    throw new TypeError('rectangles must be an array');
  }
  return rectangles.map(normalizeRectangle);
}

export function packRectangles(rectangles = []) {
  const normalized = normalizeRectangles(rectangles);
  const packed = new Float32Array(normalized.length * 8);

  normalized.forEach((rectangle, index) => {
    const offset = index * 8;
    packed.set([
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
      ...rectangle.color,
    ], offset);
  });

  return packed;
}
