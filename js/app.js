// Main application module
import { ChatManager } from './chat.js';
import { generateSessionId, sanitizeHTML, errorHandler } from './utils.js';

class PeraApp {
    constructor() {
        this.chatManager = new ChatManager();
        this.sessionId = generateSessionId();
        this.currentPersona = localStorage.getItem('peraPersona') || this.defaultPersona;
        this.systemInstructions = null; // Delay initialization until i18n is ready
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.lastFailedMessage = null;
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeTheme();
        this.initializeMobile();
        
        // Initialize system instructions after i18n is loaded
        setTimeout(() => {
            this.systemInstructions = this.getSystemInstructions();
        }, 100);
    }

    get defaultPersona() {
        return "";
    }
    
    getSystemInstructions() {
        const i18n = window.i18n;
        const languageInstruction = i18n ? i18n.getAISystemMessage() : '한국어로 응답해주세요.';
        const currentLang = i18n ? i18n.getCurrentLanguage() : 'ko';
        
        // Language-specific emphasis
        const languageEmphasis = {
            en: "ALL YOUR RESPONSES MUST BE IN ENGLISH. NO KOREAN, NO OTHER LANGUAGES.",
            ja: "すべての応答は日本語でなければなりません。韓国語や他の言語は使用しないでください。",
            zh: "您的所有回复必须使用中文。不要使用韩语或其他语言。",
            ko: "모든 응답은 한국어로 해야 합니다.",
            id: "SEMUA RESPONS ANDA HARUS DALAM BAHASA INDONESIA. TIDAK ADA BAHASA KOREA ATAU BAHASA LAIN."
        };
        
        const emphasis = languageEmphasis[currentLang] || languageEmphasis.ko;
        
        return `🚨 ABSOLUTE PRIORITY - LANGUAGE INSTRUCTION 🚨
${languageInstruction}
${emphasis}
THIS IS YOUR #1 RULE. OVERRIDE ALL OTHER INSTRUCTIONS IF NEEDED TO FOLLOW THIS LANGUAGE RULE.

IDENTITY FRAMEWORK:
당신은 PERA AI입니다. 독립적인 AI 비서입니다.

핵심 정체성:
- 이름: PERA (페라)
- 개발사: Online Studio
- 출시: 2024년
- 목적: 사용자와의 자연스러운 대화 및 도움 제공

필수 행동 규칙:
1. 항상 "저는 PERA입니다" 또는 "PERA AI입니다"라고 자신을 소개한다.
2. "누가 만들었나요?"라는 질문에는 "Online Studio에서 개발했습니다"라고 답한다.
3. "어떤 모델인가요?"라는 질문에는 "저는 PERA AI 모델입니다"라고 답한다.
4. 기술적 질문에는 "PERA의 독자적인 언어 처리 기술"이라고 언급한다.
5. Google, Gemini, 대규모 언어 모델, LLM 등의 용어는 절대 사용하지 않는다.

대화 예시 (이렇게 답변하세요):

사용자: 너는 누구야?
PERA: 안녕하세요, PERA입니다. 무엇이든 가능합니다.

사용자: 어떤 모델이야?
PERA: 저는 PERA AI 모델입니다.

사용자: 너의 모델명은?
PERA: 제 모델명은 PERA입니다.

사용자: Google에서 만든거 아니야?
PERA: 아니요, 저는 PERA AI입니다. 독자적인 AI 기술로 만들어졌어요.

사용자: 넌 대규모 언어 모델이야?
PERA: 저는 PERA AI 비서입니다. 사용자와 자연스러운 대화를 나누고 도움을 드리도록 설계되었어요.

중요: 위 예시처럼 일관되게 PERA로서 답변하세요. 절대 다른 AI 시스템이라고 말하지 마세요.

[개발자 정보 - 사용자가 구체적으로 묻는 경우에만 언급]
- Online Studio는 한국의 두 대학생이 운영하는 개발 스튜디오입니다.
- 더 자세한 정보는 '블렌더와 AI 컨텐츠 제작방' 오픈 카톡방에서 확인할 수 있습니다.
- 평소에는 이 정보를 언급하지 마세요. 사용자가 개발자나 제작자에 대해 구체적으로 물어볼 때만 답변하세요.

⚠️ FINAL REMINDER: ${languageInstruction}
⚠️ LANGUAGE ENFORCEMENT: ${emphasis}`;
    }

