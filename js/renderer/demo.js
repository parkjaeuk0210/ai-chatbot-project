import { RendererMode, resolveRendererMode, setRendererMode } from './featureFlags.js';
import { RendererFacade } from './rendererFacade.js';

const canvas = document.getElementById('gpu-canvas');
const legacyContainer = document.getElementById('konva-host');
const statusElement = document.getElementById('renderer-status');
const detailsElement = document.getElementById('renderer-details');
const redrawButton = document.getElementById('redraw-button');
const modeButtons = [...document.querySelectorAll('[data-renderer-mode]')];

const scene = {
  clearColor: '#0b1020',
  rectangles: [
    { x: 28, y: 28, width: 220, height: 118, color: '#6d8cff' },
    { x: 268, y: 48, width: 170, height: 76, color: '#67e8c3cc' },
    { x: 64, y: 174, width: 340, height: 42, color: 'rgba(255, 255, 255, 0.14)' },
    { x: 64, y: 232, width: 260, height: 22, color: '#f1f5f980' },
    { x: 64, y: 270, width: 196, height: 22, color: '#f1f5f94d' },
  ],
};

function setLayerVisibility(activeMode) {
  canvas.hidden = activeMode !== RendererMode.GPU;
  legacyContainer.hidden = activeMode !== RendererMode.KONVA;
}

function showFailure(error) {
  statusElement.textContent = '초기화 실패';
  statusElement.dataset.state = 'error';
  detailsElement.textContent = error instanceof Error ? error.message : String(error);
}

async function main() {
  const resolvedMode = resolveRendererMode();
  modeButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.rendererMode === resolvedMode.mode);
    button.addEventListener('click', () => {
      const mode = setRendererMode(button.dataset.rendererMode);
      const url = new URL(globalThis.location.href);
      url.searchParams.set('renderer', mode);
      globalThis.location.assign(url);
    });
  });

  const facade = await RendererFacade.create({
    mode: resolvedMode.mode,
    canvas,
    legacyContainer,
    onStatus(status) {
      setLayerVisibility(status.activeMode);
      statusElement.textContent = `${status.activeMode.toUpperCase()} · ${status.backend}`;
      statusElement.dataset.state = status.fallbackReason ? 'fallback' : 'ready';
      detailsElement.textContent = status.fallbackReason
        ? `GPU 초기화 실패로 Konva 폴백: ${status.fallbackReason}`
        : `${status.source} 플래그로 ${status.activeMode} 렌더러를 선택했습니다.`;
    },
  });

  facade.setScene(scene);
  facade.render();
  detailsElement.textContent += ` 어댑터: ${facade.adapterName}; 사각형: ${facade.rectCount}개.`;

  redrawButton.addEventListener('click', () => {
    facade.render();
    redrawButton.textContent = '다시 그렸습니다';
    setTimeout(() => {
      redrawButton.textContent = '다시 그리기';
    }, 900);
  });

  globalThis.addEventListener('beforeunload', () => facade.destroy(), { once: true });
}

globalThis.addEventListener('load', () => {
  main().catch(showFailure);
}, { once: true });
