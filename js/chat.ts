// Chat management module
import { generateSessionId, debounce, formatBytes } from './utils.js';
import { escapeHtml, createSafeTextElement, setSafeHtml } from './security.js';
import type { ChatMessage, UploadedFile, MessagePart } from '../types';

export class ChatManager {
    chatHistory: ChatMessage[] = [];
    uploadedFile: UploadedFile = { type: null, data: null, name: null, mimeType: null };
    private virtualScroller: VirtualScroller | null = null;
    private maxChatHistory: number = 100;
    private maxMessageLength: number = 50000;

    /**
     * Initialize virtual scrolling for performance
     */
    initializeVirtualization(container: HTMLElement): void {
        this.virtualScroller = new VirtualScroller(container);
    }

    /**
     * Add a message to chat
     */
    addMessage(container: HTMLElement, sender: 'user' | 'bot', parts: MessagePart[]): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-start gap-3 message-bubble';

        let content: string;
        if (sender === 'user') {
            wrapper.classList.add('justify-end');
            content = this.createUserMessageHTML(parts);
        } else {
            wrapper.classList.add('max-w-lg');
            content = this.createBotMessageHTML(parts);
        }

        setSafeHtml(wrapper, content);
        container.appendChild(wrapper);

        // Smooth scroll to bottom
        requestAnimationFrame(() => {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });

        // Add to history
        this.chatHistory.push({ role: sender === 'bot' ? 'model' : 'user', parts });
        
