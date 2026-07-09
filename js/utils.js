// Utility functions for PERA Studio.

export function sanitizeHTML(value = '') {
  const element = document.createElement('div');
  element.textContent = String(value);
  return element.innerHTML;
}

export function createId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateSessionId() {
  return createId('pera-session');
}

export function formatFileSize(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDateTime(input = Date.now()) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(input));
  } catch {
    return new Date(input).toLocaleString();
  }
}

export function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode or quota-limited contexts. The app should keep working.
  }
}

export function normalizeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  try {
    return new URL(text).toString();
  } catch {
    try {
      return new URL(`https://${text}`).toString();
    } catch {
      return null;
    }
  }
}

export function extractFirstUrl(value) {
  const match = String(value || '').match(/https?:\/\/[^\s<>"']+|(?:www\.)[^\s<>"']+\.[^\s<>"']+/i);
  return match ? normalizeUrl(match[0]) : null;
}

export function inferTitle(text = '') {
  const cleaned = String(text)
    .replace(/^\/\S+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '새 PERA 작업';
  return cleaned.length > 36 ? `${cleaned.slice(0, 36)}…` : cleaned;
}

const slashCommands = {
  요약: {
    mode: 'summary',
    label: '요약',
    prompt: '핵심 요약, 주요 키워드, 다음 행동으로 정리해줘.',
  },
  summary: {
    mode: 'summary',
    label: 'Summary',
    prompt: 'Summarize this into key points, keywords, and next actions.',
  },
  표: {
    mode: 'table',
    label: '표',
    prompt: '내용을 비교표로 정리해줘. 기준, 핵심 내용, 장점, 단점, 추천 상황을 포함해줘.',
  },
  table: {
    mode: 'table',
    label: 'Table',
    prompt: 'Turn this into a comparison table with criteria, details, pros, cons, and recommendation.',
  },
  퀴즈: {
    mode: 'quiz',
    label: '퀴즈',
    prompt: '객관식 5문제와 정답, 해설을 만들어줘.',
  },
  quiz: {
    mode: 'quiz',
    label: 'Quiz',
    prompt: 'Create five multiple-choice questions with answers and explanations.',
  },
  문서: {
    mode: 'report',
    label: '문서',
    prompt: '보고서 형식으로 제목, 개요, 본문, 결론을 작성해줘.',
  },
  report: {
    mode: 'report',
    label: 'Report',
    prompt: 'Write a structured report with title, outline, body, and conclusion.',
  },
  코드: {
    mode: 'code',
    label: '코드',
    prompt: '코드를 분석하고 개선점, 버그 가능성, 수정 예시를 제시해줘.',
  },
  code: {
    mode: 'code',
    label: 'Code',
    prompt: 'Analyze the code and suggest improvements, potential bugs, and a corrected example.',
  },
  이미지: {
    mode: 'image',
    label: '이미지',
    prompt: '',
  },
  image: {
    mode: 'image',
    label: 'Image',
    prompt: '',
  },
};

export function getSlashCommands() {
  return Object.entries(slashCommands).map(([name, command]) => ({ name, ...command }));
}

export function parseSlashCommand(input = '') {
  const trimmed = String(input).trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const [, rawCommand = '', rest = ''] = trimmed.match(/^\/([^\s]+)\s*([\s\S]*)$/) || [];
  const command = slashCommands[rawCommand.toLowerCase()] || slashCommands[rawCommand];

  if (!command) {
    return null;
  }

  return {
    name: rawCommand,
    ...command,
    rest: rest.trim(),
  };
}

export function buildPersonaInstruction({ preset = 'friendly', depth = 'balanced', custom = '' } = {}) {
  const presetMap = {
    friendly: '친절한 튜터처럼 단계별로 설명합니다. 사용자가 대학생이라고 가정하고 쉬운 예시를 듭니다.',
    practical: '실무형 컨설턴트처럼 결론, 근거, 실행 계획을 우선합니다. 불필요한 수식어를 줄입니다.',
    concise: '짧고 빠르게 답합니다. 핵심 결론과 바로 실행할 항목만 제공합니다.',
    creative: '창의적 작가처럼 아이디어를 확장하고 표현을 매력적으로 다듬습니다.',
  };

  const depthMap = {
    short: '답변은 가능한 한 짧게 작성합니다.',
    balanced: '답변은 적당한 길이로, 핵심과 예시의 균형을 맞춥니다.',
    deep: '답변은 자세히 작성하고 맥락, 예시, 주의사항을 포함합니다.',
  };

  return [
    '당신은 PERA Studio의 AI 작업 파트너입니다.',
    '사용자의 작업물을 더 좋은 결과물로 만들기 위해 먼저 구조화하고, 필요한 경우 다음 행동을 제안합니다.',
    presetMap[preset] || presetMap.friendly,
    depthMap[depth] || depthMap.balanced,
    custom ? `[사용자 추가 지시]\n${custom}` : '',
  ].filter(Boolean).join('\n');
}

export function getModeLabel(mode = 'chat') {
  const labels = {
    chat: '채팅',
    summary: '요약',
    report: '문서',
    table: '표',
    quiz: '퀴즈',
    code: '코드',
    image: '이미지',
  };

  return labels[mode] || '채팅';
}

export function getModeInstruction(mode = 'chat') {
  const instructions = {
    chat: '',
    summary: '요약 모드: 먼저 3줄 요약, 핵심 키워드, 놓치면 안 되는 포인트, 다음 행동 순서로 답하세요.',
    report: '문서 모드: 제목, 한 줄 요지, 목차, 본문 초안, 개선 제안 순서로 답하세요.',
    table: '표 모드: 가능한 경우 Markdown 표를 사용하고, 마지막에 추천 결론을 덧붙이세요.',
    quiz: '퀴즈 모드: 문제, 보기, 정답, 해설을 명확히 구분하세요.',
    code: '코드 모드: 문제 원인, 수정 코드, 테스트 방법, 주의사항 순서로 답하세요.',
    image: '이미지 모드: 프롬프트를 시각적으로 풍부하게 해석하세요.',
  };

  return instructions[mode] || '';
}

export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function downloadTextFile(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

export async function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('텍스트 파일을 읽을 수 없습니다.'));
    reader.readAsText(file, 'utf-8');
  });
}

