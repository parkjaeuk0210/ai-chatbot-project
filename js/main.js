import i18n from './i18n/i18n.js';

const API_ENDPOINT = '/api/chat';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 30;
const MAX_PDF_CHARACTERS = 80_000;
const MAX_HISTORY_MESSAGES = 40;
const REQUEST_TIMEOUT_MS = 30_000;

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const elements = {
  chatTab: document.getElementById('chat-tab-button'),
  imageTab: document.getElementById('image-tab-button'),
  chatPanel: document.getElementById('chat-ui'),
  imagePanel: document.getElementById('image-ui'),
  chatMessages: document.getElementById('chat-messages'),
  initialMessage: document.getElementById('initial-message'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  sendButton: document.getElementById('send-button'),
  fileButton: document.getElementById('file-button'),
  fileInput: document.getElementById('file-input'),
  filePreview: document.getElementById('file-preview-container'),
  previewImage: document.getElementById('preview-image'),
  previewPdfIcon: document.getElementById('preview-pdf-icon'),
  previewFilename: document.getElementById('preview-filename'),
  previewFilesize: document.getElementById('preview-filesize'),
  removePreviewButton: document.getElementById('remove-preview-button'),
  composerStatus: document.getElementById('composer-status'),
  imageForm: document.getElementById('image-form'),
  imagePrompt: document.getElementById('image-prompt'),
  imageCharacterCount: document.getElementById('image-character-count'),
  generateImageButton: document.getElementById('generate-image-button'),
  imageResult: document.getElementById('image-result-container'),
  imagePlaceholder: document.getElementById('image-placeholder'),
  imageLoader: document.getElementById('image-loader'),
  generatedImage: document.getElementById('generated-image'),
  settingsButton: document.getElementById('settings-button'),
  settingsModal: document.getElementById('settings-modal'),
  settingsForm: document.getElementById('settings-form'),
  closeSettingsButton: document.getElementById('close-persona-button'),
  cancelSettingsButton: document.getElementById('cancel-settings-button'),
  personaInput: document.getElementById('persona-input'),
  personaCharacterCount: document.getElementById('persona-character-count'),
  languageContainer: document.getElementById('language-selector-container'),
  themeToggle: document.getElementById('theme-toggle'),
  newChatButton: document.getElementById('new-chat-button'),
  toast: document.getElementById('toast')
};

const requiredElements = Object.entries(elements).filter(([, element]) => !element);
if (requiredElements.length) {
  throw new Error(`PERA initialization failed. Missing elements: ${requiredElements.map(([key]) => key).join(', ')}`);
}

const state = {
  history: [],
  attachment: null,
  chatBusy: false,
  imageBusy: false,
  lastChatPayload: null,
  sessionId: createSessionId(),
  persona: safeStorageGet('pera-persona') ?? safeStorageGet('peraPersona') ?? '',
  toastTimer: null,
  activeMode: 'chat'
};

function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return `session-${globalThis.crypto.randomUUID()}`;
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in private or embedded contexts.
  }
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;

  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2400);
}

function setComposerStatus(message = '') {
  elements.composerStatus.textContent = message;
}

function applyTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = normalized;
  safeStorageSet('pera-theme', normalized);
  safeStorageSet('theme', normalized);

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', normalized === 'dark' ? '#0d111b' : '#f5f7fb');
  }
}


async function cleanupLegacyServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // A stale service worker must never block the current application shell.
  }
}

