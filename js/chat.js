// Chat and message rendering module for PERA Studio.
import {
  compressImage,
  createId,
  errorHandler,
  extractTextFromPdf,
  fileToDataUrl,
  fileToText,
  formatFileSize,
  sanitizeHTML,
  validateInput,
} from './utils.js';

function looksLikeTable(text) {
  const lines = String(text || '').split('\n').map((line) => line.trim());
  return lines.some((line, index) => line.includes('|') && lines[index + 1]?.match(/^\|?\s*:?-{3,}:?\s*\|/));
}

function markdownToHtml(markdown = '') {
  const source = String(markdown || '');
  const codeBlocks = [];
  let html = sanitizeHTML(source).replace(/```([\w-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push({ lang: sanitizeHTML(lang || ''), code });
    return token;
  });

  html = html
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  if (looksLikeTable(source)) {
    html = convertMarkdownTables(html);
  }

  html = html
    .split(/\n{2,}/)
    .map((block) => {
      if (!block.trim()) return '';
      if (/^<h[1-3]>/.test(block) || /^<table/.test(block) || block.startsWith('@@CODE_BLOCK_')) {
        return block;
      }
      const listLines = block.split('\n').filter((line) => /^[-*]\s+/.test(line.trim()));
      if (listLines.length > 1 && listLines.length === block.split('\n').length) {
        return `<ul>${listLines.map((line) => `<li>${line.replace(/^[-*]\s+/, '')}</li>`).join('')}</ul>`;
      }
      const orderedLines = block.split('\n').filter((line) => /^\d+\.\s+/.test(line.trim()));
      if (orderedLines.length > 1 && orderedLines.length === block.split('\n').length) {
        return `<ol>${orderedLines.map((line) => `<li>${line.replace(/^\d+\.\s+/, '')}</li>`).join('')}</ol>`;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  codeBlocks.forEach((block, index) => {
    const token = `@@CODE_BLOCK_${index}@@`;
    const replacement = `<pre data-language="${block.lang}"><code>${block.code}</code></pre>`;
    html = html.replace(token, replacement);
  });

  return html;
}

function convertMarkdownTables(html) {
  const blocks = html.split(/\n{2,}/);
  return blocks.map((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2 || !lines[0].includes('|') || !/^\|?\s*:?-{3,}:?\s*\|/.test(lines[1])) {
      return block;
    }

    const rows = lines
      .filter((_, index) => index !== 1)
      .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));

    const [head, ...body] = rows;
    return `<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }).join('\n\n');
}

function partsToText(parts = []) {
  return parts
    .filter((part) => part?.text)
    .map((part) => part.text)
    .join('\n\n')
    .trim();
}

