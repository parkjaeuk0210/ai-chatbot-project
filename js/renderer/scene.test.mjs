import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeColor, normalizeRectangle, packRectangles } from './scene.js';

test('hex colors normalize to unit RGBA', () => {
  assert.deepEqual(normalizeColor('#ff800080'), [1, 128 / 255, 0, 128 / 255]);
});

test('negative rectangle extents are clamped to zero', () => {
  assert.deepEqual(normalizeRectangle({ x: 2, y: 3, width: -5, height: 7 }, 0), {
    id: 'rect-0',
    x: 2,
    y: 3,
    width: 0,
    height: 7,
    color: [0.42, 0.55, 1, 1],
  });
});

test('rectangle packing follows the eight-float Wasm contract', () => {
  const packed = packRectangles([
    { x: 1, y: 2, width: 3, height: 4, color: [1, 0.5, 0, 0.75] },
  ]);
  assert.deepEqual(Array.from(packed), [1, 2, 3, 4, 1, 0.5, 0, 0.75]);
});

test('non-finite geometry is rejected before crossing the Wasm boundary', () => {
  assert.throws(
    () => normalizeRectangle({ x: Number.NaN, y: 0, width: 1, height: 1 }),
    /non-finite geometry/,
  );
});
