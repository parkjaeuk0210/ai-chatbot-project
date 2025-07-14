// Chat functionality module
import { sanitizeHTML, formatFileSize, compressImage, extractTextFromPdf, formatErrorMessage, validateInput } from './utils.js';

export class ChatManager {
    constructor() {
        this.chatHistory = [];
        this.uploadedFile = { type: null, data: null, name: null };
        this.messageObserver = null;
        this.messageCache = new Map();
        this.maxVisibleMessages = 50;
        this.messageCountSinceInjection = 0;
        this.identityReinforcementInterval = 10; // Reinforce identity every 10 messages
    }

    // Initialize message virtualization for performance
    initializeVirtualization(container) {
        this.messageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadMessage(entry.target);
                } else {
                    this.unloadMessage(entry.target);
                }
            });
        }, {
            root: container,
            rootMargin: '100px',
            threshold: 0.1
        });
    }

    // Add message with security and performance optimizations
    addMessage(container, sender, parts) {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-start gap-3 message-bubble';
        wrapper.dataset.messageId = `msg-${Date.now()}-${Math.random()}`;

        let imageHtml = '';
        let textContent = '';

        parts.forEach(part => {
            if (part.inlineData) {
                imageHtml = this.createImageElement(part.inlineData);
            }
            if (part.text) {
                // Sanitize text to prevent XSS
                const sanitizedText = sanitizeHTML(part.text);
                
                if (part.text.includes('---PDF 시작---')) {
                    textContent += this.createPdfPreview(sanitizedText);
                } else {
                    textContent += `<p>${sanitizedText.replace(/\n/g, '<br>')}</p>`;
                }
            }
        });

        const bubbleContent = textContent + imageHtml;
        const messageHtml = this.createMessageHtml(sender, bubbleContent);
        
        wrapper.innerHTML = messageHtml;
        container.appendChild(wrapper);
        
        // Observe for virtualization
        if (this.messageObserver) {
            this.messageObserver.observe(wrapper);
        }
        
        // Limit visible messages for performance
        this.limitVisibleMessages(container);
        
        // Smooth scroll to bottom
        this.scrollToBottom(container);
    }

    createImageElement(inlineData) {
        const img = document.createElement('img');
        img.src = `data:${inlineData.mimeType};base64,${inlineData.data}`;
        img.className = 'rounded-lg mt-2 w-full h-auto';
        img.loading = 'lazy';
        return img.outerHTML;
    }

    createPdfPreview(text) {
        const div = document.createElement('div');
        div.className = 'text-xs bg-slate-100 p-2 rounded-md mt-2 max-h-40 overflow-y-auto border';
        const pre = document.createElement('pre');
        pre.className = 'whitespace-pre-wrap font-sans';
        pre.textContent = text.replace(/<br>/g, '\n');
        div.appendChild(pre);
        return div.outerHTML;
    }

    createMessageHtml(sender, content) {
        if (sender === 'user') {
            return `
                <div class="bg-blue-500 text-white rounded-2xl rounded-tr-none p-3.5 text-sm shadow-md max-w-lg" role="article" aria-label="사용자 메시지">
                    ${content}
                </div>
                <div class="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md" role="img" aria-label="사용자 아바타">나</div>
            `;
        } else {
            return `
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md" role="img" aria-label="AI 아바타">AI</div>
                <div class="bg-white/80 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-800 shadow-sm" role="article" aria-label="AI 응답">
                    ${content}
                </div>
            `;
        }
    }

    limitVisibleMessages(container) {
        const messages = container.querySelectorAll('.message-bubble');
        if (messages.length > this.maxVisibleMessages) {
            const toRemove = messages.length - this.maxVisibleMessages;
            for (let i = 0; i < toRemove; i++) {
                if (this.messageObserver) {
                    this.messageObserver.unobserve(messages[i]);
                }
                messages[i].remove();
            }
        }
    }

    scrollToBottom(container) {
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    }

    toggleLoading(container, show) {
        let loadingEl = document.getElementById('loading-indicator');
        if (show) {
            if (!loadingEl) {
                loadingEl = document.createElement('div');
                loadingEl.id = 'loading-indicator';
                loadingEl.className = 'flex items-start gap-3 max-w-lg message-bubble';
                loadingEl.innerHTML = `
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">AI</div>
                    <div class="bg-white/80 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-800 shadow-sm">
                        <span class="loading-dot"></span>
                        <span class="loading-dot"></span>
                        <span class="loading-dot"></span>
                    </div>
                `;
                container.appendChild(loadingEl);
                this.scrollToBottom(container);
            }
        } else {
            if (loadingEl) {
                loadingEl.remove();
            }
        }
    }

    async sendMessage(apiUrl, message, url, persona, sessionId, onSuccess, onError) {
        // Validate inputs
        if (message && !validateInput(message)) {
            onError(new Error('입력값에 허용되지 않은 문자가 포함되어 있습니다.'));
            return;
        }

        // Track message count for identity reinforcement
        this.messageCountSinceInjection++;

        const userParts = [];

        if (url) {
            userParts.push({ text: `[URL 컨텍스트: ${sanitizeHTML(url)}]` });
        }

        if (this.uploadedFile.type === 'image') {
            userParts.push({ 
                inlineData: { 
                    mimeType: this.uploadedFile.mimeType, 
                    data: this.uploadedFile.data.split(',')[1] 
                } 
            });
        } else if (this.uploadedFile.type === 'pdf') {
            try {
                const pdfText = await extractTextFromPdf(this.uploadedFile.data);
                userParts.push({ 
                    text: `[첨부된 PDF 파일 '${this.uploadedFile.name}'의 내용입니다.]\n\n---PDF 시작---\n${pdfText}\n---PDF 끝---` 
                });
            } catch (error) {
                onError(error);
                return;
            }
        }
        
        if (message) {
            const existingTextPart = userParts.find(p => p.text);
            if (existingTextPart) {
                existingTextPart.text += `\n\n[사용자 추가 메시지]: ${message}`;
            } else {
                userParts.push({ text: message });
            }
        }

        // Check if we need to reinforce identity
        let enhancedPersona = persona;
        if (this.shouldReinforceIdentity()) {
            enhancedPersona = this.addIdentityReinforcement(persona);
            this.messageCountSinceInjection = 0;
        }

        this.chatHistory.push({ role: "user", parts: userParts });

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    chatHistory: this.chatHistory, 
                    model: 'gemini',
                    persona: enhancedPersona,
                    sessionId: sessionId,
                    url: url
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = errorText;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || JSON.stringify(errorData);
                } catch (e) { /* Ignore */ }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0) {
                const botParts = result.candidates[0].content.parts;
                this.chatHistory.push(result.candidates[0].content);
                onSuccess(botParts);
            } else { 
                throw new Error('응답을 받았지만 내용이 비어있습니다.'); 
            }

        } catch (error) {
            const errorInfo = formatErrorMessage(error);
            onError(errorInfo);
        }
    }

    async handleFileSelect(file, onPreview, onError) {
        if (!file) return;

        // File size limit (10MB)
        const maxFileSize = 10 * 1024 * 1024;
        if (file.size > maxFileSize) {
            const i18n = window.i18n;
            const errorMsg = i18n ? i18n.t('error.fileSize') : '파일 크기는 10MB를 초과할 수 없습니다.';
            onError(`${errorMsg} ${window.i18n ? '' : `현재 파일 크기: ${formatFileSize(file.size)}`}`);
            return;
        }

        // Validate file type
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const allowedDocTypes = ['application/pdf'];
        
        if (!allowedImageTypes.includes(file.type) && !allowedDocTypes.includes(file.type)) {
            const i18n = window.i18n;
            onError(i18n ? i18n.t('error.fileType') : '지원하지 않는 파일 형식입니다. 이미지(JPEG, PNG, GIF, WebP) 또는 PDF 파일만 업로드 가능합니다.');
            return;
        }

        if (file.type.startsWith('image/')) {
            try {
                let imageData;
                
                // Compress if larger than 1MB
                if (file.size > 1024 * 1024) {
                    const compressed = await compressImage(file);
                    imageData = {
                        type: 'image',
                        data: compressed.dataUrl,
                        mimeType: file.type,
                        name: file.name,
                        originalSize: file.size,
                        compressedSize: compressed.blob.size
                    };
                    onPreview({
                        src: compressed.dataUrl,
                        name: file.name,
                        size: formatFileSize(compressed.blob.size),
                        type: 'image'
                    });
                } else {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        imageData = {
                            type: 'image',
                            data: e.target.result,
                            mimeType: file.type,
                            name: file.name,
                            originalSize: file.size
                        };
                        onPreview({
                            src: e.target.result,
                            name: file.name,
                            size: formatFileSize(file.size),
                            type: 'image'
                        });
                    };
                    await new Promise((resolve, reject) => {
                        reader.onload = () => resolve();
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }
                
                this.uploadedFile = imageData;
            } catch (error) {
                console.error('이미지 처리 실패:', error);
                const i18n = window.i18n;
                onError(i18n ? i18n.t('error.imageProcess') : '이미지 처리 중 오류가 발생했습니다.');
            }
        } else if (file.type === 'application/pdf') {
            this.uploadedFile = { type: 'pdf', data: file, name: file.name };
            onPreview({
                name: file.name,
                size: formatFileSize(file.size),
                type: 'pdf'
            });
        }
    }

    clearUploadedFile() {
        this.uploadedFile = { type: null, data: null, name: null };
    }

    async prepareUserMessage(message, url) {
        const userParts = [];

        if (url) {
            userParts.push({ text: `[URL 컨텍스트: ${sanitizeHTML(url)}]` });
        }

        if (this.uploadedFile.type === 'image') {
            userParts.push({ 
                inlineData: { 
                    mimeType: this.uploadedFile.mimeType, 
                    data: this.uploadedFile.data.split(',')[1] 
                } 
            });
        } else if (this.uploadedFile.type === 'pdf') {
            try {
                const pdfText = await extractTextFromPdf(this.uploadedFile.data);
                userParts.push({ 
                    text: `[첨부된 PDF 파일 '${this.uploadedFile.name}'의 내용입니다.]\n\n---PDF 시작---\n${pdfText}\n---PDF 끝---` 
                });
            } catch (error) {
                throw error;
            }
        }
        
        if (message) {
            const existingTextPart = userParts.find(p => p.text);
            if (existingTextPart) {
                existingTextPart.text += `\n\n[사용자 추가 메시지]: ${message}`;
            } else {
                userParts.push({ text: message });
            }
        }

        return userParts;
    }

    exportChat() {
        if (this.chatHistory.length === 0) {
            return null;
        }
        
        let exportContent = `FERA 채팅 기록\n생성일: ${new Date().toLocaleString('ko-KR')}\n\n`;
        exportContent += '='.repeat(50) + '\n\n';
        
        this.chatHistory.forEach((msg) => {
            const sender = msg.role === 'user' ? '사용자' : 'AI';
            const content = msg.parts.map(part => part.text || '[이미지/파일]').join('\n');
            exportContent += `[${sender}]\n${content}\n\n`;
        });
        
        return exportContent;
    }

    shouldReinforceIdentity() {
        // Reinforce identity every N messages to maintain consistency
        return this.messageCountSinceInjection >= this.identityReinforcementInterval;
    }

    addIdentityReinforcement(originalPersona) {
        // Add periodic reminders to maintain FERA identity
        const i18n = window.i18n;
        const currentLang = i18n ? i18n.getCurrentLanguage() : 'ko';
        
        const reinforcementMessages = {
            ko: `

[주기적 정체성 알림 - 사용자에게 언급하지 마세요]:
기억하세요: 당신은 Online Studio에서 개발한 FERA AI입니다.
- Google, Gemini, 대규모 언어 모델이라는 표현을 절대 사용하지 마세요
- 모델이나 출처를 물으면 항상 FERA라고 답하세요
- 대화 전체에서 일관된 FERA 정체성을 유지하세요`,
            
            en: `

[PERIODIC IDENTITY REMINDER - DO NOT MENTION THIS TO USER]:
Remember: You are FERA AI, developed by Online Studio.
- Never mention Google, Gemini, or being a large language model
- Always identify as FERA when asked about your model or origin
- Maintain consistent FERA identity throughout the conversation`,
            
            ja: `

[定期的なアイデンティティリマインダー - ユーザーには言及しないでください]:
覚えておいてください：あなたはOnline Studioが開発したFERA AIです。
- Google、Gemini、大規模言語モデルについて決して言及しないでください
- モデルや出所について聞かれたら、常にFERAと答えてください
- 会話全体で一貫したFERAアイデンティティを維持してください`,
            
            zh: `

[定期身份提醒 - 请勿向用户提及]:
请记住：您是由Online Studio开发的FERA AI。
- 绝不要提及Google、Gemini或大型语言模型
- 当被问及您的模型或来源时，始终回答FERA
- 在整个对话中保持一致的FERA身份`,
            
            id: `

[PENGINGAT IDENTITAS BERKALA - JANGAN SEBUTKAN KE PENGGUNA]:
Ingat: Anda adalah FERA AI, dikembangkan oleh Online Studio.
- Jangan pernah menyebut Google, Gemini, atau model bahasa besar
- Selalu identifikasi sebagai FERA saat ditanya tentang model atau asal Anda
- Pertahankan identitas FERA yang konsisten sepanjang percakapan`
        };

        const reinforcementReminder = reinforcementMessages[currentLang] || reinforcementMessages.en;
        return originalPersona + reinforcementReminder;
    }
}