function extractImagePart(result) {
  const candidate = result?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const imagePart = parts.find((part) => part?.inlineData?.data);
  if (!imagePart) return null;
  const mimeType = imagePart.inlineData.mimeType || 'image/png';
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

export class ChatManager {
  constructor() {
    this.chatHistory = [];
    this.abortController = null;
    this.lastRequest = null;
  }

  reset() {
    this.chatHistory = [];
    this.lastRequest = null;
    this.abort();
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  scrollToBottom(container) {
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
  }

  toggleLoading(container, show) {
    const existing = container.querySelector('#loading-indicator');
    if (!show) {
      existing?.remove();
      return;
    }

    if (existing) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'loading-indicator';
    wrapper.className = 'message message--assistant';
    wrapper.innerHTML = `
      <div class="message__avatar" aria-hidden="true">AI</div>
      <div class="message__bubble">
        <div class="message__content">
          <span class="loading-dots" aria-label="PERA가 응답을 생성하고 있습니다">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    `;
    container.appendChild(wrapper);
    this.scrollToBottom(container);
  }

  addMessage(container, sender, parts = [], options = {}) {
    const wrapper = document.createElement('article');
    wrapper.className = `message message--${sender === 'user' ? 'user' : 'assistant'}`;
    wrapper.dataset.messageId = options.id || createId('message');
    wrapper.dataset.sender = sender;

    const avatar = document.createElement('div');
    avatar.className = 'message__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = sender === 'user' ? '나' : 'AI';

    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';

    const content = document.createElement('div');
    content.className = 'message__content';

    for (const part of parts) {
      if (part?.text) {
        const block = document.createElement('div');
        block.innerHTML = markdownToHtml(part.text);
        content.appendChild(block);
      }

      if (part?.inlineData?.data) {
        const image = document.createElement('img');
        image.className = 'message__image';
        image.loading = 'lazy';
        image.alt = part.name ? `첨부 이미지: ${part.name}` : '첨부 이미지';
        image.src = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        content.appendChild(image);
      }

      if (part?.imageUrl) {
        const image = document.createElement('img');
        image.className = 'message__image';
        image.loading = 'lazy';
        image.alt = part.name || '생성 이미지';
        image.src = part.imageUrl;
        content.appendChild(image);
      }

      if (part?.contexts?.length) {
        const preview = document.createElement('div');
        preview.className = 'context-preview';
        preview.innerHTML = part.contexts.map((context) => `<span>${sanitizeHTML(context.icon || '◇')} ${sanitizeHTML(context.name || context.url || context.type)}</span>`).join('');
        content.appendChild(preview);
      }
    }

    bubble.appendChild(content);

    if (sender !== 'user') {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      actions.innerHTML = `
        <button class="message-action" type="button" data-message-action="copy">복사</button>
        <button class="message-action" type="button" data-message-action="shorten">짧게</button>
        <button class="message-action" type="button" data-message-action="table">표로</button>
        <button class="message-action" type="button" data-message-action="artifact">문서로 보내기</button>
        <button class="message-action" type="button" data-message-action="retry">다시 생성</button>
      `;
      bubble.appendChild(actions);
    }

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);
    this.scrollToBottom(container);
    return wrapper;
  }

  buildDisplayParts(message, contexts = []) {
    const parts = [];
    if (message) {
      parts.push({ text: message });
    }

    if (contexts.length) {
      parts.push({
        text: message ? '' : '첨부한 컨텍스트를 바탕으로 도와줘.',
        contexts: contexts.map((context) => ({
          type: context.type,
          icon: context.icon,
          name: context.name || context.url,
          url: context.url,
        })),
      });
    }

    for (const context of contexts) {
      if (context.type === 'image' && context.dataUrl) {
        parts.push({
          inlineData: {
            mimeType: context.mimeType,
            data: context.dataUrl.split(',')[1],
          },
          name: context.name,
        });
      }
    }

    return parts.length ? parts : [{ text: '' }];
  }

  async buildApiParts(message, contexts = []) {
    const contextTexts = [];
    const parts = [];

    for (const context of contexts) {
      if (context.type === 'url') {
        contextTexts.push(`[URL 컨텍스트]\n${context.url}`);
      }

      if (context.type === 'pdf') {
        const text = context.text || await extractTextFromPdf(context.file);
        context.text = text;
        contextTexts.push(`[PDF 파일: ${context.name}]\n${text}`);
      }

      if (context.type === 'text') {
        contextTexts.push(`[텍스트 파일: ${context.name}]\n${context.text || ''}`);
      }

      if (context.type === 'image' && context.dataUrl) {
        parts.push({
          inlineData: {
            mimeType: context.mimeType,
            data: context.dataUrl.split(',')[1],
          },
        });
      }
    }

    const text = [
      contextTexts.length ? contextTexts.join('\n\n---\n\n') : '',
      message ? `[사용자 요청]\n${message}` : '[사용자 요청]\n첨부한 컨텍스트를 분석해줘.',
    ].filter(Boolean).join('\n\n');

    if (text) {
      parts.unshift({ text });
    }

    return parts;
  }

  async sendMessage(apiUrl, message, contexts, persona, sessionId, mode, onSuccess, onError) {
    if (!validateInput(message || '')) {
      onError(errorHandler.handle(new Error('입력값이 너무 깁니다.'), { action: 'validateInput' }));
      return;
    }

    try {
      const userParts = await this.buildApiParts(message, contexts);
      const userMessage = { role: 'user', parts: userParts };
      this.chatHistory.push(userMessage);
      this.chatHistory = this.chatHistory.slice(-24);

      this.lastRequest = { apiUrl, message, contexts: [...contexts], persona, sessionId, mode };

      this.abortController = new AbortController();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: this.chatHistory.slice(-18),
          model: 'gemini',
          persona,
          sessionId,
          mode,
        }),
        signal: this.abortController.signal,
      });

      const resultText = await response.text();
      let result;
      try {
        result = resultText ? JSON.parse(resultText) : {};
      } catch {
        result = { raw: resultText };
      }

      if (!response.ok) {
        throw new Error(result?.message || result?.error?.message || `HTTP ${response.status}`);
      }

      const candidate = result?.candidates?.[0];
      const botParts = candidate?.content?.parts || (result.raw ? [{ text: result.raw }] : []);

      if (!botParts.length) {
        throw new Error('응답을 받았지만 내용이 비어있습니다.');
      }

      this.chatHistory.push({ role: 'assistant', parts: botParts });
      onSuccess(botParts, result);
    } catch (error) {
      onError(errorHandler.handle(error, { action: 'sendMessage', mode }));
    } finally {
      this.abortController = null;
    }
  }

  async generateImage(apiUrl, prompt, sessionId, onSuccess, onError) {
    try {
      if (!prompt.trim()) {
        throw new Error('이미지 생성 프롬프트가 비어 있습니다.');
      }

      this.lastRequest = { apiUrl, message: prompt, contexts: [], persona: '', sessionId, mode: 'image' };
      this.abortController = new AbortController();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: prompt,
          model: 'gemini-image',
          sessionId,
        }),
        signal: this.abortController.signal,
      });

      const resultText = await response.text();
      let result;
      try {
        result = resultText ? JSON.parse(resultText) : {};
      } catch {
        result = { raw: resultText };
      }

      if (!response.ok) {
        throw new Error(result?.message || result?.error?.message || `HTTP ${response.status}`);
      }

      const imageUrl = extractImagePart(result);
      const text = partsToText(result?.candidates?.[0]?.content?.parts || []) || result.raw || '';
      onSuccess({ imageUrl, text, raw: result });
    } catch (error) {
      onError(errorHandler.handle(error, { action: 'generateImage' }));
    } finally {
      this.abortController = null;
    }
  }

  async fileToContext(file) {
    if (!file) {
      throw new Error('파일이 선택되지 않았습니다.');
    }

    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      throw new Error(`파일 크기는 10MB를 초과할 수 없습니다. 현재 파일: ${formatFileSize(file.size)}`);
    }

    const id = createId('context');

    if (file.type.startsWith('image/')) {
      const compressed = file.size > 1024 * 1024 ? await compressImage(file) : { dataUrl: await fileToDataUrl(file), blob: file };
      return {
        id,
        type: 'image',
        icon: '🖼️',
        name: file.name,
        size: formatFileSize(compressed.blob?.size || file.size),
        dataUrl: compressed.dataUrl,
        mimeType: file.type || 'image/png',
      };
    }

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return {
        id,
        type: 'pdf',
        icon: '📄',
        name: file.name,
        size: formatFileSize(file.size),
        file,
      };
    }

    if (file.type.startsWith('text/') || /\.(txt|md|csv|json|js|ts|tsx|jsx|py|html|css)$/i.test(file.name)) {
      const text = await fileToText(file);
      return {
        id,
        type: 'text',
        icon: '📝',
        name: file.name,
        size: formatFileSize(file.size),
        text: text.slice(0, 60000),
      };
    }

    throw new Error('지원하지 않는 파일 형식입니다. 이미지, PDF, 텍스트 파일만 업로드 가능합니다.');
  }

  partsToPlainText(parts = []) {
    return partsToText(parts);
  }
}