export async function compressImage(file, maxWidth = 1920, maxHeight = 1440, quality = 0.86) {
  const dataUrl = await fileToDataUrl(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      let { width, height } = image;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          resolve({ dataUrl, blob: file, width, height });
          return;
        }

        resolve({
          dataUrl: canvas.toDataURL(file.type || 'image/jpeg', quality),
          blob,
          width,
          height,
        });
      }, file.type || 'image/jpeg', quality);
    };
    image.onerror = () => reject(new Error('이미지를 처리할 수 없습니다.'));
    image.src = dataUrl;
  });
}

export async function extractTextFromPdf(file, { maxPages = 24, maxChars = 60000 } = {}) {
  if (!globalThis.pdfjsLib) {
    throw new Error('PDF.js가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
  }

  if (!globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
  }

  const buffer = await file.arrayBuffer();
  const pdf = await globalThis.pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const chunks = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
    if (pageText) {
      chunks.push(`[p.${pageNumber}]\n${pageText}`);
    }

    if (chunks.join('\n\n').length > maxChars) {
      break;
    }
  }

  const text = chunks.join('\n\n').slice(0, maxChars);
  if (!text.trim()) {
    throw new Error('PDF에서 텍스트를 추출하지 못했습니다. 스캔 이미지 PDF일 수 있습니다.');
  }

  return text;
}

export function validateInput(input) {
  return typeof input === 'string' && input.length <= 120000;
}

export function formatErrorMessage(error) {
  const message = error?.message || '알 수 없는 오류가 발생했습니다.';

  if (!navigator.onLine) {
    return {
      type: 'network',
      title: '네트워크 연결 오류',
      message: '인터넷 연결을 확인한 뒤 다시 시도해주세요.',
      action: '연결 확인 후 재시도',
      fullMessage: '네트워크 연결 오류\n\n인터넷 연결을 확인한 뒤 다시 시도해주세요.',
      isRetryable: true,
    };
  }

  if (/429|rate/i.test(message)) {
    return {
      type: 'rateLimit',
      title: '요청 한도 초과',
      message: '짧은 시간에 너무 많은 요청을 보냈습니다.',
      action: '잠시 후 다시 시도',
      fullMessage: '요청 한도 초과\n\n짧은 시간에 너무 많은 요청을 보냈습니다.',
      isRetryable: true,
    };
  }

  if (/timeout|abort/i.test(message)) {
    return {
      type: 'timeout',
      title: '응답 시간 초과',
      message: '요청이 오래 걸렸습니다. 질문을 줄이거나 다시 시도해주세요.',
      action: '다시 시도',
      fullMessage: '응답 시간 초과\n\n요청이 오래 걸렸습니다.',
      isRetryable: true,
    };
  }

  if (/file|pdf|image|파일|이미지/i.test(message)) {
    return {
      type: 'file',
      title: '파일 처리 오류',
      message,
      action: '파일 크기와 형식을 확인',
      fullMessage: `파일 처리 오류\n\n${message}`,
      isRetryable: false,
    };
  }

  return {
    type: 'general',
    title: '오류가 발생했습니다',
    message,
    action: '다시 시도하거나 페이지 새로고침',
    fullMessage: `오류가 발생했습니다\n\n${message}`,
    isRetryable: true,
  };
}

export class ErrorHandler {
  constructor() {
    this.errorLog = [];
  }

  handle(error, context = {}) {
    const formatted = formatErrorMessage(error);
    this.errorLog.push({
      ...formatted,
      context,
      timestamp: new Date().toISOString(),
    });
    this.errorLog = this.errorLog.slice(-80);
    return formatted;
  }

  getRecentErrors(count = 10) {
    return this.errorLog.slice(-count);
  }

  clearErrors() {
    this.errorLog = [];
  }
}

export const errorHandler = new ErrorHandler();
