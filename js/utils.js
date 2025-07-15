// Utility functions for the chat application

// Import validator for enhanced security
import { validator } from './security/validator.js';

// Security: Sanitize HTML to prevent XSS attacks
export function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// Format file size in human-readable format
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Compress image to reduce file size
export async function compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Maintain aspect ratio while resizing
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
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve({
                        blob,
                        dataUrl: canvas.toDataURL(file.type, quality),
                        width,
                        height
                    });
                }, file.type, quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Extract text from PDF using PDF.js (with lazy loading)
export async function extractTextFromPdf(file) {
    try {
        // Lazy load PDF.js if not already loaded
        if (!window.pdfjsLib) {
            const { lazyLoadPdfJs } = await import('./lazyLoader.js');
            await lazyLoadPdfJs();
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        
        return fullText;
    } catch (error) {
        console.error('PDF extraction error:', error);
        throw new Error('PDF 파일을 읽을 수 없습니다.');
    }
}

// Debounce function to limit API calls
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function to limit event firing rate
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Generate unique session ID
export function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Validate input to prevent injection attacks
export function validateInput(input, type = 'message') {
    if (typeof input !== 'string') return false;
    
    // Use enhanced validator
    const validation = validator.validate(input, type);
    return validation.valid;
}

// Export validator for use in other modules
export { validator };

// Error message formatter
export function formatErrorMessage(error) {
    const i18n = window.i18n;
    let errorMessage = i18n ? i18n.t('error.general') : '오류가 발생했습니다';
    let fallbackMessage = '';
    let errorType = 'unknown';
    let userAction = '';
    
    // Network connection check
    if (!navigator.onLine) {
        errorType = 'network';
        errorMessage = i18n ? i18n.t('error.network') : '🌐 네트워크 연결 오류';
        fallbackMessage = i18n ? i18n.t('error.network') : '인터넷 연결을 확인해주세요.';
        userAction = i18n ? i18n.t('action.checkConnection') : '🔄 인터넷 연결을 확인하고 다시 시도하세요';
    } 
    // API response errors
    else if (error.message.includes('429')) {
        errorType = 'rateLimit';
        errorMessage = '⏱️ 요청 한도 초과';
        fallbackMessage = '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.';
        userAction = '⏰ 1분 후에 다시 시도해주세요';
    } else if (error.message.includes('401') || error.message.includes('403')) {
        errorType = 'auth';
        errorMessage = '🔐 인증 오류';
        fallbackMessage = 'API 인증에 실패했습니다. 관리자에게 문의하세요.';
        userAction = '💁 관리자에게 문의하거나 페이지를 새로고침하세요';
    } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        errorType = 'server';
        errorMessage = i18n ? i18n.t('error.serverConfig') : '🖥️ 서버 오류';
        fallbackMessage = i18n ? i18n.t('error.serverConfig') : '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        userAction = '⏰ 몇 분 후에 다시 시도해주세요';
    } else if (error.message.includes('timeout')) {
        errorType = 'timeout';
        errorMessage = '⏳ 요청 시간 초과';
        fallbackMessage = '응답 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
        userAction = '🔄 다시 시도하거나 질문을 더 짧게 해보세요';
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorType = 'network';
        errorMessage = i18n ? i18n.t('error.network') : '🌐 네트워크 요청 실패';
        fallbackMessage = i18n ? i18n.t('error.network') : '서버에 연결할 수 없습니다. 네트워크 설정을 확인해주세요.';
        userAction = '🔌 네트워크 연결을 확인하세요';
    } else if (error.message.includes('content blocked') || error.message.includes('safety')) {
        errorType = 'safety';
        errorMessage = '🚫 콘텐츠 안전 제한';
        fallbackMessage = '요청하신 내용이 안전 정책에 의해 차단되었습니다.';
        userAction = '📝 다른 내용으로 시도해주세요';
    } else if (error.message.includes('file') || error.message.includes('size')) {
        errorType = 'file';
        errorMessage = '📁 파일 오류';
        fallbackMessage = error.message;
        userAction = '📄 파일 크기나 형식을 확인하세요';
    } else {
        errorType = 'general';
        fallbackMessage = error.message || (i18n ? i18n.t('error.general') : '알 수 없는 오류가 발생했습니다.');
        userAction = '🔄 페이지를 새로고침하거나 다시 시도해주세요';
    }
    
    return {
        type: errorType,
        title: errorMessage,
        message: fallbackMessage,
        action: userAction,
        fullMessage: `${errorMessage}\n\n${fallbackMessage}\n\n${userAction}`,
        isRetryable: ['network', 'timeout', 'server', 'rateLimit'].includes(errorType)
    };
}

// Unified error handler
export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
    }
    
    handle(error, context = {}) {
        const errorInfo = formatErrorMessage(error);
        
        // Log error for debugging
        this.logError({
            ...errorInfo,
            timestamp: new Date().toISOString(),
            context,
            originalError: error
        });
        
        // Return formatted error for UI
        return errorInfo;
    }
    
    logError(errorEntry) {
        this.errorLog.push(errorEntry);
        
        // Limit log size
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize);
        }
        
        // Log to console in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.error('[ErrorHandler]', errorEntry);
        }
    }
    
    getRecentErrors(count = 10) {
        return this.errorLog.slice(-count);
    }
    
    clearErrors() {
        this.errorLog = [];
    }
}

// Global error handler instance
export const errorHandler = new ErrorHandler();

// API response validation
export function validateApiResponse(response) {
    if (!response || typeof response !== 'object') {
        return false;
    }
    
    // Check for expected structure
    if (response.candidates && Array.isArray(response.candidates)) {
        return response.candidates.every(candidate => 
            candidate.content && 
            candidate.content.parts && 
            Array.isArray(candidate.content.parts)
        );
    }
    
    // Check for error structure
    if (response.error) {
        return true; // Valid error response
    }
    
    return false;
}