function initializeTheme() {
  const storedTheme = safeStorageGet('pera-theme') ?? safeStorageGet('theme');
  const preferredTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(storedTheme || preferredTheme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function setMode(mode, { focusPanel = false } = {}) {
  const isChat = mode === 'chat';
  state.activeMode = isChat ? 'chat' : 'image';

  elements.chatTab.classList.toggle('is-active', isChat);
  elements.imageTab.classList.toggle('is-active', !isChat);
  elements.chatTab.setAttribute('aria-selected', String(isChat));
  elements.imageTab.setAttribute('aria-selected', String(!isChat));
  elements.chatTab.tabIndex = isChat ? 0 : -1;
  elements.imageTab.tabIndex = isChat ? -1 : 0;

  elements.chatPanel.hidden = !isChat;
  elements.imagePanel.hidden = isChat;
  elements.chatPanel.classList.toggle('is-active', isChat);
  elements.imagePanel.classList.toggle('is-active', !isChat);

  if (focusPanel) {
    window.requestAnimationFrame(() => {
      (isChat ? elements.chatInput : elements.imagePrompt).focus();
    });
  }
}

function handleTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

  event.preventDefault();
  if (event.key === 'Home' || event.key === 'ArrowLeft') {
    setMode('chat', { focusPanel: true });
    elements.chatTab.focus();
  } else {
    setMode('image', { focusPanel: true });
    elements.imageTab.focus();
  }
}

function autoResizeTextarea(textarea, maxHeight = 154) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function clearConversation({ announce = true } = {}) {
  if (state.chatBusy) return;

  state.history = [];
  state.lastChatPayload = null;
  state.sessionId = createSessionId();
  elements.chatMessages.querySelectorAll('.message-row').forEach((message) => message.remove());
  elements.initialMessage.hidden = false;
  removeAttachment();
  elements.chatInput.value = '';
  autoResizeTextarea(elements.chatInput);

  if (announce) showToast(i18n.t('chat.newConversation'));
  elements.chatInput.focus();
}

function createAvatar(role) {
  const avatar = document.createElement('span');
  avatar.className = 'message-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? i18n.t('chat.you').slice(0, 2) : 'P';
  return avatar;
}

function createAttachmentBadge(attachment) {
  const badge = document.createElement('span');
  badge.className = 'message-attachment';

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', attachment.kind === 'pdf'
    ? 'M7 2h7l5 5v15H7zM14 2v6h6'
    : 'M3 5h18v14H3zM7 14l3-3 3 3 2-2 4 4');
  icon.appendChild(path);

  const label = document.createElement('span');
  label.textContent = attachment.name || i18n.t('chat.attachmentAdded');

  badge.append(icon, label);
  return badge;
}

function createMessagePart(part) {
  if (part.attachment) {
    return createAttachmentBadge(part.attachment);
  }

  if (part.inlineData?.data) {
    const image = document.createElement('img');
    const mimeType = /^image\/(?:png|jpe?g|webp|gif)$/i.test(part.inlineData.mimeType || '')
      ? part.inlineData.mimeType
      : 'image/png';
    image.src = `data:${mimeType};base64,${String(part.inlineData.data).replace(/\s/g, '')}`;
    image.alt = part.alt || i18n.t('image.alt');
    image.loading = 'lazy';
    return image;
  }

  if (typeof part.text === 'string' && part.text.trim()) {
    const paragraph = document.createElement('p');
    paragraph.textContent = part.text;
    return paragraph;
  }

  return null;
}

function renderMessage(role, parts, { error = false, retry = false } = {}) {
  elements.initialMessage.hidden = true;

  const row = document.createElement('article');
  row.className = `message-row ${role === 'user' ? 'is-user' : 'is-assistant'}`;
  if (error) row.classList.add('is-error');
  row.setAttribute('aria-label', role === 'user' ? i18n.t('chat.you') : i18n.t('chat.ai'));

  const card = document.createElement('div');
  card.className = 'message-card';

  const content = document.createElement('div');
  content.className = 'message-content';

  for (const part of parts) {
    const node = createMessagePart(part);
    if (node) content.appendChild(node);
  }

  if (!content.childElementCount) {
    const fallback = document.createElement('p');
    fallback.textContent = i18n.t('error.general');
    content.appendChild(fallback);
  }

  if (retry) {
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'retry-button';
    retryButton.textContent = i18n.t('chat.retry');
    retryButton.addEventListener('click', retryLastChatRequest, { once: true });
    content.appendChild(retryButton);
  }

  card.appendChild(content);

  if (role === 'user') {
    row.append(card, createAvatar(role));
  } else {
    row.append(createAvatar(role), card);
  }

  elements.chatMessages.appendChild(row);
  scrollMessagesToBottom();
  return row;
}