        // Trim history if too long
        if (this.chatHistory.length > this.maxChatHistory) {
            this.chatHistory = this.chatHistory.slice(-this.maxChatHistory);
        }
    }

    /**
     * Create user message HTML
     */
    private createUserMessageHTML(parts: MessagePart[]): string {
        const bubbleContent = this.createMessageContent(parts);
        return `
            <div class="bg-blue-500 text-white rounded-2xl rounded-tr-none p-3.5 text-sm shadow-md max-w-lg">
                ${bubbleContent}
            </div>
            <div class="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md" role="img" aria-label="User avatar">나</div>
        `;
    }

    /**
     * Create bot message HTML
     */
    private createBotMessageHTML(parts: MessagePart[]): string {
        const bubbleContent = this.createMessageContent(parts);
        return `
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md" role="img" aria-label="AI avatar">AI</div>
            <div class="bg-white/80 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-800 shadow-sm">
                ${bubbleContent}
            </div>
        `;
    }

    /**
     * Create message content from parts
     */
    private createMessageContent(parts: MessagePart[]): string {
        let imageHtml = '';
        let textContent = '';

        parts.forEach(part => {
            if (part.inlineData) {
                imageHtml = `<img src="data:${part.inlineData.mimeType};base64,${part.inlineData.data}" class="rounded-lg mt-2 w-full h-auto" alt="Uploaded image">`;
            }
            if (part.text) {
                const escapedText = escapeHtml(part.text);
                if (part.text.includes('---PDF 시작---')) {
                    textContent += `<div class="text-xs bg-slate-100 p-2 rounded-md mt-2 max-h-40 overflow-y-auto border"><pre class="whitespace-pre-wrap font-sans">${escapedText.replace(/\n/g, '<br>')}</pre></div>`;
                } else {
                    textContent += `<p>${escapedText.replace(/\n/g, '<br>')}</p>`;
                }
            }
        });

        return textContent + imageHtml;
    }

    /**
     * Toggle loading indicator
     */
    toggleLoading(container: HTMLElement, show: boolean): void {
        let loadingEl = document.getElementById('loading-indicator');
        
        if (show) {
            if (!loadingEl) {
                loadingEl = document.createElement('div');
                loadingEl.id = 'loading-indicator';
                loadingEl.className = 'flex items-start gap-3 max-w-lg message-bubble';
                loadingEl.innerHTML = `
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">AI</div>
                    <div class="bg-white/80 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-800 shadow-sm">
                        <div class="flex items-center space-x-1">
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                        </div>
                    </div>
                `;
                container.appendChild(loadingEl);
                requestAnimationFrame(() => {
                    loadingEl?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                });
            }
        } else {
            if (loadingEl) {
                loadingEl.remove();
            }
        }
    }

    /**
     * Handle file selection
     */
    async handleFileSelect(
        file: File,
        onPreview: (preview: { type: string; src?: string; name: string; size: string }) => void,
        onError: (error: string) => void
    ): Promise<void> {
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        
        if (file.size > maxFileSize) {
            onError(`File size exceeds 10MB limit. Current size: ${formatBytes(file.size)}`);
            return;
        }

        if (file.type.startsWith('image/')) {
            await this.handleImageFile(file, onPreview);
        } else if (file.type === 'application/pdf') {
            await this.handlePDFFile(file, onPreview);
        } else {
            onError('Unsupported file type. Please upload an image or PDF.');
        }
    }

    /**
     * Handle image file
     */
    private async handleImageFile(
        file: File,
        onPreview: (preview: { type: string; src?: string; name: string; size: string }) => void
    ): Promise<void> {
        // Compress if needed
        if (file.size > 1024 * 1024) {
            const compressed = await this.compressImage(file);
            this.uploadedFile = {
                type: 'image',
                data: compressed.dataUrl,
                mimeType: file.type,
                name: file.name
            };
            onPreview({
                type: 'image',
                src: compressed.dataUrl,
                name: file.name,
                size: formatBytes(compressed.size)
            });
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                this.uploadedFile = {
                    type: 'image',
                    data: result,
                    mimeType: file.type,
                    name: file.name
                };
                onPreview({
                    type: 'image',
                    src: result,
                    name: file.name,
                    size: formatBytes(file.size)
                });
            };
            reader.readAsDataURL(file);
        }
    }

    /**
     * Handle PDF file
     */
    private async handlePDFFile(
        file: File,
        onPreview: (preview: { type: string; name: string; size: string }) => void
    ): Promise<void> {
        this.uploadedFile = {
            type: 'pdf',
            data: file,
            name: file.name,
            mimeType: file.type
        };
        onPreview({
            type: 'pdf',
            name: file.name,
            size: formatBytes(file.size)
        });
    }

    /**
     * Compress image
     */
    private async compressImage(
        file: File,
        maxWidth: number = 1920,
        maxHeight: number = 1080,
        quality: number = 0.85
    ): Promise<{ dataUrl: string; size: number }> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        const reader2 = new FileReader();
                        reader2.onloadend = () => {
                            resolve({
                                dataUrl: reader2.result as string,
                                size: blob.size
                            });
                        };
                        reader2.readAsDataURL(blob);
                    }, file.type, quality);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Clear uploaded file
     */
    clearUploadedFile(): void {
        this.uploadedFile = { type: null, data: null, name: null, mimeType: null };
    }

    /**
     * Get chat history for API
     */
    getChatHistoryForAPI(): ChatMessage[] {
        // Add uploaded file to the last user message if present
        if (this.uploadedFile.type && this.chatHistory.length > 0) {
            const lastMessage = this.chatHistory[this.chatHistory.length - 1];
            if (lastMessage.role === 'user' && this.uploadedFile.type === 'image') {
                // Add image data to the message
                const imagePart: MessagePart = {
                    inlineData: {
                        mimeType: this.uploadedFile.mimeType!,
                        data: this.uploadedFile.data!.split(',')[1] // Remove data URL prefix
                    }
                };
                lastMessage.parts.push(imagePart);
            }
        }

        return this.chatHistory;
    }

    /**
     * Clear chat
     */
    clearChat(): void {
        this.chatHistory = [];
        this.clearUploadedFile();
    }

    /**
     * Destroy chat manager
     */
    destroy(): void {
        this.virtualScroller?.destroy();
        this.virtualScroller = null;
        this.clearChat();
    }
}

/**
 * Virtual scroller for performance
 */
class VirtualScroller {
    constructor(private container: HTMLElement) {
        // Implementation would go here for virtual scrolling
        // For now, this is a placeholder
    }

    destroy(): void {
        // Cleanup
    }
}