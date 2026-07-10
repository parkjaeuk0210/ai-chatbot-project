import test from 'node:test';
import assert from 'node:assert/strict';

import { RendererMode } from './featureFlags.js';
import { RendererFacade } from './rendererFacade.js';

function fakeRenderer(backend, options = {}) {
  const calls = [];
  return {
    backend,
    adapterName: options.adapterName || `${backend}-adapter`,
    apiVersion: options.apiVersion || 'test',
    rectCount: options.rectCount ?? 0,
    calls,
    resize(...args) {
      calls.push(['resize', ...args]);
    },
    setClearColor(color) {
      calls.push(['setClearColor', color]);
    },
    setRectangles(rectangles) {
      calls.push(['setRectangles', rectangles]);
    },
    render() {
      calls.push(['render']);
    },
    destroy() {
      calls.push(['destroy']);
    },
  };
}

test('Konva mode never attempts GPU initialization', async () => {
  const legacy = fakeRenderer('konva');
  let gpuCalls = 0;

  const facade = await RendererFacade.create({
    mode: 'konva',
    legacyFactory: async () => legacy,
    gpuFactory: async () => {
      gpuCalls += 1;
      throw new Error('GPU should not be called');
    },
  });

  assert.equal(gpuCalls, 0);
  assert.equal(facade.status.activeMode, RendererMode.KONVA);
  assert.equal(facade.status.fallbackReason, null);
});

test('GPU mode uses the GPU renderer without touching the legacy path', async () => {
  const gpu = fakeRenderer('webgpu', { adapterName: 'test-adapter', rectCount: 3 });
  let legacyCalls = 0;
  const statuses = [];

  const facade = await RendererFacade.create({
    mode: 'gpu',
    canvas: { id: 'canvas' },
    moduleUrl: '/renderer/pkg/pera_renderer.js',
    gpuFactory: async (options) => {
      assert.equal(options.canvas.id, 'canvas');
      assert.equal(options.moduleUrl, '/renderer/pkg/pera_renderer.js');
      return gpu;
    },
    legacyFactory: async () => {
      legacyCalls += 1;
      return fakeRenderer('konva');
    },
    onStatus(status) {
      statuses.push(status);
    },
  });

  assert.equal(legacyCalls, 0);
  assert.equal(facade.status.activeMode, RendererMode.GPU);
  assert.equal(facade.backend, 'webgpu');
  assert.equal(facade.adapterName, 'test-adapter');
  assert.equal(facade.rectCount, 3);
  assert.deepEqual(statuses, [facade.status]);
  assert.equal(Object.isFrozen(facade.status), true);
});

test('GPU initialization failure falls back to Konva and preserves the reason', async () => {
  const legacy = fakeRenderer('konva');

  const facade = await RendererFacade.create({
    mode: 'auto',
    gpuFactory: async () => {
      throw new Error('adapter unavailable');
    },
    legacyFactory: async () => legacy,
  });

  assert.equal(facade.status.requestedMode, RendererMode.AUTO);
  assert.equal(facade.status.activeMode, RendererMode.KONVA);
  assert.equal(facade.status.fallbackReason, 'adapter unavailable');
});

test('GPU failure is surfaced when legacy fallback is disabled', async () => {
  let legacyCalls = 0;

  await assert.rejects(
    RendererFacade.create({
      mode: 'gpu',
      allowLegacyFallback: false,
      gpuFactory: async () => {
        throw new Error('strict GPU failure');
      },
      legacyFactory: async () => {
        legacyCalls += 1;
        return fakeRenderer('konva');
      },
    }),
    /strict GPU failure/,
  );

  assert.equal(legacyCalls, 0);
});

test('both initialization failures are reported as an AggregateError', async () => {
  await assert.rejects(
    RendererFacade.create({
      mode: 'auto',
      gpuFactory: async () => {
        throw new Error('GPU failed');
      },
      legacyFactory: async () => {
        throw new Error('Konva failed');
      },
    }),
    (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.equal(error.errors.length, 2);
      assert.match(error.message, /Both the GPU renderer and the Konva fallback failed/);
      return true;
    },
  );
});

test('facade delegates scene, resize, render, and destroy operations', async () => {
  const legacy = fakeRenderer('konva', {
    adapterName: 'Canvas2D',
    apiVersion: '9.3.22',
    rectCount: 2,
  });
  const rectangles = [{ x: 1, y: 2, width: 3, height: 4 }];

  const facade = await RendererFacade.create({
    mode: 'konva',
    legacyFactory: async () => legacy,
  });

  facade.setScene({ clearColor: '#0b1020', rectangles });
  facade.resize(640, 480, 2);
  facade.render();

  assert.equal(facade.adapterName, 'Canvas2D');
  assert.equal(facade.apiVersion, '9.3.22');
  assert.equal(facade.rectCount, 2);
  assert.deepEqual(legacy.calls, [
    ['setClearColor', '#0b1020'],
    ['setRectangles', rectangles],
    ['resize', 640, 480, 2],
    ['render'],
  ]);

  facade.destroy();
  assert.deepEqual(legacy.calls.at(-1), ['destroy']);
  assert.equal(facade.renderer, null);
});
