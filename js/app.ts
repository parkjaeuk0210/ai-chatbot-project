// Main application module - TypeScript version
import { ChatManager } from './chat.js';
import { apiService } from './services/api.service.js';
import { storageService } from './services/storage.service.js';
import { generateSessionId, throttle } from './utils.js';
import type { AppSettings, BeforeInstallPromptEvent, ChatMessage } from '../types';

export class FeraApp {
  private chatManager: ChatManager;
  private sessionId: string;
  private currentLanguage: string = 'ko';
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private resizeHandler: (() => void) | null = null;
  private lastMessage: { text: string; file: any } | null = null;

  // DOM elements
  private chatMessages!: HTMLElement;
  private chatInput!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private fileInput!: HTMLInputElement;
  private newChatButton!: HTMLElement;
  private installButton!: HTMLElement;
  private languageSelector!: HTMLSelectElement;
  private filePreviewContainer!: HTMLElement;
  private previewImage!: HTMLImageElement;
  private removeFileButton!: HTMLElement;

  constructor() {
    this.chatManager = new ChatManager();
    this.sessionId = this.initializeSession();
    this.initializeApp();
  }


  /**
   * Initialize session
   */
  private initializeSession(): string {
    const savedSessionId = storageService.loadSessionId();
    if (savedSessionId) {
      return savedSessionId;
    }
    
    const newSessionId = generateSessionId();
    storageService.saveSessionId(newSessionId);
    return newSessionId;
  }

  /**
   * Initialize the application
   */
  private async initializeApp(): Promise<void> {
    try {
      // Load saved settings
      const settings = storageService.loadSettings();
      if (settings) {
        this.applySettings(settings);
      }

      // Load saved API key
      const apiKey = storageService.loadApiKey();
      if (apiKey) {
        apiService.updateConfig({ apiKey });
      }

      // Initialize DOM elements
      this.initializeDOMElements();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize chat manager
      this.chatManager.initializeVirtualization(this.chatMessages);
      
      // Load chat history
      this.loadChatHistory();
      
      // Setup PWA
      this.setupPWA();
      
      // Setup mobile optimizations
      this.setupMobileOptimizations();
      
      // Initialize i18n if available
      if (window.i18n) {
        await window.i18n.initialize();
        window.i18n.setLanguage(this.currentLanguage);
      }
      
      console.log('FeraApp initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to initialize application');
    }
  }

