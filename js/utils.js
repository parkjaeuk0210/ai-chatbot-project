// Utility functions for the chat application

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

// Extract text from PDF using PDF.js
export async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
    }
    
    return fullText;
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

// Generate unique session ID
export function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Validate input to prevent injection attacks
export function validateInput(input) {
    if (typeof input !== 'string') return false;
    
    // Check for common injection patterns
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(input));
}

// Error message formatter
export function formatErrorMessage(error) {
    let errorMessage = '오류가 발생했습니다';
    let fallbackMessage = '';
    let errorType = 'unknown';
    
    // Network connection check
    if (!navigator.onLine) {
        errorType = 'network';
        errorMessage = '🌐 네트워크 연결 오류';
        fallbackMessage = '인터넷 연결을 확인해주세요.';
    } 
    // API response errors
    else if (error.message.includes('429')) {
        errorType = 'rateLimit';
        errorMessage = '⏱️ 요청 한도 초과';
        fallbackMessage = '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message.includes('401') || error.message.includes('403')) {
        errorType = 'auth';
        errorMessage = '🔐 인증 오류';
        fallbackMessage = 'API 인증에 실패했습니다. 관리자에게 문의하세요.';
    } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        errorType = 'server';
        errorMessage = '🖥️ 서버 오류';
        fallbackMessage = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message.includes('timeout')) {
        errorType = 'timeout';
        errorMessage = '⏳ 요청 시간 초과';
        fallbackMessage = '응답 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorType = 'network';
        errorMessage = '🌐 네트워크 요청 실패';
        fallbackMessage = '서버에 연결할 수 없습니다. 네트워크 설정을 확인해주세요.';
    } else {
        errorType = 'general';
        fallbackMessage = error.message || '알 수 없는 오류가 발생했습니다.';
    }
    
    return {
        type: errorType,
        title: errorMessage,
        message: fallbackMessage,
        fullMessage: `${errorMessage}\n\n${fallbackMessage}\n\n문제가 지속되면 페이지를 새로고침해주세요.`
    };
}