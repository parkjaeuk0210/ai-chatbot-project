// Main PERA Studio application module.
import { ChatManager } from './chat.js';
import {
  buildPersonaInstruction,
  copyToClipboard,
  createId,
  downloadTextFile,
  extractFirstUrl,
  formatDateTime,
  generateSessionId,
  getModeInstruction,
  getModeLabel,
  getSlashCommands,
  inferTitle,
  normalizeUrl,
  parseSlashCommand,
  readJsonStorage,
  sanitizeHTML,
  writeJsonStorage,
} from './utils.js';

const STORAGE_KEYS = {
  theme: 'peraStudioTheme',
  settings: 'peraStudioSettings',
  conversations: 'peraStudioConversations',
  artifacts: 'peraStudioArtifacts',
};

const MAX_HISTORY = 24;
const MAX_ARTIFACTS = 80;

class PeraStudioApp {
  constructor() {
    this.chatManager = new ChatManager();
    this.sessionId = generateSessionId();
    this.contextItems = [];
    this.artifacts = readJsonStorage(STORAGE_KEYS.artifacts, []);
    this.conversations = readJsonStorage(STORAGE_KEYS.conversations, []);
    this.settings = readJsonStorage(STORAGE_KEYS.settings, {
      preset: 'friendly',
      depth: 'balanced',
      custom: '',
    });
    this.mode = 'chat';
    this.activeArtifactId = this.artifacts[0]?.id || null;
    this.activeWorkbenchTab = 'artifacts';
    this.isLoading = false;
    this.lastUserMessage = '';

    this.initializeElements();
    this.initializeTheme();
    this.initializeSettings();
    this.initializeEvents();
    this.applyInitialUrlMode();
    this.renderAll();
  }

  initializeElements() {
    const byId = (id) => document.getElementById(id);

    this.shell = byId('studio-shell');
    this.mobileScrim = byId('mobile-scrim');

    this.navigator = byId('navigator');
    this.openNavButton = byId('open-nav-button');
    this.closeNavButton = byId('close-nav-button');
    this.newChatButton = byId('new-chat-button');
    this.clearHistoryButton = byId('clear-history-button');
    this.historyList = byId('history-list');

    this.chatMessages = byId('chat-messages');
    this.emptyState = byId('empty-state');
    this.promptGrid = byId('prompt-grid');

    this.chatInput = byId('chat-input');
    this.fileInput = byId('file-input');
    this.fileButton = byId('file-button');
    this.urlButton = byId('url-button');
    this.modeSelect = byId('mode-select');
    this.contextShelf = byId('context-shelf');
    this.slashMenu = byId('slash-menu');
    this.sendButton = byId('send-button');
    this.stopButton = byId('stop-button');
    this.composerHint = byId('composer-hint');

    this.activeModeChip = byId('active-mode-chip');
    this.themeToggle = byId('theme-toggle');
    this.settingsButton = byId('settings-button');

    this.workbench = byId('workbench');
    this.openWorkbenchButton = byId('open-workbench-button');
    this.closeWorkbenchButton = byId('close-workbench-button');
    this.workbenchTabs = [...document.querySelectorAll('.workbench-tab')];
    this.artifactList = byId('artifact-list');
    this.artifactDetail = byId('artifact-detail');

    this.settingsModal = byId('settings-modal');
    this.closeSettingsButton = byId('close-settings-button');
    this.saveSettingsButton = byId('save-settings-button');
    this.resetSettingsButton = byId('reset-settings-button');
    this.personaPreset = byId('persona-preset');
    this.answerDepth = byId('answer-depth');
    this.personaInput = byId('persona-input');

    this.toastStack = document.querySelector('.toast-stack');
    if (!this.toastStack) {
      this.toastStack = document.createElement('div');
      this.toastStack.className = 'toast-stack';
      document.body.appendChild(this.toastStack);
    }
  }

  initializeTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    const preferredDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const theme = saved || (preferredDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }

