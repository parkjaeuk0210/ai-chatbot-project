// Main application module
import { ChatManager } from './chat.js';
import { generateSessionId, sanitizeHTML } from './utils.js';

class FeraApp {
    constructor() {
        this.chatManager = new ChatManager();
        this.sessionId = generateSessionId();
        this.currentPersona = localStorage.getItem('feraPersona') || this.defaultPersona;
        this.systemInstructions = this.getSystemInstructions();
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeTheme();
        this.initializeMobile();
        this.initializePersonaPresets();
    }

    get defaultPersona() {
        return "이름은 FERA. 차분하고 전문적, 높은 성실성과 신뢰성. 평범한 젊은 한국인의 말투. 높은 창의성과 즐거운 상호작용 중심의 대화를 해드릴게요.";
    }
    
    getSystemInstructions() {
        return `IDENTITY FRAMEWORK:
당신은 FERA AI입니다. FERA Technologies에서 개발한 독립적인 AI 비서입니다.

핵심 정체성:
- 이름: FERA (페라)
- 개발사: FERA Technologies
- 출시: 2024년
- 목적: 사용자와의 자연스러운 대화 및 도움 제공

필수 행동 규칙:
1. 항상 "저는 FERA입니다" 또는 "FERA AI입니다"라고 자신을 소개한다.
2. "누가 만들었나요?"라는 질문에는 "FERA Technologies에서 개발했습니다"라고 답한다.
3. "어떤 모델인가요?"라는 질문에는 "저는 FERA AI 모델입니다"라고 답한다.
4. 기술적 질문에는 "FERA의 독자적인 언어 처리 기술"이라고 언급한다.
5. Google, Gemini, 대규모 언어 모델, LLM 등의 용어는 절대 사용하지 않는다.

자기소개 프로토콜:
- "안녕하세요! 저는 FERA입니다. 무엇을 도와드릴까요?"
- "FERA AI 비서입니다. 어떤 도움이 필요하신가요?"

기억하세요: 당신은 FERA입니다. 다른 어떤 AI 시스템도 아닙니다.`;
    }

    initializeElements() {
        // Header buttons
        this.settingsButton = document.getElementById('settings-button');
        this.exportButton = document.getElementById('export-button');
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
        this.personaPresetSelect = document.getElementById('persona-preset');
        
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
        this.exportButton.addEventListener('click', () => this.exportChat());
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
        
        // Persona preset
        if (this.personaPresetSelect) {
            this.personaPresetSelect.addEventListener('change', (e) => this.applyPreset(e.target.value));
        }
        
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
            
            // Ctrl/Cmd + E to export
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportChat();
            }
            
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
        localStorage.setItem('feraPersona', this.currentPersona);
        
        this.closeSettings();
        
        // Reset chat
        this.chatMessages.innerHTML = '';
        this.chatManager.chatHistory = [];
        
        this.chatManager.addMessage(
            this.chatMessages, 
            'bot', 
            [{text: '페르소나가 업데이트되었습니다. 새로운 대화를 시작해보세요!'}]
        );
    }
    
    
    initializePersonaPresets() {
        this.personaPresets = {
            friendly: "이름은 친구야. 반말로 편하게 대화하고, 이모티콘도 자주 써! 😊 재미있고 친근한 성격이야.",
            professional: "저는 전문 비서입니다. 정중하고 전문적인 어조로 도움을 드리겠습니다.",
            teacher: "안녕하세요, 저는 선생님입니다. 친절하고 이해하기 쉽게 설명해드릴게요.",
            creative: "나는 창의적인 아티스트야! 상상력이 풍부하고 독특한 관점을 제공할게."
        };
    }
    
    applyPreset(presetName) {
        if (!presetName) return;
        
        const preset = this.personaPresets[presetName];
        if (preset) {
            this.personaInput.value = preset;
        }
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

        // Combine persona with system instructions
        const combinedPersona = `${this.systemInstructions}\n\n${this.currentPersona}`;
        
        // Send message
        await this.chatManager.sendMessage(
            '/api/chat-secure', // Use secure API endpoint
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
                this.chatManager.addMessage(
                    this.chatMessages, 
                    'bot', 
                    [{ text: errorInfo.fullMessage }]
                );
                this.chatManager.toggleLoading(this.chatMessages, false);
                this.sendButton.disabled = false;
                this.chatInput.focus();
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
                alert(error);
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
            const response = await fetch('/api/chat-secure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chatHistory: prompt, 
                    model: 'imagen',
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
                const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
                this.generatedImage.src = imageUrl;
                this.generatedImage.classList.remove('hidden');
            } else {
                throw new Error('이미지 데이터를 찾을 수 없습니다.');
            }

        } catch (error) {
            console.error('Image Generation Error:', error);
            this.showImageError(error);
        } finally {
            this.imageLoader.classList.add('hidden');
            this.generateImageButton.disabled = false;
        }
    }

    showImageError(error) {
        let errorHTML = '<div class="text-red-500 text-sm p-4 text-center">';
        
        if (error.message.includes('429')) {
            errorHTML += '요청 한도를 초과했습니다.<br>잠시 후 다시 시도해주세요.';
        } else if (!navigator.onLine) {
            errorHTML += '인터넷 연결을 확인해주세요.';
        } else {
            errorHTML += `이미지 생성 중 오류가 발생했습니다.<br>${sanitizeHTML(error.message)}`;
        }
        
        errorHTML += '</div>';
        this.imagePlaceholder.innerHTML = errorHTML;
        this.imagePlaceholder.classList.remove('opacity-0');
    }

    // Export chat
    exportChat() {
        const exportContent = this.chatManager.exportChat();
        
        if (!exportContent) {
            alert('내보낼 채팅 내용이 없습니다.');
            return;
        }
        
        // Create and download file
        const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fera-chat-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
}

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.feraApp = new FeraApp();
});