function renderLoadingMessage() {
  removeLoadingMessage();

  const row = document.createElement('article');
  row.id = 'loading-indicator';
  row.className = 'message-row is-assistant';
  row.setAttribute('aria-label', i18n.t('chat.loading'));

  const card = document.createElement('div');
  card.className = 'message-card loading-card';

  const content = document.createElement('div');
  content.className = 'message-content';

  const dots = document.createElement('div');
  dots.className = 'loading-dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));

  content.appendChild(dots);
  card.appendChild(content);
  row.append(createAvatar('assistant'), card);
  elements.chatMessages.appendChild(row);
  scrollMessagesToBottom();
}

function removeLoadingMessage() {
  document.getElementById('loading-indicator')?.remove();
}

function scrollMessagesToBottom() {
  window.requestAnimationFrame(() => {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  });
}

function normalizeResponseContent(content) {
  if (!content || !Array.isArray(content.parts)) {
    throw new ApiError(i18n.t('error.general'));
  }

  return {
    role: content.role === 'assistant' ? 'model' : (content.role || 'model'),
    parts: content.parts
  };
}

function trimClientHistory() {
  if (state.history.length <= MAX_HISTORY_MESSAGES) return;
  state.history = state.history.slice(-MAX_HISTORY_MESSAGES);
}

function composePersona() {
  return [i18n.getAISystemMessage(), state.persona.trim()].filter(Boolean).join('\n\n');
}

function friendlyError(error) {
  if (!navigator.onLine) return i18n.t('error.network');
  if (error?.name === 'AbortError') return i18n.t('error.timeout');
  if (error?.status === 429) return i18n.t('error.rateLimit');
  if (error?.status === 408 || error?.status === 504) return i18n.t('error.timeout');
  return error?.message || i18n.t('error.general');
}

async function requestApi(payload) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const responseText = await response.text();
    let data = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        if (!response.ok) throw new ApiError(i18n.t('error.general'), response.status);
      }
    }

    if (!response.ok) {
      throw new ApiError(data?.message || i18n.t('error.general'), response.status);
    }

    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

function setChatBusy(busy) {
  state.chatBusy = busy;
  elements.sendButton.disabled = busy;
  elements.fileButton.disabled = busy;
  elements.newChatButton.disabled = busy;
  elements.chatInput.setAttribute('aria-busy', String(busy));
}

async function buildAttachmentParts() {
  if (!state.attachment) return { apiParts: [], displayParts: [] };

  if (state.attachment.kind === 'image') {
    const [, base64 = ''] = state.attachment.dataUrl.split(',');
    return {
      apiParts: [{
        inlineData: {
          mimeType: state.attachment.mimeType,
          data: base64
        }
      }],
      displayParts: [
        {
          attachment: {
            kind: 'image',
            name: state.attachment.name
          }
        },
        {
          inlineData: {
            mimeType: state.attachment.mimeType,
            data: base64
          },
          alt: state.attachment.name
        }
      ]
    };
  }

  setComposerStatus(i18n.t('chat.loading'));
  const pdfText = await extractPdfText(state.attachment.file);

  return {
    apiParts: [{
      text: [
        `[Attached PDF: ${state.attachment.name}]`,
        'Use the document content below as context for the user request.',
        '--- PDF CONTENT START ---',
        pdfText,
        '--- PDF CONTENT END ---'
      ].join('\n')
    }],
    displayParts: [{
      attachment: {
        kind: 'pdf',
        name: state.attachment.name
      }
    }]
  };
}

