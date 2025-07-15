/**
 * Typing Indicator Component
 * Shows when the AI is typing/thinking
 */

export class TypingIndicator {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.isVisible = false;
        this.animationInterval = null;
        this.dots = 3;
        this.currentDot = 0;
        
        this.init();
    }

    init() {
        this.createElement();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'typing-indicator hidden';
        this.element.innerHTML = `
            <div class="flex items-start gap-3 max-w-lg">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">
                    AI
                </div>
                <div class="typing-bubble bg-white/80 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-800 shadow-sm">
                    <div class="typing-dots flex items-center gap-1">
                        <span class="dot w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                        <span class="dot w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                        <span class="dot w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                    </div>
                    <span class="sr-only" role="status" aria-live="polite">AI가 응답을 입력하고 있습니다</span>
                </div>
            </div>
        `;
        
        // Add CSS for animations
        if (!document.querySelector('#typing-indicator-styles')) {
            const style = document.createElement('style');
            style.id = 'typing-indicator-styles';
            style.textContent = `
                .typing-indicator {
                    transition: opacity 0.3s ease-in-out;
                    opacity: 1;
                }
                
                .typing-indicator.hidden {
                    opacity: 0;
                    pointer-events: none;
                }
                
                .typing-bubble {
                    min-width: 60px;
                }
                
                @keyframes bounce {
                    0%, 80%, 100% {
                        transform: translateY(0);
                        opacity: 0.4;
                    }
                    40% {
                        transform: translateY(-6px);
                        opacity: 1;
                    }
                }
                
                .animate-bounce {
                    animation: bounce 1.4s infinite;
                }
                
                /* Different typing styles */
                .typing-wave .dot {
                    animation: wave 1.4s infinite;
                }
                
                @keyframes wave {
                    0%, 40%, 100% {
                        transform: translateY(0) scale(1);
                    }
                    20% {
                        transform: translateY(-8px) scale(1.2);
                    }
                }
                
                .typing-pulse .dot {
                    animation: pulse 1.4s infinite;
                }
                
                @keyframes pulse {
                    0%, 80%, 100% {
                        opacity: 0.3;
                        transform: scale(0.8);
                    }
                    40% {
                        opacity: 1;
                        transform: scale(1.2);
                    }
                }
                
                .typing-thinking {
                    position: relative;
                }
                
                .typing-thinking::after {
                    content: '';
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    bottom: -2px;
                    left: -2px;
                    background: linear-gradient(45deg, #3b82f6, #8b5cf6);
                    border-radius: inherit;
                    opacity: 0.3;
                    animation: rotate 2s linear infinite;
                    z-index: -1;
                }
                
                @keyframes rotate {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
                
                /* Accessibility - reduce motion */
                @media (prefers-reduced-motion: reduce) {
                    .animate-bounce,
                    .typing-wave .dot,
                    .typing-pulse .dot {
                        animation: none;
                    }
                    
                    .typing-thinking::after {
                        animation: none;
                        opacity: 0.1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    show(style = 'bounce') {
        if (this.isVisible) return;
        
        this.isVisible = true;
        
        // Add to container if not already there
        if (!this.container.contains(this.element)) {
            this.container.appendChild(this.element);
        }
        
        // Apply style
        const dotsContainer = this.element.querySelector('.typing-dots');
        dotsContainer.className = `typing-dots flex items-center gap-1 typing-${style}`;
        
        // Show with animation
        requestAnimationFrame(() => {
            this.element.classList.remove('hidden');
            this.scrollToBottom();
        });
        
        // Add thinking animation for complex responses
        if (style === 'thinking') {
            const bubble = this.element.querySelector('.typing-bubble');
            bubble.classList.add('typing-thinking');
        }
    }

    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.element.classList.add('hidden');
        
        // Remove after animation
        setTimeout(() => {
            if (this.element.parentNode && !this.isVisible) {
                this.element.parentNode.removeChild(this.element);
            }
        }, 300);
    }

    scrollToBottom() {
        if (this.container.scrollTo) {
            this.container.scrollTo({
                top: this.container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    setMessage(message) {
        // Show custom message instead of dots
        const bubble = this.element.querySelector('.typing-bubble');
        if (bubble && message) {
            bubble.innerHTML = `
                <span class="text-xs text-slate-500">${message}</span>
                <span class="sr-only" role="status" aria-live="polite">${message}</span>
            `;
        }
    }

    destroy() {
        this.hide();
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}

// Export for use in other modules
export default TypingIndicator;