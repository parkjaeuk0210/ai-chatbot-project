// Message Component - Handles individual message rendering
import type { ChatMessage } from '../../types';
import { escapeHtml, setSafeHtml } from '../security.js';
import { getTimestamp } from '../utils.js';

export class MessageComponent {
  private messageId: string;
  private message: ChatMessage;
  private element: HTMLElement | null = null;

  constructor(message: ChatMessage, messageId: string) {
    this.message = message;
    this.messageId = messageId;
  }

  /**
   * Render the message element
   */
  render(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${this.message.role} message-enter`;
    wrapper.dataset.messageId = this.messageId;

    const container = document.createElement('div');
    container.className = this.message.role === 'user' 
      ? 'max-w-4xl ml-auto' 
      : 'max-w-4xl';

    const messageBox = document.createElement('div');
    messageBox.className = this.message.role === 'user'
      ? 'bg-blue-600 text-white rounded-2xl px-6 py-4 inline-block max-w-full'
      : 'bg-gray-800 text-gray-100 rounded-2xl px-6 py-4 inline-block max-w-full';

    // Add content
    const content = this.renderContent();
    messageBox.appendChild(content);

    // Add timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'text-xs opacity-70 mt-2';
    timestamp.textContent = this.message.timestamp || getTimestamp();

    messageBox.appendChild(timestamp);
    container.appendChild(messageBox);
    wrapper.appendChild(container);

    this.element = wrapper;
    return wrapper;
  }

  /**
   * Render message content
   */
  private renderContent(): HTMLElement {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content whitespace-pre-wrap break-words';

    this.message.parts.forEach(part => {
      if (part.text) {
        const textElement = document.createElement('div');
        
        // For bot messages, allow formatted content
        if (this.message.role === 'model') {
          setSafeHtml(textElement, this.formatBotMessage(part.text));
        } else {
          // For user messages, escape HTML
          textElement.textContent = part.text;
        }
        
        contentDiv.appendChild(textElement);
      }
      
      if (part.inlineData) {
        const mediaElement = this.renderMedia(part.inlineData);
        if (mediaElement) {
          contentDiv.appendChild(mediaElement);
        }
      }
    });

    return contentDiv;
  }

  /**
   * Format bot message with markdown-like support
   */
  private formatBotMessage(text: string): string {
    // Basic markdown formatting
    let formatted = escapeHtml(text);
    
    // Bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }

  /**
   * Render inline media
   */
  private renderMedia(inlineData: { mimeType: string; data: string }): HTMLElement | null {
    if (inlineData.mimeType.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = `data:${inlineData.mimeType};base64,${inlineData.data}`;
      img.className = 'max-w-full rounded-lg mt-2';
      img.loading = 'lazy';
      return img;
    }
    
    return null;
  }

  /**
   * Update message content
   */
  updateContent(newMessage: ChatMessage): void {
    this.message = newMessage;
    if (this.element) {
      const contentDiv = this.element.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.innerHTML = '';
        const newContent = this.renderContent();
        contentDiv.appendChild(newContent);
      }
    }
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLElement | null {
    return this.element;
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}