  initializeSettings() {
    this.personaPreset.value = this.settings.preset || 'friendly';
    this.answerDepth.value = this.settings.depth || 'balanced';
    this.personaInput.value = this.settings.custom || '';
  }

  initializeEvents() {
    this.openNavButton?.addEventListener('click', () => this.togglePanel('nav', true));
    this.closeNavButton?.addEventListener('click', () => this.togglePanel('nav', false));
    this.openWorkbenchButton?.addEventListener('click', () => this.togglePanel('workbench', true));
    this.closeWorkbenchButton?.addEventListener('click', () => this.togglePanel('workbench', false));
    this.mobileScrim?.addEventListener('click', () => this.closeMobilePanels());

    this.newChatButton.addEventListener('click', () => this.startNewConversation());
    this.clearHistoryButton.addEventListener('click', () => this.clearHistory());

    document.querySelectorAll('.quick-action').forEach((button) => {
      button.addEventListener('click', () => {
        this.applyQuickAction(button.dataset.mode, button.dataset.prompt);
      });
    });

    this.chatInput.addEventListener('input', () => this.handleInputChange());
    this.chatInput.addEventListener('keydown', (event) => this.handleInputKeydown(event));
    this.chatInput.addEventListener('paste', (event) => this.handlePaste(event));

    this.fileButton.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (event) => this.handleFiles(event.target.files));
    this.urlButton.addEventListener('click', () => this.promptForUrl());

    this.modeSelect.addEventListener('change', () => this.setMode(this.modeSelect.value));
    this.sendButton.addEventListener('click', () => this.handleSendMessage());
    this.stopButton.addEventListener('click', () => this.stopResponse());

    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.settingsButton.addEventListener('click', () => this.openSettings());
    this.closeSettingsButton.addEventListener('click', () => this.closeSettings());
    this.saveSettingsButton.addEventListener('click', () => this.saveSettings());
    this.resetSettingsButton.addEventListener('click', () => this.resetSettings());
    this.settingsModal.addEventListener('click', (event) => {
      if (event.target === this.settingsModal) this.closeSettings();
    });

