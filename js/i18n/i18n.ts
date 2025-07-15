// i18n Language Management Module - TypeScript version
import { ko } from './ko.js';
import { en } from './en.js';
import { ja } from './ja.js';
import { zh } from './zh.js';
import { id } from './id.js';
import type { TranslationKeys, Language, I18nConfig, LocationData, LanguageChangeCallback } from './types';

export class I18n {
  private translations: Record<string, TranslationKeys>;
  private supportedLanguages: string[];
  private currentLang: string;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private changeCallbacks: LanguageChangeCallback[] = [];
  private config: I18nConfig;

  constructor(config?: Partial<I18nConfig>) {
    this.translations = { ko, en, ja, zh, id };
    this.supportedLanguages = ['ko', 'en', 'ja', 'zh', 'id'];
    this.currentLang = 'ko'; // Default language
    
    this.config = {
      supportedLanguages: this.supportedLanguages,
      defaultLanguage: 'ko',
      fallbackLanguage: 'en',
      cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
      detection: {
        order: ['querystring', 'localStorage', 'location', 'navigator'],
        caches: ['localStorage'],
      },
      ...config,
    };
  }

  /**
   * Initialize i18n system
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    if (!this.initPromise) {
      this.initPromise = this.performInit();
    }
    
    return this.initPromise;
  }

  private async performInit(): Promise<void> {
    console.log('Initializing i18n...');
    const detectedLang = await this.getInitialLanguage();
    await this.setLanguage(detectedLang);
    this.isInitialized = true;
    console.log('i18n initialized with language:', this.currentLang);
  }

  /**
   * Get initial language based on detection order
   */
  private async getInitialLanguage(): Promise<string> {
    for (const method of this.config.detection!.order) {
      const lang = await this.detectLanguageByMethod(method);
      if (lang && this.isSupported(lang)) {
        return lang;
      }
    }
    return this.config.defaultLanguage;
  }

  /**
   * Detect language by specific method
   */
  private async detectLanguageByMethod(method: string): Promise<string | null> {
    switch (method) {
      case 'querystring':
        return this.detectFromQueryString();
      case 'localStorage':
        return this.detectFromLocalStorage();
      case 'location':
        return await this.detectFromLocation();
      case 'navigator':
        return this.detectFromNavigator();
      case 'htmlTag':
        return this.detectFromHtmlTag();
      default:
        return null;
    }
  }

  /**
   * Detect language from query string
   */
  private detectFromQueryString(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang');
    
    if (lang && this.isSupported(lang)) {
      // Cache in localStorage if configured
      if (this.config.detection!.caches.includes('localStorage')) {
        localStorage.setItem('fera-language', lang);
      }
      return lang;
    }
    
    return null;
  }

  /**
   * Detect language from localStorage
   */
  private detectFromLocalStorage(): string | null {
    const stored = localStorage.getItem('fera-language');
    return stored && this.isSupported(stored) ? stored : null;
  }

  /**
   * Detect language from geolocation
   */
  private async detectFromLocation(): Promise<string | null> {
    // Check cache first
    const cached = this.getCachedLocationLanguage();
    if (cached) return cached;

    try {
      const response = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) throw new Error('Location API failed');
      
      const data: LocationData = await response.json();
      const langMap = this.getLocationLanguageMap();
      const lang = langMap[data.country_code] || null;
      
      if (lang && this.isSupported(lang)) {
        // Cache the result
        this.cacheLocationLanguage(lang);
        return lang;
      }
    } catch (error) {
      console.warn('Location-based language detection failed:', error);
    }
    