async function submitChat({ retryPayload = null } = {}) {
  if (state.chatBusy) return;

  if (retryPayload) {
    await executeChatRequest(retryPayload, { isRetry: true });
    return;
  }

  const message = elements.chatInput.value.trim();
  if (!message && !state.attachment) return;

  setChatBusy(true);

  try {
    const { apiParts, displayParts } = await buildAttachmentParts();

    if (message) {
      apiParts.push({ text: message });
      displayParts.push({ text: message });
    }

    renderMessage('user', displayParts);
    state.history.push({ role: 'user', parts: apiParts });
    trimClientHistory();

    const payload = {
      chatHistory: state.history,
      model: 'gemini',
      persona: composePersona(),
      sessionId: state.sessionId
    };

    state.lastChatPayload = structuredCloneSafe(payload);
    elements.chatInput.value = '';
    autoResizeTextarea(elements.chatInput);
    removeAttachment();
    setComposerStatus('');

    await executeChatRequest(payload, { busyAlreadySet: true });
  } catch (error) {
    setComposerStatus('');
    renderMessage('assistant', [{ text: friendlyError(error) }], { error: true });
    setChatBusy(false);
  }
}

async function executeChatRequest(payload, { busyAlreadySet = false, isRetry = false } = {}) {
  if (!busyAlreadySet) setChatBusy(true);

  if (isRetry) {
    elements.chatMessages.querySelector('.message-row.is-error:last-of-type')?.remove();
  }

  renderLoadingMessage();
  setComposerStatus(i18n.t('chat.loading'));

  try {
    const result = await requestApi(payload);
    const content = normalizeResponseContent(result?.candidates?.[0]?.content);
    state.history.push(content);
    trimClientHistory();
    renderMessage('assistant', content.parts);
    state.lastChatPayload = null;
  } catch (error) {
    renderMessage(
      'assistant',
      [{ text: friendlyError(error) }],
      { error: true, retry: Boolean(state.lastChatPayload) }
    );
  } finally {
    removeLoadingMessage();
    setComposerStatus('');
    setChatBusy(false);
    elements.chatInput.focus();
  }
}

async function retryLastChatRequest() {
  if (!state.lastChatPayload || state.chatBusy) return;
  await submitChat({ retryPayload: structuredCloneSafe(state.lastChatPayload) });
}

function structuredCloneSafe(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

async function handleFileSelection(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  if (file.size > MAX_FILE_BYTES) {
    showToast(i18n.t('error.fileSize'));
    elements.fileInput.value = '';
    return;
  }

  const isImage = /^image\/(png|jpeg|webp|gif)$/i.test(file.type);
  const isPdf = file.type === 'application/pdf';

  if (!isImage && !isPdf) {
    showToast(i18n.t('error.fileType'));
    elements.fileInput.value = '';
    return;
  }

  try {
    if (isImage) {
      const dataUrl = file.type === 'image/gif'
        ? await readFileAsDataUrl(file)
        : await compressImage(file);

      state.attachment = {
        kind: 'image',
        file,
        name: file.name,
        size: file.size,
        mimeType: dataUrl.slice(5, dataUrl.indexOf(';')) || file.type,
        dataUrl
      };
    } else {
      state.attachment = {
        kind: 'pdf',
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type
      };
    }

    updateAttachmentPreview();
    setComposerStatus(i18n.t('chat.attachmentAdded'));
    elements.chatInput.focus();
  } catch (error) {
    console.error('Attachment processing failed:', error);
    showToast(isImage ? i18n.t('error.imageProcess') : i18n.t('error.pdfProcess'));
    removeAttachment();
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error || new Error('File read failed')));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));

  if (scale === 1 && file.size <= 1_500_000) {
    return originalDataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext('2d', { alpha: file.type === 'image/png' });
  if (!context) throw new Error('Canvas is unavailable');

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(outputType, outputType === 'image/png' ? undefined : 0.84);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('Image decode failed')), { once: true });
    image.src = source;
  });
}