    this.contextShelf.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-context]');
      if (removeButton) {
        this.removeContext(removeButton.dataset.removeContext);
      }
    });

    this.slashMenu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-slash]');
      if (button) {
        this.applySlashCommand(button.dataset.slash);
      }
    });

    this.chatMessages.addEventListener('click', (event) => this.handleMessageAction(event));
    this.artifactList.addEventListener('click', (event) => {
      const item = event.target.closest('[data-artifact-id]');
      if (item) {
        this.selectArtifact(item.dataset.artifactId);
      }
    });
    this.artifactDetail.addEventListener('click', (event) => this.handleArtifactAction(event));

    this.workbenchTabs.forEach((tab) => {
      tab.addEventListener('click', () => this.setWorkbenchTab(tab.dataset.tab));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!this.settingsModal.hidden) {
          this.closeSettings();
        } else {
          this.closeMobilePanels();
          this.hideSlashMenu();
        }
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.chatInput.focus();
        this.chatInput.value = '/';
        this.handleInputChange();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        this.togglePanel('workbench', true);
      }
    });
  }

  applyInitialUrlMode() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode) {
      this.setMode(mode);
      if (mode === 'image') {
        this.chatInput.value = '/이미지 ';
        this.handleInputChange();
      }
    }
  }

  renderAll() {
    this.renderHistory();
    this.renderContextShelf();
    this.renderArtifacts();
    this.renderArtifactDetail();
    this.updateModeUI();
    this.updateEmptyState();
  }

  setMode(mode = 'chat') {
    const allowed = ['chat', 'summary', 'report', 'table', 'quiz', 'code', 'image'];
    this.mode = allowed.includes(mode) ? mode : 'chat';
    this.updateModeUI();
  }

  updateModeUI() {
    this.modeSelect.value = this.mode;
    this.activeModeChip.textContent = `모드: ${getModeLabel(this.mode)}`;
    this.composerHint.textContent = this.mode === 'image'
      ? '이미지 모드 · 프롬프트를 자세히 쓸수록 결과가 좋아집니다'
      : 'Enter 전송 · Shift+Enter 줄바꿈';
  }

  updateEmptyState() {
    this.emptyState.classList.toggle('is-hidden', this.chatMessages.children.length > 0);
  }

  handleInputChange() {
    this.autoResizeInput();
    this.updateSlashMenu();
  }

  autoResizeInput() {
    this.chatInput.style.height = 'auto';
    this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 180)}px`;
  }

  handleInputKeydown(event) {
    if (!this.slashMenu.hidden && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)) {
      const items = [...this.slashMenu.querySelectorAll('.slash-item')];
      const current = Math.max(0, items.findIndex((item) => item.classList.contains('is-active')));
      let next = current;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        next = Math.min(items.length - 1, current + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        next = Math.max(0, current - 1);
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        items[current]?.click();
        return;
      }

      items.forEach((item, index) => item.classList.toggle('is-active', index === next));
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.handleSendMessage();
    }
  }

  handlePaste(event) {
    const text = event.clipboardData?.getData('text') || '';
    const url = extractFirstUrl(text);
    if (url && text.trim() === url) {
      event.preventDefault();
      this.addUrlContext(url);
      this.toast('URL을 컨텍스트로 추가했습니다.');
    }
  }

  updateSlashMenu() {
    const value = this.chatInput.value.trim();
    if (!value.startsWith('/') || value.includes(' ')) {
      this.hideSlashMenu();
      return;
    }

    const query = value.slice(1).toLowerCase();
    const commands = getSlashCommands().filter((command) => command.name.toLowerCase().startsWith(query));

    if (!commands.length) {
      this.hideSlashMenu();
      return;
    }

    this.slashMenu.hidden = false;
    this.slashMenu.innerHTML = commands.map((command, index) => `
      <button class="slash-item ${index === 0 ? 'is-active' : ''}" type="button" data-slash="${sanitizeHTML(command.name)}">
        <kbd>/${sanitizeHTML(command.name)}</kbd>
        <span>${sanitizeHTML(command.label)}</span>
        <small>${sanitizeHTML(getModeLabel(command.mode))}</small>
      </button>
    `).join('');
  }

  hideSlashMenu() {
    this.slashMenu.hidden = true;
    this.slashMenu.innerHTML = '';
  }

  applySlashCommand(name) {
    const command = getSlashCommands().find((item) => item.name === name);
    if (!command) return;

    this.setMode(command.mode);
    this.chatInput.value = command.prompt || '';
    if (command.mode === 'image') {
      this.chatInput.value = '/이미지 ';
    }
    this.hideSlashMenu();
    this.handleInputChange();
    this.chatInput.focus();
  }

  applyQuickAction(mode, prompt) {
    this.setMode(mode || 'chat');
    this.chatInput.value = prompt || '';
    this.handleInputChange();
    this.chatInput.focus();
    this.closeMobilePanels();
  }

  async handleFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;

    for (const file of files) {
      try {
        const context = await this.chatManager.fileToContext(file);
        this.contextItems.push(context);
        this.addArtifact({
          type: 'file',
          title: context.name,
          content: `${context.icon} ${context.name}\n크기: ${context.size}\n형식: ${context.type}`,
          source: context.name,
          metadata: { contextId: context.id, contextType: context.type },
          silent: true,
        });
      } catch (error) {
        this.toast(error.message, 'error');
      }
    }

    this.fileInput.value = '';
    this.renderContextShelf();
    this.renderArtifacts();
    this.toast(`${files.length}개 파일을 컨텍스트로 추가했습니다.`);
  }

  promptForUrl() {
    const raw = window.prompt('컨텍스트로 사용할 URL을 입력하세요');
    if (!raw) return;
    const url = normalizeUrl(raw);
    if (!url) {
      this.toast('올바른 URL 형식이 아닙니다.', 'error');
      return;
    }
    this.addUrlContext(url);
  }

  addUrlContext(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    if (this.contextItems.some((context) => context.type === 'url' && context.url === normalized)) {
      this.toast('이미 추가된 URL입니다.');
      return;
    }

    const context = {
      id: createId('context'),
      type: 'url',
      icon: '🔗',
      name: new URL(normalized).hostname,
      url: normalized,
    };

    this.contextItems.push(context);
    this.addArtifact({
      type: 'source',
      title: context.name,
      content: normalized,
      source: normalized,
      metadata: { contextId: context.id, contextType: 'url' },
      silent: true,
    });
    this.renderContextShelf();
    this.renderArtifacts();
  }

  removeContext(id) {
    this.contextItems = this.contextItems.filter((context) => context.id !== id);
    this.renderContextShelf();
  }

  renderContextShelf() {
    this.contextShelf.innerHTML = this.contextItems.map((context) => `
      <span class="context-chip" title="${sanitizeHTML(context.url || context.name)}">
        <span>${sanitizeHTML(context.icon || '◇')}</span>
        <span class="context-chip__name">${sanitizeHTML(context.name || context.url || context.type)}</span>
        ${context.size ? `<small>${sanitizeHTML(context.size)}</small>` : ''}
        <button type="button" data-remove-context="${sanitizeHTML(context.id)}" aria-label="${sanitizeHTML(context.name || '컨텍스트')} 제거">×</button>
      </span>
    `).join('');
  }

  async handleSendMessage() {
    if (this.isLoading) return;

    let message = this.chatInput.value.trim();
    const slash = parseSlashCommand(message);
    let mode = this.mode;

    if (slash) {
      mode = slash.mode;
      this.setMode(mode);
      message = slash.rest || slash.prompt || '';
    }

    if (!message && !this.contextItems.length) {
      this.chatInput.focus();
      return;
    }

    if (mode === 'image') {
      await this.handleGenerateImage(message || this.lastUserMessage);
      return;
    }

    await this.handleTextMessage(message, mode);
  }

  getApiUrl() {
    return '/api/chat-secure';
  }

  async handleTextMessage(message, mode) {
    const contexts = [...this.contextItems];
    const modeInstruction = getModeInstruction(mode);
    const finalMessage = [modeInstruction, message].filter(Boolean).join('\n\n');

    const displayParts = this.chatManager.buildDisplayParts(message, contexts);
    this.chatManager.addMessage(this.chatMessages, 'user', displayParts);
    this.updateEmptyState();

    this.lastUserMessage = message;
    this.chatInput.value = '';
    this.autoResizeInput();
    this.contextItems = [];
    this.renderContextShelf();
    this.setLoading(true);
    this.chatManager.toggleLoading(this.chatMessages, true);

    const persona = buildPersonaInstruction(this.settings);

    await this.chatManager.sendMessage(
      this.getApiUrl(),
      finalMessage,
      contexts,
      persona,
      this.sessionId,
      mode,
      (botParts) => {
        this.chatManager.toggleLoading(this.chatMessages, false);
        const messageElement = this.chatManager.addMessage(this.chatMessages, 'assistant', botParts);
        const plainText = this.chatManager.partsToPlainText(botParts);
        messageElement.dataset.plainText = plainText;

        if (this.shouldCreateArtifact(mode, plainText)) {
          this.addArtifact({
            type: this.modeToArtifactType(mode, plainText),
            title: inferTitle(message || plainText),
            content: plainText,
            source: message,
            contexts: contexts.map((context) => ({ type: context.type, name: context.name || context.url })),
          });
        }

        this.saveConversation(message, plainText, mode);
        this.setLoading(false);
      },
      (errorInfo) => {
        this.chatManager.toggleLoading(this.chatMessages, false);
        const element = this.chatManager.addMessage(this.chatMessages, 'assistant', [{ text: errorInfo.fullMessage }]);
        element.dataset.plainText = errorInfo.fullMessage;
        this.setLoading(false);
      },
    );
  }

  async handleGenerateImage(prompt) {
    if (!prompt?.trim()) {
      this.toast('이미지 프롬프트를 입력해주세요.', 'error');
      return;
    }

    const cleanPrompt = prompt.replace(/^\/(?:이미지|image)\s*/i, '').trim();
    const userPrompt = cleanPrompt || prompt.trim();

    this.chatManager.addMessage(this.chatMessages, 'user', [{ text: `/이미지 ${userPrompt}` }]);
    this.updateEmptyState();
    this.chatInput.value = '';
    this.autoResizeInput();
    this.setLoading(true);
    this.chatManager.toggleLoading(this.chatMessages, true);

    await this.chatManager.generateImage(
      this.getApiUrl(),
      userPrompt,
      this.sessionId,
      ({ imageUrl, text }) => {
        this.chatManager.toggleLoading(this.chatMessages, false);
        const parts = [];
        if (text) {
          parts.push({ text });
        }
        if (imageUrl) {
          parts.push({ imageUrl, name: userPrompt });
        }
        if (!parts.length) {
          parts.push({ text: '이미지 생성 응답을 받았지만 표시할 데이터가 없습니다.' });
        }

        const messageElement = this.chatManager.addMessage(this.chatMessages, 'assistant', parts);
        messageElement.dataset.plainText = text || userPrompt;

        this.addArtifact({
          type: imageUrl ? 'image' : 'document',
          title: inferTitle(userPrompt),
          content: text || userPrompt,
          imageUrl,
          source: userPrompt,
        });
        this.saveConversation(userPrompt, text || '이미지 생성', 'image');
        this.setLoading(false);
      },
      (errorInfo) => {
        this.chatManager.toggleLoading(this.chatMessages, false);
        const element = this.chatManager.addMessage(this.chatMessages, 'assistant', [{ text: errorInfo.fullMessage }]);
        element.dataset.plainText = errorInfo.fullMessage;
        this.setLoading(false);
      },
    );
  }

  shouldCreateArtifact(mode, text) {
    return ['summary', 'report', 'table', 'quiz', 'code'].includes(mode) || String(text || '').length > 900 || /\|.+\|/.test(text);
  }

  modeToArtifactType(mode, text) {
    if (mode === 'table' || /\|.+\|/.test(text)) return 'table';
    if (mode === 'quiz') return 'quiz';
    if (mode === 'code' || /```/.test(text)) return 'code';
    return 'document';
  }

  setLoading(isLoading) {
    this.isLoading = isLoading;
    this.sendButton.hidden = isLoading;
    this.stopButton.hidden = !isLoading;
    this.chatInput.disabled = isLoading;
    this.fileButton.disabled = isLoading;
    this.urlButton.disabled = isLoading;
    this.modeSelect.disabled = isLoading;
  }

  stopResponse() {
    this.chatManager.abort();
    this.chatManager.toggleLoading(this.chatMessages, false);
    this.setLoading(false);
    this.toast('응답 생성을 중지했습니다.');
  }

  async handleMessageAction(event) {
    const action = event.target.closest('[data-message-action]')?.dataset.messageAction;
    if (!action) return;

    const messageElement = event.target.closest('.message');
    const text = messageElement?.dataset.plainText || messageElement?.innerText || '';

    if (action === 'copy') {
      await copyToClipboard(text);
      this.toast('답변을 복사했습니다.');
      return;
    }

    if (action === 'artifact') {
      this.addArtifact({
        type: 'document',
        title: inferTitle(text),
        content: text,
        source: '대화 답변',
      });
      this.togglePanel('workbench', true);
      return;
    }

    if (action === 'shorten') {
      this.chatInput.value = `위 답변을 더 짧게 요약해줘:\n\n${text.slice(0, 1600)}`;
      this.setMode('summary');
      this.handleInputChange();
      this.chatInput.focus();
      return;
    }

    if (action === 'table') {
      this.chatInput.value = `위 답변을 표로 정리해줘:\n\n${text.slice(0, 1600)}`;
      this.setMode('table');
      this.handleInputChange();
      this.chatInput.focus();
      return;
    }

    if (action === 'retry') {
      if (this.lastUserMessage) {
        this.chatInput.value = this.lastUserMessage;
        this.handleInputChange();
        await this.handleSendMessage();
      }
    }
  }

  addArtifact(artifact) {
    const item = {
      id: createId('artifact'),
      type: artifact.type || 'document',
      title: artifact.title || 'PERA 결과물',
      content: artifact.content || '',
      imageUrl: artifact.imageUrl || '',
      source: artifact.source || '',
      contexts: artifact.contexts || [],
      metadata: artifact.metadata || {},
      createdAt: Date.now(),
    };

    this.artifacts = [item, ...this.artifacts].slice(0, MAX_ARTIFACTS);
    this.activeArtifactId = item.id;
    writeJsonStorage(STORAGE_KEYS.artifacts, this.artifacts);
    this.renderArtifacts();
    this.renderArtifactDetail();

    if (!artifact.silent) {
      this.toast('Workbench에 결과물을 저장했습니다.');
    }

    return item;
  }

  renderArtifacts() {
    const filtered = this.getWorkbenchItems();

    if (!filtered.length) {
      this.artifactList.innerHTML = '<div class="empty-list">표시할 항목이 없습니다.</div>';
      return;
    }

    this.artifactList.innerHTML = filtered.map((artifact) => `
      <button class="artifact-item ${artifact.id === this.activeArtifactId ? 'is-active' : ''}" type="button" data-artifact-id="${sanitizeHTML(artifact.id)}">
        <strong>${sanitizeHTML(this.getArtifactIcon(artifact.type))} ${sanitizeHTML(artifact.title)}</strong>
        <small>${sanitizeHTML(this.getArtifactTypeLabel(artifact.type))} · ${sanitizeHTML(formatDateTime(artifact.createdAt))}</small>
      </button>
    `).join('');
  }

  getWorkbenchItems() {
    if (this.activeWorkbenchTab === 'files') {
      return this.artifacts.filter((artifact) => artifact.type === 'file');
    }
    if (this.activeWorkbenchTab === 'sources') {
      return this.artifacts.filter((artifact) => artifact.type === 'source' || artifact.contexts?.length);
    }
    if (this.activeWorkbenchTab === 'memory') {
      return this.artifacts.filter((artifact) => artifact.type !== 'file' && artifact.type !== 'source').slice(0, 12);
    }
    return this.artifacts.filter((artifact) => artifact.type !== 'file' && artifact.type !== 'source');
  }

  selectArtifact(id) {
    this.activeArtifactId = id;
    this.renderArtifacts();
    this.renderArtifactDetail();
    this.togglePanel('workbench', true);
  }

  renderArtifactDetail() {
    const artifact = this.artifacts.find((item) => item.id === this.activeArtifactId)
      || this.getWorkbenchItems()[0]
      || null;

    if (!artifact) {
      this.artifactDetail.innerHTML = `
        <div class="empty-artifact">
          <span aria-hidden="true">◇</span>
          <h3>아직 결과물이 없습니다</h3>
          <p>긴 답변, 표, 문서, 이미지를 만들면 여기에 저장됩니다.</p>
        </div>
      `;
      return;
    }

    this.activeArtifactId = artifact.id;
    const safeContent = sanitizeHTML(artifact.content || '').replace(/\n/g, '<br>');
    const image = artifact.imageUrl ? `<img class="artifact-image" src="${sanitizeHTML(artifact.imageUrl)}" alt="${sanitizeHTML(artifact.title)}">` : '';

    this.artifactDetail.innerHTML = `
      <div class="artifact-detail__header">
        <div class="artifact-detail__meta">
          <span class="badge">${sanitizeHTML(this.getArtifactTypeLabel(artifact.type))}</span>
          <span class="badge">${sanitizeHTML(formatDateTime(artifact.createdAt))}</span>
        </div>
        <h3>${sanitizeHTML(artifact.title)}</h3>
        ${artifact.source ? `<small>Source: ${sanitizeHTML(artifact.source)}</small>` : ''}
      </div>
      <div class="artifact-detail__actions">
        <button class="artifact-action" type="button" data-artifact-action="copy" data-artifact-id="${sanitizeHTML(artifact.id)}">복사</button>
        <button class="artifact-action" type="button" data-artifact-action="download" data-artifact-id="${sanitizeHTML(artifact.id)}">다운로드</button>
        <button class="artifact-action" type="button" data-artifact-action="insert" data-artifact-id="${sanitizeHTML(artifact.id)}">대화에 삽입</button>
        <button class="artifact-action" type="button" data-artifact-action="delete" data-artifact-id="${sanitizeHTML(artifact.id)}">삭제</button>
      </div>
      ${image}
      <div class="artifact-content">${safeContent || '<span class="empty-list">본문 없음</span>'}</div>
    `;
  }

  async handleArtifactAction(event) {
    const button = event.target.closest('[data-artifact-action]');
    if (!button) return;

    const artifact = this.artifacts.find((item) => item.id === button.dataset.artifactId);
    if (!artifact) return;

    const action = button.dataset.artifactAction;
    const text = artifact.imageUrl ? `${artifact.title}\n${artifact.imageUrl}\n\n${artifact.content}` : artifact.content;

    if (action === 'copy') {
      await copyToClipboard(text || artifact.title);
      this.toast('결과물을 복사했습니다.');
    }

    if (action === 'download') {
      const ext = artifact.imageUrl ? 'txt' : 'md';
      downloadTextFile(`${artifact.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 48) || 'pera-artifact'}.${ext}`, text || artifact.title);
    }

    if (action === 'insert') {
      this.chatInput.value = `${this.chatInput.value ? `${this.chatInput.value}\n\n` : ''}${artifact.content || artifact.title}`;
      this.handleInputChange();
      this.chatInput.focus();
      this.closeMobilePanels();
    }

    if (action === 'delete') {
      this.artifacts = this.artifacts.filter((item) => item.id !== artifact.id);
      this.activeArtifactId = this.artifacts[0]?.id || null;
      writeJsonStorage(STORAGE_KEYS.artifacts, this.artifacts);
      this.renderArtifacts();
      this.renderArtifactDetail();
      this.toast('결과물을 삭제했습니다.');
    }
  }

  setWorkbenchTab(tab = 'artifacts') {
    this.activeWorkbenchTab = tab;
    this.workbenchTabs.forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });

    const first = this.getWorkbenchItems()[0];
    this.activeArtifactId = first?.id || null;
    this.renderArtifacts();
    this.renderArtifactDetail();
  }

  getArtifactIcon(type) {
    return {
      document: '문서',
      table: '표',
      quiz: '퀴즈',
      code: '코드',
      image: '이미지',
      file: '파일',
      source: '소스',
    }[type] || '결과';
  }

  getArtifactTypeLabel(type) {
    return {
      document: '문서',
      table: '표',
      quiz: '퀴즈',
      code: '코드',
      image: '이미지',
      file: '파일',
      source: '소스',
    }[type] || '결과물';
  }

  saveConversation(userMessage, assistantText, mode) {
    const item = {
      id: createId('conversation'),
      title: inferTitle(userMessage || assistantText),
      subtitle: `${getModeLabel(mode)} · ${formatDateTime(Date.now())}`,
      mode,
      updatedAt: Date.now(),
    };

    this.conversations = [
      item,
      ...this.conversations.filter((conversation) => conversation.title !== item.title),
    ].slice(0, MAX_HISTORY);

    writeJsonStorage(STORAGE_KEYS.conversations, this.conversations);
    this.renderHistory();
  }

  renderHistory() {
    if (!this.conversations.length) {
      this.historyList.innerHTML = '<div class="empty-history">아직 저장된 작업이 없습니다.</div>';
      return;
    }

    this.historyList.innerHTML = this.conversations.map((conversation) => `
      <button class="history-item" type="button" data-history-id="${sanitizeHTML(conversation.id)}">
        <strong>${sanitizeHTML(conversation.title)}</strong>
        <small>${sanitizeHTML(conversation.subtitle)}</small>
      </button>
    `).join('');

    this.historyList.querySelectorAll('[data-history-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const conversation = this.conversations.find((item) => item.id === button.dataset.historyId);
        if (conversation) {
          this.setMode(conversation.mode);
          this.chatInput.value = conversation.title;
          this.handleInputChange();
          this.chatInput.focus();
          this.closeMobilePanels();
        }
      });
    });
  }

  clearHistory() {
    this.conversations = [];
    writeJsonStorage(STORAGE_KEYS.conversations, this.conversations);
    this.renderHistory();
    this.toast('최근 작업 목록을 정리했습니다.');
  }

  startNewConversation() {
    this.chatManager.reset();
    this.sessionId = generateSessionId();
    this.contextItems = [];
    this.chatMessages.innerHTML = '';
    this.chatInput.value = '';
    this.setMode('chat');
    this.renderContextShelf();
    this.handleInputChange();
    this.updateEmptyState();
    this.closeMobilePanels();
    this.chatInput.focus();
    this.toast('새 작업을 시작합니다.');
  }

  openSettings() {
    this.settingsModal.hidden = false;
    requestAnimationFrame(() => this.personaPreset.focus());
  }

  closeSettings() {
    this.settingsModal.hidden = true;
    this.settingsButton.focus();
  }

  saveSettings() {
    this.settings = {
      preset: this.personaPreset.value,
      depth: this.answerDepth.value,
      custom: this.personaInput.value.trim(),
    };
    writeJsonStorage(STORAGE_KEYS.settings, this.settings);
    this.closeSettings();
    this.toast('응답 스타일을 저장했습니다.');
  }

  resetSettings() {
    this.settings = { preset: 'friendly', depth: 'balanced', custom: '' };
    this.initializeSettings();
    writeJsonStorage(STORAGE_KEYS.settings, this.settings);
    this.toast('설정을 초기화했습니다.');
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEYS.theme, next);
  }

  togglePanel(panel, open) {
    if (panel === 'nav') {
      document.body.classList.toggle('nav-open', open);
      if (open) document.body.classList.remove('workbench-open');
    }

    if (panel === 'workbench') {
      document.body.classList.toggle('workbench-open', open);
      if (open) document.body.classList.remove('nav-open');
    }

    const isAnyOpen = document.body.classList.contains('nav-open') || document.body.classList.contains('workbench-open');
    this.mobileScrim.hidden = !isAnyOpen;
  }

  closeMobilePanels() {
    document.body.classList.remove('nav-open', 'workbench-open');
    this.mobileScrim.hidden = true;
  }

  toast(message, type = 'default') {
    const item = document.createElement('div');
    item.className = `toast ${type === 'error' ? 'toast--error' : ''}`;
    item.textContent = message;
    this.toastStack.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(8px)';
      setTimeout(() => item.remove(), 180);
    }, 2800);
  }
}

if (globalThis.pdfjsLib) {
  globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
} else {
  window.addEventListener('load', () => {
    if (globalThis.pdfjsLib) {
      globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  window.peraApp = new PeraStudioApp();
});