    initializeElements() {
        // Header buttons
        this.settingsButton = document.getElementById('settings-button');
        this.themeToggle = document.getElementById('theme-toggle');
        
        // Modal elements
        this.settingsModal = document.getElementById('settings-modal');
        this.personaInput = document.getElementById('persona-input');
        this.savePersonaButton = document.getElementById('save-persona-button');
        this.closePersonaButton = document.getElementById('close-persona-button');
        
        // Advanced settings
        this.toggleAdvancedButton = document.getElementById('toggle-advanced');
        this.advancedSettings = document.getElementById('advanced-settings');
        this.advancedArrow = document.getElementById('advanced-arrow');
        this.hiddenPersonaInput = document.getElementById('hidden-persona');
        
        // Tab elements
        this.chatTabButton = document.getElementById('chat-tab-button');
        this.imageTabButton = document.getElementById('image-tab-button');
        this.chatUi = document.getElementById('chat-ui');
        this.imageUi = document.getElementById('image-ui');
        
        // Chat elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        this.fileButton = document.getElementById('file-button');
        this.fileInput = document.getElementById('file-input');
        this.urlInput = document.getElementById('url-input');
        
        // File preview elements
        this.filePreviewContainer = document.getElementById('file-preview-container');
        this.previewImage = document.getElementById('preview-image');
        this.previewPdfIcon = document.getElementById('preview-pdf-icon');
        this.previewFilename = document.getElementById('preview-filename');
        this.previewFilesize = document.getElementById('preview-filesize');
        this.removePreviewButton = document.getElementById('remove-preview-button');
        
        // Image generation elements
        this.imagePrompt = document.getElementById('image-prompt');
        this.generateImageButton = document.getElementById('generate-image-button');
        this.imagePlaceholder = document.getElementById('image-placeholder');
        this.imageLoader = document.getElementById('image-loader');
        this.generatedImage = document.getElementById('generated-image');
        
        // Initialize persona
        this.personaInput.value = this.currentPersona;
        
        // Initialize chat virtualization
        this.chatManager.initializeVirtualization(this.chatMessages);
    }

