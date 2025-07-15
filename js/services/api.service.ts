// API Service - Handles all API communications
import type { ChatRequest, ChatResponse, ErrorInfo } from '../../types';
import { formatErrorMessage } from '../utils.js';

export class ApiService {
  private baseUrl: string;
  private apiKey: string | null;
  private abortController: AbortController | null = null;

  constructor(baseUrl: string = '', apiKey: string | null = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Send chat request to API
   */
  async sendChatRequest(request: ChatRequest): Promise<ChatResponse> {
    // Cancel any pending request
    this.cancelPendingRequest();

    // Create new abort controller
    this.abortController = new AbortController();

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as ChatResponse;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel pending request
   */
  cancelPendingRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Upload file for processing
   */
  async uploadFile(file: File): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Update API configuration
   */
  updateConfig(config: { baseUrl?: string; apiKey?: string }): void {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    if (config.apiKey !== undefined) {
      this.apiKey = config.apiKey;
    }
  }
}

// Singleton instance
export const apiService = new ApiService();