    return null;
  }

  /**
   * Detect language from navigator
   */
  private detectFromNavigator(): string | null {
    const navLangs = navigator.languages || [navigator.language];
    
    for (const navLang of navLangs) {
      const lang = navLang.split('-')[0].toLowerCase();
      if (this.isSupported(lang)) {
        return lang;
      }
    }
    
    return null;
  }

  /**
   * Detect language from HTML tag
   */
  private detectFromHtmlTag(): string | null {
    const htmlLang = document.documentElement.lang;
    const lang = htmlLang.split('-')[0].toLowerCase();
    return this.isSupported(lang) ? lang : null;
  }

  /**
   * Get cached location-based language
   */
  private getCachedLocationLanguage(): string | null {
    const cached = localStorage.getItem('fera-location-language');
    const timestamp = localStorage.getItem('fera-location-timestamp');
    
    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < this.config.cacheDuration!) {
        return cached;
      }
    }
    
    return null;
  }

  /**
   * Cache location-based language
   */
  private cacheLocationLanguage(lang: string): void {
    localStorage.setItem('fera-location-language', lang);
    localStorage.setItem('fera-location-timestamp', Date.now().toString());
  }

  /**
   * Get location to language mapping
   */
  private getLocationLanguageMap(): Record<string, string> {
    return {
      'KR': 'ko', 'KP': 'ko',
      'US': 'en', 'GB': 'en', 'CA': 'en', 'AU': 'en', 'NZ': 'en', 'IE': 'en',
      'SG': 'en', 'PH': 'en', 'IN': 'en', 'PK': 'en', 'NG': 'en', 'ZA': 'en',
      'JP': 'ja',
      'CN': 'zh', 'TW': 'zh', 'HK': 'zh', 'MO': 'zh',
      'ID': 'id', 'MY': 'id',
    };
  }

  /**
   * Check if language is supported
   */
  isSupported(lang: string): boolean {
    return this.supportedLanguages.includes(lang);
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.currentLang;
  }

  /**
   * Set language
   */
  async setLanguage(lang: string): Promise<void> {
    if (!this.isSupported(lang)) {
      console.warn(`Language ${lang} is not supported, falling back to ${this.config.fallbackLanguage}`);
      lang = this.config.fallbackLanguage;
    }
    
    const oldLang = this.currentLang;
    this.currentLang = lang;
    
    // Update localStorage
    if (this.config.detection!.caches.includes('localStorage')) {
      localStorage.setItem('fera-language', lang);
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
    // Update UI
    this.updateUI();
    
    // Notify callbacks
    if (oldLang !== lang) {
      this.notifyChangeCallbacks(lang, oldLang);
    }
  }

  /**
   * Get translation
   */
  t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this.translations[this.currentLang];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to default language
        value = this.getFromFallback(keys);
        break;
      }
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    
    // Replace parameters
    if (params) {
      return this.interpolate(value, params);
    }
    
    return value;
  }

  /**
   * Get translation from fallback language
   */
  private getFromFallback(keys: string[]): any {
    let value: any = this.translations[this.config.fallbackLanguage];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }
    
    return value;
  }

  /**
   * Interpolate parameters in translation string
   */
  private interpolate(str: string, params: Record<string, any>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Update UI with current language
   */
  private updateUI(): void {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        element.textContent = this.t(key);
      }
    });
    
    // Update all elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key && element instanceof HTMLInputElement) {
        element.placeholder = this.t(key);
      }
    });
    
    // Update all elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const key = element.getAttribute('data-i18n-title');
      if (key && element instanceof HTMLElement) {
        element.title = this.t(key);
      }
    });
    
    // Update all elements with data-i18n-aria-label attribute
    document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      const key = element.getAttribute('data-i18n-aria-label');
      if (key && element instanceof HTMLElement) {
        element.setAttribute('aria-label', this.t(key));
      }
    });
  }

  /**
   * Add language change callback
   */
  onLanguageChange(callback: LanguageChangeCallback): () => void {
    this.changeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.changeCallbacks.indexOf(callback);
      if (index > -1) {
        this.changeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all change callbacks
   */
  private notifyChangeCallbacks(newLang: string, oldLang: string): void {
    this.changeCallbacks.forEach((callback) => {
      try {
        callback(newLang, oldLang);
      } catch (error) {
        console.error('Error in language change callback:', error);
      }
    });
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): Array<{ code: string; name: string }> {
    return this.supportedLanguages.map((code) => ({
      code,
      name: this.translations[code].languages[code],
    }));
  }

  /**
   * Format number based on locale
   */
  formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.currentLang, options).format(num);
  }

  /**
   * Format date based on locale
   */
  formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.currentLang, options).format(new Date(date));
  }

  /**
   * Format relative time
   */
  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
    const rtf = new Intl.RelativeTimeFormat(this.currentLang, { numeric: 'auto' });
    return rtf.format(value, unit);
  }

  /**
   * Pluralize based on count
   */
  pluralize(key: string, count: number): string {
    const pluralKey = `${key}_${this.getPluralForm(count)}`;
    const translation = this.t(pluralKey);
    
    if (translation === pluralKey) {
      // Fallback to singular form
      return this.t(key, { count });
    }
    
    return this.interpolate(translation, { count });
  }

  /**
   * Get plural form based on language rules
   */
  private getPluralForm(count: number): string {
    // Simplified plural rules for supported languages
    switch (this.currentLang) {
      case 'ko':
      case 'ja':
      case 'zh':
      case 'id':
        // These languages don't have plural forms
        return 'other';
      case 'en':
        return count === 1 ? 'one' : 'other';
      default:
        return 'other';
    }
  }
}

// Create and export singleton instance
export const i18n = new I18n();

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => i18n.init());
  } else {
    i18n.init();
  }
}

// Make i18n available globally
declare global {
  interface Window {
    i18n: I18n;
  }
}

if (typeof window !== 'undefined') {
  window.i18n = i18n;
}