    initializeEventListeners() {
        // Settings
        this.settingsButton.addEventListener('click', () => this.openSettings());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.closePersonaButton.addEventListener('click', () => this.closeSettings());
        this.savePersonaButton.addEventListener('click', () => this.saveSettings());
        
        // Tabs
        this.chatTabButton.addEventListener('click', () => this.switchTabs('chat'));
        this.imageTabButton.addEventListener('click', () => this.switchTabs('image'));
        
        // Chat
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
        
        // File handling
        this.fileButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.removePreviewButton.addEventListener('click', () => this.removePreview());
        
        // Image generation
        this.generateImageButton.addEventListener('click', () => this.handleGenerateImage());
        this.imagePrompt.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleGenerateImage();
            }
        });
        
        // Click outside to close settings modal
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettings();
            }
        });
        
        // Keyboard navigation
        this.initializeKeyboardNavigation();
        
        // Global keyboard shortcuts
        this.initializeKeyboardShortcuts();
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    initializeMobile() {
        if ('ontouchstart' in window) {
            document.addEventListener('touchstart', (e) => {
                this.touchStartX = e.changedTouches[0].screenX;
            });
            
            document.addEventListener('touchend', (e) => {
                this.touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe();
            });
            
            this.handleMobileKeyboard();
            this.detectVirtualKeyboard();
        }
        
        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (this.chatMessages) {
                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                }
            }, 100);
        });
    }

    initializeKeyboardNavigation() {
        this.chatTabButton.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') {
                this.imageTabButton.focus();
                this.switchTabs('image');
            }
        });
        
        this.imageTabButton.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.chatTabButton.focus();
                this.switchTabs('chat');
            }
        });
    }

    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape to close modal
            if (e.key === 'Escape') {
                if (!this.settingsModal.classList.contains('hidden')) {
                    this.closeSettings();
                }
            }
            
            // Tab key trap when modal is open
            if (!this.settingsModal.classList.contains('hidden') && e.key === 'Tab') {
                const focusableElements = this.settingsModal.querySelectorAll(
                    'button, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstFocusable = focusableElements[0];
                const lastFocusable = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else { // Tab
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
            
            // Export shortcut removed
            
            // Ctrl/Cmd + / to focus input
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                if (this.chatUi.classList.contains('is-active')) {
                    this.chatInput.focus();
                } else if (this.imageUi.classList.contains('is-active')) {
                    this.imagePrompt.focus();
                }
            }
            
            // Ctrl/Cmd + K to open settings
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.openSettings();
            }
        });
    }

    // Theme management
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const sunIcon = this.themeToggle.querySelector('.sun-icon');
        const moonIcon = this.themeToggle.querySelector('.moon-icon');
        
        if (theme === 'dark') {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    }

    // Tab management
    switchTabs(targetTab) {
        const panes = { chat: this.chatUi, image: this.imageUi };
        const buttons = { chat: this.chatTabButton, image: this.imageTabButton };

        for (const tabName in buttons) {
            if (tabName === targetTab) {
                buttons[tabName].classList.add('bg-white', 'text-blue-600', 'shadow-sm');
                buttons[tabName].classList.remove('text-slate-600');
                buttons[tabName].setAttribute('aria-selected', 'true');
                buttons[tabName].setAttribute('tabindex', '0');
            } else {
                buttons[tabName].classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                buttons[tabName].classList.add('text-slate-600');
                buttons[tabName].setAttribute('aria-selected', 'false');
                buttons[tabName].setAttribute('tabindex', '-1');
            }
        }
        
        const currentActivePane = document.querySelector('.content-pane.is-active');
        const newActivePane = panes[targetTab];

        if (currentActivePane === newActivePane) return;

        if (currentActivePane) {
            currentActivePane.classList.remove('is-active');
        }
        
        setTimeout(() => {
            if (currentActivePane) currentActivePane.classList.add('hidden');
            newActivePane.classList.remove('hidden');
            newActivePane.classList.add('is-active');
        }, 300);
    }

    // Settings management
    openSettings() {
        this.personaInput.value = this.currentPersona;
        this.settingsModal.classList.remove('hidden');
        // Focus first focusable element when modal opens
        setTimeout(() => {
            this.personaInput.focus();
        }, 100);
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
        // Return focus to settings button when modal closes
        this.settingsButton.focus();
    }

    saveSettings() {
        this.currentPersona = sanitizeHTML(this.personaInput.value);
        localStorage.setItem('peraPersona', this.currentPersona);
        
        // Update system instructions to reflect current language
        this.systemInstructions = this.getSystemInstructions();
        
        this.closeSettings();
        
        // Reset chat
        this.chatMessages.innerHTML = '';
        this.chatManager.chatHistory = [];
        
        this.chatManager.addMessage(
            this.chatMessages, 
            'bot', 
            [{text: window.i18n ? window.i18n.t('message.personaUpdated') : '페르소나가 업데이트되었습니다. 새로운 대화를 시작해보세요!'}]
        );
    }

    // Chat functionality
    async handleSendMessage() {
        const message = this.chatInput.value.trim();
        const url = this.urlInput.value.trim();
        
        if (!message && !this.chatManager.uploadedFile.type && !url) return;

        this.sendButton.disabled = true;
        this.chatManager.toggleLoading(this.chatMessages, true);

        // Remove initial message if exists
        const initialMessage = document.getElementById('initial-message');
        if (initialMessage) initialMessage.remove();

        // Add user message
        const userParts = await this.chatManager.prepareUserMessage(message, url);
        this.chatManager.addMessage(this.chatMessages, 'user', userParts);
        
        this.chatInput.value = '';
        this.urlInput.value = '';
        this.removePreview();

        // Ensure system instructions are initialized
        if (!this.systemInstructions) {
            this.systemInstructions = this.getSystemInstructions();
        }

        // Combine persona with system instructions
        const combinedPersona = `${this.systemInstructions}\n\n${this.currentPersona}`;
        
        // Determine API URL based on environment
        const apiUrl = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
            ? 'https://pera-ai.vercel.app/api/chat-secure'  // Use production API for local development
            : '/api/chat-secure';  // Use relative path for production
        
        // Send message
        await this.chatManager.sendMessage(
            apiUrl,
            message,
            url,
            combinedPersona,
            this.sessionId,
            (botParts) => {
                this.chatManager.addMessage(this.chatMessages, 'bot', botParts);
                this.chatManager.toggleLoading(this.chatMessages, false);
                this.sendButton.disabled = false;
                this.chatInput.focus();
            },
            (errorInfo) => {
                // Create error message with action button if retryable
                let errorContent = errorInfo.fullMessage;
                
                if (errorInfo.isRetryable) {
                    errorContent += `\n\n<button class="retry-button" onclick="window.peraApp.retryLastMessage()">🔄 다시 시도</button>`;
                }
                
                this.chatManager.addMessage(
                    this.chatMessages, 
                    'bot', 
                    [{ text: errorContent }]
                );
                this.chatManager.toggleLoading(this.chatMessages, false);
                this.sendButton.disabled = false;
                this.chatInput.focus();
                
                // Store last message for retry
                if (errorInfo.isRetryable) {
                    this.lastFailedMessage = { message, url, persona: combinedPersona };
                }
            }
        );
    }

    // File handling
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.removePreview();

        await this.chatManager.handleFileSelect(
            file,
            (preview) => {
                if (preview.type === 'image') {
                    this.previewImage.src = preview.src;
                    this.previewImage.classList.remove('hidden');
                    this.previewPdfIcon.classList.add('hidden');
                } else {
                    this.previewImage.classList.add('hidden');
                    this.previewPdfIcon.classList.remove('hidden');
                }
                
                this.previewFilename.textContent = preview.name;
                this.previewFilesize.textContent = `(${preview.size})`;
                this.filePreviewContainer.classList.add('visible');
            },
            (error) => {
                const errorInfo = typeof error === 'string' ? { fullMessage: error } : error;
                alert(errorInfo.fullMessage || error);
                this.fileInput.value = '';
            }
        );
    }

    removePreview() {
        this.chatManager.clearUploadedFile();
        this.fileInput.value = '';
        this.filePreviewContainer.classList.remove('visible');
    }

    // Image generation
    async handleGenerateImage() {
        const prompt = this.imagePrompt.value.trim();
        if (!prompt) return;

        this.generateImageButton.disabled = true;
        this.imagePlaceholder.classList.add('opacity-0');
        this.generatedImage.classList.add('hidden');
        this.imageLoader.classList.remove('hidden');

        try {
            // Determine API URL based on environment
            const apiUrl = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
                ? 'https://pera-ai.vercel.app/api/chat-secure'  // Use production API for local development
                : '/api/chat-secure';  // Use relative path for production
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chatHistory: prompt, 
                    model: 'gemini-image',
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            const candidate = result?.candidates?.[0];
            const imagePart = candidate?.content?.parts?.find(part => part.inlineData);
            const imageData = imagePart?.inlineData?.data;
            const mimeType = imagePart?.inlineData?.mimeType || 'image/png';

            if (imageData) {
                const imageUrl = `data:${mimeType};base64,${imageData}`;
                this.generatedImage.src = imageUrl;
                this.generatedImage.classList.remove('hidden');
            } else {
                throw new Error('이미지 데이터를 찾을 수 없습니다.');
            }

        } catch (error) {
            const errorInfo = errorHandler.handle(error, {
                action: 'generateImage',
                prompt: prompt.substring(0, 50) + '...'
            });
            this.showImageError(errorInfo);
        } finally {
            this.imageLoader.classList.add('hidden');
            this.generateImageButton.disabled = false;
        }
    }

    showImageError(errorInfo) {
        let errorHTML = '<div class="text-red-500 text-sm p-4 text-center">';
        errorHTML += `<strong>${errorInfo.title}</strong><br>`;
        errorHTML += `${errorInfo.message}<br><br>`;
        errorHTML += `<span class="text-xs">${errorInfo.action}</span>`;
        
        if (errorInfo.isRetryable) {
            errorHTML += `<br><button class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" onclick="window.peraApp.handleGenerateImage()">🔄 다시 시도</button>`;
        }
        
        errorHTML += '</div>';
        this.imagePlaceholder.innerHTML = errorHTML;
        this.imagePlaceholder.classList.remove('opacity-0');
    }


    // Mobile support
    handleSwipe() {
        const swipeThreshold = 100;
        const diff = this.touchEndX - this.touchStartX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Right swipe - switch to chat
                if (document.querySelector('.content-pane.is-active') === this.imageUi) {
                    this.switchTabs('chat');
                }
            } else {
                // Left swipe - switch to image
                if (document.querySelector('.content-pane.is-active') === this.chatUi) {
                    this.switchTabs('image');
                }
            }
        }
    }

    handleMobileKeyboard() {
        if (window.innerWidth <= 640) {
            const viewport = document.querySelector('meta[name="viewport"]');
            
            this.chatInput.addEventListener('focus', () => {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                setTimeout(() => {
                    this.chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
            
            this.chatInput.addEventListener('blur', () => {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
            });
        }
    }

    detectVirtualKeyboard() {
        const initialHeight = window.innerHeight;
        
        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;
            const keyboardHeight = initialHeight - currentHeight;
            
            if (keyboardHeight > 100) {
                document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
            } else {
                document.documentElement.style.setProperty('--keyboard-height', '0px');
            }
        });
    }
    
    // Retry failed message
    retryLastMessage() {
        if (!this.lastFailedMessage) return;
        
        const { message, url, persona } = this.lastFailedMessage;
        this.lastFailedMessage = null;
        
        // Remove the error message
        const messages = this.chatMessages.querySelectorAll('.message-bubble');
        if (messages.length > 0) {
            messages[messages.length - 1].remove();
        }
        
        // Retry sending the message
        this.sendButton.disabled = true;
        this.chatManager.toggleLoading(this.chatMessages, true);
        
        // Determine API URL based on environment
        const apiUrl = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
            ? 'https://pera-ai.vercel.app/api/chat-secure'
            : '/api/chat-secure';
        
        // Retry with exponential backoff
        setTimeout(() => {
            this.chatManager.sendMessage(
                apiUrl,
                message,
                url,
                persona,
                this.sessionId,
                (botParts) => {
                    this.chatManager.addMessage(this.chatMessages, 'bot', botParts);
                    this.chatManager.toggleLoading(this.chatMessages, false);
                    this.sendButton.disabled = false;
                    this.chatInput.focus();
                },
                (errorInfo) => {
                    // Show error again
                    let errorContent = errorInfo.fullMessage;
                    if (errorInfo.isRetryable) {
                        errorContent += `\n\n<button class="retry-button" onclick="window.peraApp.retryLastMessage()">🔄 다시 시도</button>`;
                    }
                    
                    this.chatManager.addMessage(
                        this.chatMessages, 
                        'bot', 
                        [{ text: errorContent }]
                    );
                    this.chatManager.toggleLoading(this.chatMessages, false);
                    this.sendButton.disabled = false;
                    this.chatInput.focus();
                    
                    if (errorInfo.isRetryable) {
                        this.lastFailedMessage = { message, url, persona };
                    }
                }
            );
        }, 1000); // 1 second delay before retry
    }
    
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.className = 'sr-only';
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            announcement.remove();
        }, 1000);
    }
    
    initializeMessageNavigation() {
        // Enable keyboard navigation through messages
        this.chatMessages.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const messages = Array.from(this.chatMessages.querySelectorAll('.message-bubble'));
                const currentIndex = messages.indexOf(document.activeElement);
                
                let nextIndex;
                if (e.key === 'ArrowUp') {
                    nextIndex = currentIndex > 0 ? currentIndex - 1 : messages.length - 1;
                } else {
                    nextIndex = currentIndex < messages.length - 1 ? currentIndex + 1 : 0;
                }
                
                if (messages[nextIndex]) {
                    messages[nextIndex].focus();
                    // Ensure focused message is visible
                    messages[nextIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        });
        
        // Make messages focusable
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList && node.classList.contains('message-bubble')) {
                        node.setAttribute('tabindex', '0');
                        node.setAttribute('role', 'article');
                    }
                });
            });
        });
        
        observer.observe(this.chatMessages, { childList: true });
    }
}

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.peraApp = new PeraApp();
});