  /**
   * Initialize DOM elements
   */
  private initializeDOMElements(): void {
    // Required elements
    const requiredElements = {
      chatMessages: document.getElementById('chatMessages'),
      chatInput: document.getElementById('chatInput') as HTMLTextAreaElement,
      sendButton: document.getElementById('sendButton') as HTMLButtonElement,
      fileInput: document.getElementById('fileInput') as HTMLInputElement,
      newChatButton: document.getElementById('newChatButton'),
    };

    // Check all required elements exist
    for (const [name, element] of Object.entries(requiredElements)) {
      if (!element) {
        throw new Error(`Required element not found: ${name}`);
      }
    }

    // Assign elements
    this.chatMessages = requiredElements.chatMessages!;
    this.chatInput = requiredElements.chatInput!;
    this.sendButton = requiredElements.sendButton!;
    this.fileInput = requiredElements.fileInput!;
    this.newChatButton = requiredElements.newChatButton!;

    // Optional elements
    this.installButton = document.getElementById('installButton') || document.createElement('div');
    this.languageSelector = document.getElementById('languageSelector') as HTMLSelectElement || document.createElement('select');
    this.filePreviewContainer = document.getElementById('filePreviewContainer') || document.createElement('div');
    this.previewImage = document.getElementById('previewImage') as HTMLImageElement || document.createElement('img');
    this.removeFileButton = document.getElementById('removeFileButton') || document.createElement('button');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Chat input events
    this.chatInput.addEventListener('keydown', (e) => this.handleChatKeyDown(e));
    this.chatInput.addEventListener('input', () => this.adjustTextareaHeight());
    
    // Button events
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.newChatButton.addEventListener('click', () => this.startNewChat());
    this.removeFileButton.addEventListener('click', () => this.removePreview());
    
    // File input
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    
    // Language selector
    this.languageSelector.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.changeLanguage(target.value);
    });
    
    // Window events
    window.addEventListener('beforeunload', () => this.saveState());
  }

  /**
   * Handle chat input keydown
   */
  private handleChatKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Adjust textarea height
   */
  private adjustTextareaHeight(): void {
    this.chatInput.style.height = 'auto';
    const maxHeight = window.innerHeight * 0.3;
    this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, maxHeight) + 'px';
  }

  /**
   * Send message
   */
  private async sendMessage(): Promise<void> {
    const message = this.chatInput.value.trim();
    if (!message && !this.chatManager.uploadedFile.data) return;
    
    // Save last message for retry
    this.lastMessage = {
      text: message,
      file: this.chatManager.uploadedFile
    };
    
    this.chatInput.value = '';
    this.adjustTextareaHeight();
    this.sendButton.disabled = true;
    
    try {
      // Add user message
      const userMessage: ChatMessage = {
        role: 'user',
        parts: [{ text: message }],
      };
      
      this.chatManager.addMessage(this.chatMessages, 'user', userMessage.parts);
      this.chatManager.toggleLoading(this.chatMessages, true);
      
      // Prepare request
      const request = {
        chatHistory: this.chatManager.getChatHistoryForAPI(),
        sessionId: this.sessionId,
        model: this.chatManager.uploadedFile.type === 'image' ? 'imagen' : undefined,
        persona: this.getSystemInstructions(),
      };
      
      // Send request
      const response = await apiService.sendChatRequest(request);
      
      // Handle response
      if (response.candidates && response.candidates.length > 0) {
        const botMessage = response.candidates[0].content;
        this.chatManager.addMessage(this.chatMessages, 'model', botMessage.parts);
      } else {
        throw new Error('No response from AI');
      }
      
    } catch (error: any) {
      this.handleError(error);
    } finally {
      this.chatManager.toggleLoading(this.chatMessages, false);
      this.sendButton.disabled = false;
      this.chatInput.focus();
      this.removePreview();
      this.saveState();
    }
  }

  /**
   * Retry last message
   */
  retryLastMessage(): void {
    if (this.lastMessage) {
      this.chatInput.value = this.lastMessage.text;
      this.chatManager.uploadedFile = this.lastMessage.file;
      this.sendMessage();
    }
  }

  /**
   * Handle file selection
   */
  private async handleFileSelect(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    
    this.removePreview();
    
    try {
      await this.chatManager.handleFileSelect(
        file,
        (preview) => this.showFilePreview(preview),
        (error) => this.showError(error)
      );
    } catch (error) {
      this.showError('Failed to process file');
    }
  }

  /**
   * Show file preview
   */
  private showFilePreview(preview: any): void {
    if (preview.type === 'image') {
      this.previewImage.src = preview.src;
      this.previewImage.classList.remove('hidden');
    }
    
    this.filePreviewContainer.classList.add('visible');
  }

  /**
   * Remove file preview
   */
  private removePreview(): void {
    this.filePreviewContainer.classList.remove('visible');
    this.previewImage.classList.add('hidden');
    this.previewImage.src = '';
    this.fileInput.value = '';
    this.chatManager.clearUploadedFile();
  }

  /**
   * Start new chat
   */
  private startNewChat(): void {
    if (confirm(window.i18n?.t('chat.newChatConfirm') || 'Start a new chat?')) {
      this.chatManager.clearChat();
      this.chatMessages.innerHTML = '';
      this.sessionId = generateSessionId();
      storageService.saveSessionId(this.sessionId);
      this.removePreview();
      this.saveState();
    }
  }

  /**
   * Change language
   */
  private changeLanguage(language: string): void {
    this.currentLanguage = language;
    if (window.i18n) {
      window.i18n.setLanguage(language);
    }
    
    const settings: AppSettings = {
      language,
    };
    storageService.saveSettings(settings);
  }

  /**
   * Apply settings
   */
  private applySettings(settings: AppSettings): void {
    if (settings.language) {
      this.currentLanguage = settings.language;
      if (this.languageSelector) {
        this.languageSelector.value = settings.language;
      }
    }
  }

  /**
   * Get system instructions
   */
  private getSystemInstructions(): string {
    return `You are FERA AI, a helpful assistant created by Online Studio.
Always respond in the user's language.
Be concise, helpful, and friendly.`;
  }

  /**
   * Save application state
   */
  private saveState(): void {
    storageService.saveChatHistory(this.chatManager.chatHistory);
    storageService.updateLastActive();
  }

  /**
   * Load chat history
   */
  private loadChatHistory(): void {
    const history = storageService.loadChatHistory();
    if (history.length > 0) {
      this.chatManager.chatHistory = history;
      history.forEach(msg => {
        this.chatManager.addMessage(this.chatMessages, msg.role, msg.parts);
      });
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    console.error('Chat error:', error);
    const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
    this.chatManager.addMessage(
      this.chatMessages,
      'model',
      [{ text: `Error: ${errorMessage}` }]
    );
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    console.error(message);
    // You can implement a toast notification here
  }

  /**
   * Setup PWA
   */
  private setupPWA(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.installButton.style.display = 'block';
    });
    
    this.installButton.addEventListener('click', () => this.installPWA());
  }

  /**
   * Install PWA
   */
  private async installPWA(): Promise<void> {
    if (!this.deferredPrompt) return;
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    this.deferredPrompt = null;
    this.installButton.style.display = 'none';
  }

  /**
   * Setup mobile optimizations
   */
  private setupMobileOptimizations(): void {
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', () => {
        this.handleViewportResize();
      });
    }
    
    this.detectVirtualKeyboard();
  }

  /**
   * Handle viewport resize
   */
  private handleViewportResize(): void {
    // Handle viewport changes for mobile
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }

  /**
   * Detect virtual keyboard
   */
  private detectVirtualKeyboard(): void {
    const initialHeight = window.innerHeight;
    
    const handleResize = throttle(() => {
      const currentHeight = window.innerHeight;
      const keyboardHeight = initialHeight - currentHeight;
      
      if (keyboardHeight > 100) {
        document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      } else {
        document.documentElement.style.setProperty('--keyboard-height', '0px');
      }
    }, 100);
    
    window.addEventListener('resize', handleResize);
    this.resizeHandler = handleResize;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.chatManager.destroy();
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.feraApp = new FeraApp();
  });
} else {
  window.feraApp = new FeraApp();
}

// Type augmentation for window
declare global {
  interface Window {
    feraApp: FeraApp;
    i18n?: any;
  }
}