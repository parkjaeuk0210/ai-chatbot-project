import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatManager } from '../../js/chat';
import type { MessagePart } from '../../types';

// Mock dependencies
vi.mock('../../js/utils', () => ({
  formatBytes: vi.fn((bytes: number) => `${bytes} bytes`),
}));

vi.mock('../../js/security', () => ({
  escapeHtml: vi.fn((text: string) => text),
  setSafeHtml: vi.fn((element: HTMLElement, html: string) => {
    element.innerHTML = html;
  }),
}));

describe('ChatManager', () => {
  let chatManager: ChatManager;
  let container: HTMLElement;

  beforeEach(() => {
    chatManager = new ChatManager();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('addMessage', () => {
    it('should add user message to chat', () => {
      const parts: MessagePart[] = [{ text: 'Hello, AI!' }];
      
      chatManager.addMessage(container, 'user', parts);
      
      expect(container.children).toHaveLength(1);
      expect(container.innerHTML).toContain('Hello, AI!');
      expect(chatManager.chatHistory).toHaveLength(1);
      expect(chatManager.chatHistory[0]).toEqual({
        role: 'user',
        parts,
      });
    });

    it('should add model message to chat', () => {
      const parts: MessagePart[] = [{ text: 'Hello, human!' }];
      
      chatManager.addMessage(container, 'model', parts);
      
      expect(container.children).toHaveLength(1);
      expect(container.innerHTML).toContain('Hello, human!');
      expect(chatManager.chatHistory).toHaveLength(1);
      expect(chatManager.chatHistory[0]).toEqual({
        role: 'model',
        parts,
      });
    });

    it('should handle messages with images', () => {
      const parts: MessagePart[] = [
        { text: 'Check this image:' },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'base64data',
          },
        },
      ];
      
      chatManager.addMessage(container, 'user', parts);
      
      expect(container.innerHTML).toContain('Check this image:');
      expect(container.innerHTML).toContain('<img');
    });
  });

  describe('toggleLoading', () => {
    it('should show loading indicator', () => {
      chatManager.toggleLoading(container, true);
      
      const loader = container.querySelector('.loading-dots');
      expect(loader).toBeTruthy();
    });

    it('should hide loading indicator', () => {
      chatManager.toggleLoading(container, true);
      chatManager.toggleLoading(container, false);
      
      const loader = container.querySelector('.loading-dots');
      expect(loader).toBeFalsy();
    });
  });

  describe('clearChat', () => {
    it('should clear chat history and container', () => {
      chatManager.addMessage(container, 'user', [{ text: 'Test' }]);
      chatManager.addMessage(container, 'model', [{ text: 'Response' }]);
      
      expect(chatManager.chatHistory).toHaveLength(2);
      expect(container.children).toHaveLength(2);
      
      chatManager.clearChat(container);
      
      expect(chatManager.chatHistory).toHaveLength(0);
      expect(container.children).toHaveLength(0);
    });
  });

  describe('file handling', () => {
    it('should handle image file selection', async () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const onPreview = vi.fn();
      const onError = vi.fn();
      
      await chatManager.handleFileSelect(mockFile, onPreview, onError);
      
      expect(onPreview).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle PDF file selection', async () => {
      const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      const onPreview = vi.fn();
      const onError = vi.fn();
      
      await chatManager.handleFileSelect(mockFile, onPreview, onError);
      
      expect(onPreview).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(chatManager.uploadedFile.type).toBe('pdf');
    });

    it('should reject invalid file types', async () => {
      const mockFile = new File([''], 'test.exe', { type: 'application/exe' });
      const onPreview = vi.fn();
      const onError = vi.fn();
      
      await chatManager.handleFileSelect(mockFile, onPreview, onError);
      
      expect(onPreview).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('지원되지 않는 파일'));
    });
  });

  describe('chat history management', () => {
    it('should trim chat history when exceeding max length', () => {
      // Add 105 messages (max is 100)
      for (let i = 0; i < 105; i++) {
        chatManager.addMessage(container, 'user', [{ text: `Message ${i}` }]);
      }
      
      expect(chatManager.chatHistory).toHaveLength(100);
      expect(chatManager.chatHistory[0].parts[0].text).toBe('Message 5');
    });

    it('should save chat history', () => {
      const mockLocalStorage = {
        setItem: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
      
      chatManager.addMessage(container, 'user', [{ text: 'Test' }]);
      chatManager.saveChatHistory();
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chatHistory',
        expect.any(String)
      );
    });

    it('should load chat history', () => {
      const savedHistory = [
        { role: 'user', parts: [{ text: 'Saved message' }] },
      ];
      
      const mockLocalStorage = {
        getItem: vi.fn(() => JSON.stringify(savedHistory)),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
      
      chatManager.loadChatHistory(container);
      
      expect(chatManager.chatHistory).toHaveLength(1);
      expect(container.children).toHaveLength(1);
    });
  });

  describe('getChatHistoryForAPI', () => {
    it('should prepare chat history for API with file data', () => {
      chatManager.addMessage(container, 'user', [{ text: 'Hello' }]);
      chatManager.uploadedFile = {
        type: 'image',
        data: 'base64data',
        name: 'test.jpg',
        mimeType: 'image/jpeg',
      };
      
      const apiHistory = chatManager.getChatHistoryForAPI();
      
      expect(apiHistory).toHaveLength(2);
      expect(apiHistory[1].parts).toHaveLength(2);
      expect(apiHistory[1].parts[1].inlineData).toEqual({
        mimeType: 'image/jpeg',
        data: 'base64data',
      });
    });
  });
});