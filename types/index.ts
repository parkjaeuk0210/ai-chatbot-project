// Type definitions for the AI Chatbot application

// Chat types
export interface ChatMessage {
  role: 'user' | 'model';
  parts: MessagePart[];
  timestamp?: string;
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface ChatHistory extends Array<ChatMessage> {}

// API types
export interface ChatRequest {
  chatHistory: ChatHistory;
  model?: string;
  persona?: string;
  sessionId: string;
  url?: string;
}

export interface ChatResponse {
  candidates?: Array<{
    content: {
      parts: MessagePart[];
      role: string;
    };
    finishReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  error?: {
    message: string;
    code?: number;
  };
}

// File types
export interface UploadedFile {
  type: 'image' | 'pdf' | null;
  data: string | null;
  name: string | null;
  size?: number;
}

export interface FilePreview {
  type: 'image' | 'pdf';
  src?: string;
  name: string;
  size: string;
}

// Error types
export interface ErrorInfo {
  type: 'network' | 'auth' | 'server' | 'timeout' | 'safety' | 'file' | 'general' | 'unknown';
  title: string;
  message: string;
  action: string;
  fullMessage: string;
  isRetryable: boolean;
}

// Settings types
export interface AppSettings {
  language: string;
  theme?: 'light' | 'dark' | 'auto';
  apiEndpoint?: string;
}

// PWA types
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

// API middleware types
export interface RateLimitResult {
  limited: boolean;
  message?: string;
  retryAfter?: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface AuthResult {
  valid: boolean;
  apiKey?: string;
  error?: string;
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Performance types
export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  status?: 'success' | 'error';
}

// i18n types
export interface TranslationKeys {
  [key: string]: string | TranslationKeys;
}

export interface Language {
  code: string;
  name: string;
  translations: TranslationKeys;
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncFunction<T = void> = () => Promise<T>;
export type EventHandler<T = Event> = (event: T) => void;