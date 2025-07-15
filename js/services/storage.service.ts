// Storage Service - Handles local storage operations
import type { ChatHistory, AppSettings } from '../../types';

export class StorageService {
  private readonly KEYS = {
    CHAT_HISTORY: 'chatHistory',
    SESSION_ID: 'sessionId',
    SETTINGS: 'appSettings',
    LAST_ACTIVE: 'lastActive',
    API_KEY: 'apiKey',
  };

  /**
   * Save chat history
   */
  saveChatHistory(history: ChatHistory): void {
    try {
      const trimmedHistory = history.slice(-100); // Keep last 100 messages
      localStorage.setItem(this.KEYS.CHAT_HISTORY, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.error('Failed to save chat history:', error);
      // Clear if quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearChatHistory();
      }
    }
  }

  /**
   * Load chat history
   */
  loadChatHistory(): ChatHistory {
    try {
      const data = localStorage.getItem(this.KEYS.CHAT_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load chat history:', error);
      return [];
    }
  }

  /**
   * Clear chat history
   */
  clearChatHistory(): void {
    localStorage.removeItem(this.KEYS.CHAT_HISTORY);
  }

  /**
   * Save session ID
   */
  saveSessionId(sessionId: string): void {
    localStorage.setItem(this.KEYS.SESSION_ID, sessionId);
  }

  /**
   * Load session ID
   */
  loadSessionId(): string | null {
    return localStorage.getItem(this.KEYS.SESSION_ID);
  }

  /**
   * Save app settings
   */
  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Load app settings
   */
  loadSettings(): AppSettings | null {
    try {
      const data = localStorage.getItem(this.KEYS.SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return null;
    }
  }

  /**
   * Save API key (encrypted in production)
   */
  saveApiKey(apiKey: string): void {
    // In production, this should be encrypted
    localStorage.setItem(this.KEYS.API_KEY, btoa(apiKey));
  }

  /**
   * Load API key
   */
  loadApiKey(): string | null {
    const encoded = localStorage.getItem(this.KEYS.API_KEY);
    return encoded ? atob(encoded) : null;
  }

  /**
   * Update last active timestamp
   */
  updateLastActive(): void {
    localStorage.setItem(this.KEYS.LAST_ACTIVE, new Date().toISOString());
  }

  /**
   * Get last active timestamp
   */
  getLastActive(): Date | null {
    const timestamp = localStorage.getItem(this.KEYS.LAST_ACTIVE);
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Clear all storage
   */
  clearAll(): void {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Get storage size info
   */
  async getStorageInfo(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { used: 0, quota: 0 };
  }
}

// Singleton instance
export const storageService = new StorageService();