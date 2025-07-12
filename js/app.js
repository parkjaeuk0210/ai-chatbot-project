// Main application module
import { ChatManager } from './chat.js';
import { generateSessionId, sanitizeHTML } from './utils.js';

class FeraApp {
    constructor() {
        this.chatManager = new ChatManager();
        this.sessionId = generateSessionId();
        this.currentPersona = localStorage.getItem('feraPersona') || this.defaultPersona;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeTheme();
        this.initializeMobile();
    }

    get defaultPersona() {
        return "이름은 FERA. 차분하고 전문적, 높은 성실성과 신뢰성. 평범한 젊은 한국인의 말투. 높은 창의성과 즐거운 상호작용 중심의 대화를 해드릴게요.";
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
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
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

        // Send message
        await this.chatManager.sendMessage(
            '/api/chat-secure', // Use secure API endpoint
            message,
            url,
            this.currentPersona,
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