function updateAttachmentPreview() {
  const attachment = state.attachment;
  elements.filePreview.hidden = !attachment;

  if (!attachment) return;

  elements.previewFilename.textContent = attachment.name;
  elements.previewFilesize.textContent = formatFileSize(attachment.size);

  const isImage = attachment.kind === 'image';
  elements.previewImage.hidden = !isImage;
  elements.previewPdfIcon.hidden = isImage;

  if (isImage) {
    elements.previewImage.src = attachment.dataUrl;
    elements.previewImage.alt = attachment.name;
  } else {
    elements.previewImage.removeAttribute('src');
    elements.previewImage.alt = '';
  }
}

function removeAttachment() {
  state.attachment = null;
  elements.fileInput.value = '';
  elements.filePreview.hidden = true;
  elements.previewImage.removeAttribute('src');
  elements.previewImage.alt = '';
  elements.previewFilename.textContent = '';
  elements.previewFilesize.textContent = '';
}

async function extractPdfText(file) {
  const pdfLibrary = globalThis.pdfjsLib;
  if (!pdfLibrary) {
    throw new Error(i18n.t('error.pdfProcess'));
  }

  pdfLibrary.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  const pdf = await pdfLibrary.getDocument(await file.arrayBuffer()).promise;
  const pageLimit = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const chunks = [];

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ')
      .trim();

    if (pageText) chunks.push(`[Page ${pageNumber}]\n${pageText}`);

    if (chunks.join('\n\n').length >= MAX_PDF_CHARACTERS) break;
  }

  const text = chunks.join('\n\n').slice(0, MAX_PDF_CHARACTERS);
  if (!text) throw new Error(i18n.t('error.pdfProcess'));

  if (pdf.numPages > pageLimit || text.length >= MAX_PDF_CHARACTERS) {
    return `${text}\n\n[Document content was truncated for request size and performance.]`;
  }

  return text;
}

function setImageBusy(busy) {
  state.imageBusy = busy;
  elements.generateImageButton.disabled = busy;
  elements.imagePrompt.disabled = busy;
  elements.imageResult.setAttribute('aria-busy', String(busy));
  elements.imageLoader.hidden = !busy;
  if (busy) {
    elements.imagePlaceholder.hidden = true;
    elements.generatedImage.hidden = true;
  }
}

async function submitImage() {
  if (state.imageBusy) return;

  const prompt = elements.imagePrompt.value.trim();
  if (!prompt) {
    elements.imagePrompt.focus();
    return;
  }

  setImageBusy(true);

  try {
    const result = await requestApi({
      chatHistory: prompt,
      model: 'gemini-image',
      persona: composePersona(),
      sessionId: state.sessionId
    });

    const parts = result?.candidates?.[0]?.content?.parts;
    const imagePart = Array.isArray(parts)
      ? parts.find((part) => part.inlineData?.data)
      : null;

    if (!imagePart) throw new ApiError(i18n.t('error.general'));

    const mimeType = /^image\/(?:png|jpe?g|webp)$/i.test(imagePart.inlineData.mimeType || '')
      ? imagePart.inlineData.mimeType
      : 'image/png';

    elements.generatedImage.src =
      `data:${mimeType};base64,${String(imagePart.inlineData.data).replace(/\s/g, '')}`;
    elements.generatedImage.hidden = false;
    elements.imagePlaceholder.hidden = true;
  } catch (error) {
    elements.imagePlaceholder.hidden = false;
    const title = elements.imagePlaceholder.querySelector('strong');
    const meta = elements.imagePlaceholder.querySelector('span');
    title.textContent = friendlyError(error);
    meta.textContent = i18n.t('chat.retry');
  } finally {
    setImageBusy(false);
  }
}

function resetImagePlaceholderTranslation() {
  if (!elements.generatedImage.hidden) return;
  const title = elements.imagePlaceholder.querySelector('strong');
  const meta = elements.imagePlaceholder.querySelector('span');
  title.textContent = i18n.t('image.empty');
  meta.textContent = i18n.t('image.emptyMeta');
}

function updateImageCharacterCount() {
  elements.imageCharacterCount.textContent = `${elements.imagePrompt.value.length} / 1000`;
}

function openSettings() {
  elements.personaInput.value = state.persona;
  elements.personaCharacterCount.textContent = String(state.persona.length);

  if (!elements.settingsModal.open) {
    elements.settingsModal.showModal();
  }

  window.requestAnimationFrame(() => elements.personaInput.focus());
}

function closeSettings() {
  if (elements.settingsModal.open) elements.settingsModal.close();
  elements.settingsButton.focus();
}

function saveSettings(event) {
  event.preventDefault();
  state.persona = elements.personaInput.value.trim().slice(0, 4000);
  safeStorageSet('pera-persona', state.persona);
  safeStorageSet('peraPersona', state.persona);
  elements.settingsModal.close();
  showToast(i18n.t('settings.saved'));
  elements.settingsButton.focus();
}

function handleSettingsBackdropClick(event) {
  const bounds = elements.settingsModal.getBoundingClientRect();
  const inside =
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom;

  if (!inside) closeSettings();
}

function installLanguageSelector() {
  elements.languageContainer.replaceChildren(i18n.createLanguageSelector());
}

function bindEvents() {
  elements.chatTab.addEventListener('click', () => setMode('chat', { focusPanel: true }));
  elements.imageTab.addEventListener('click', () => setMode('image', { focusPanel: true }));
  elements.chatTab.addEventListener('keydown', handleTabKeydown);
  elements.imageTab.addEventListener('keydown', handleTabKeydown);

  elements.chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitChat();
  });

  elements.chatInput.addEventListener('input', () => autoResizeTextarea(elements.chatInput));
  elements.chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      elements.chatForm.requestSubmit();
    }
  });

  elements.fileButton.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileSelection);
  elements.removePreviewButton.addEventListener('click', removeAttachment);

  elements.imageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitImage();
  });
  elements.imagePrompt.addEventListener('input', () => {
    updateImageCharacterCount();
    resetImagePlaceholderTranslation();
  });

  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.newChatButton.addEventListener('click', () => clearConversation());
  elements.settingsButton.addEventListener('click', openSettings);
  elements.closeSettingsButton.addEventListener('click', closeSettings);
  elements.cancelSettingsButton.addEventListener('click', closeSettings);
  elements.settingsForm.addEventListener('submit', saveSettings);
  elements.settingsModal.addEventListener('click', handleSettingsBackdropClick);
  elements.personaInput.addEventListener('input', () => {
    elements.personaCharacterCount.textContent = String(elements.personaInput.value.length);
  });

  elements.initialMessage.querySelectorAll('[data-prompt-key]').forEach((button) => {
    button.addEventListener('click', () => {
      elements.chatInput.value = i18n.t(button.dataset.promptKey);
      autoResizeTextarea(elements.chatInput);
      elements.chatInput.focus();
    });
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      (state.activeMode === 'chat' ? elements.chatInput : elements.imagePrompt).focus();
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSettings();
    }
  });

  window.addEventListener('languageChanged', () => {
    installLanguageSelector();
    updateImageCharacterCount();
    resetImagePlaceholderTranslation();
    document.querySelectorAll('.message-row').forEach((message) => {
      const isUser = message.classList.contains('is-user');
      message.setAttribute('aria-label', isUser ? i18n.t('chat.you') : i18n.t('chat.ai'));
    });
  });
}

async function initialize() {
  cleanupLegacyServiceWorkers();
  initializeTheme();
  state.persona = state.persona.slice(0, 4000);
  await i18n.init();
  installLanguageSelector();
  bindEvents();
  const initialMode = new URLSearchParams(window.location.search).get('tab') === 'image'
    ? 'image'
    : 'chat';
  setMode(initialMode);
  updateImageCharacterCount();
  autoResizeTextarea(elements.chatInput);
  elements.personaCharacterCount.textContent = String(state.persona.length);
}

initialize().catch((error) => {
  console.error('PERA initialization failed:', error);
  setComposerStatus(i18n.t('error.general'));
});
