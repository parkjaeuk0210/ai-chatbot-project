import { ko } from './ko.js';
import { en } from './en.js';
import { ja } from './ja.js';
import { zh } from './zh.js';
import { id } from './id.js';

const STORAGE_KEY = 'pera-language';
const LEGACY_STORAGE_KEY = 'fera-language';
const DEFAULT_LANGUAGE = 'ko';

class I18n {
  constructor() {
    this.translations = { ko, en, ja, zh, id };
    this.supportedLanguages = Object.keys(this.translations);
    this.currentLang = DEFAULT_LANGUAGE;
    this.isInitialized = false;
  }

  safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable in private or embedded browsing contexts.
    }
  }

  normalizeLanguage(language) {
    if (!language) return null;
    const normalized = String(language).toLowerCase().split('-')[0];
    return this.supportedLanguages.includes(normalized) ? normalized : null;
  }

  detectBrowserLanguage() {
    const browserLanguages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language || DEFAULT_LANGUAGE];

    for (const language of browserLanguages) {
      const normalized = this.normalizeLanguage(language);
      if (normalized) return normalized;
    }

    return DEFAULT_LANGUAGE;
  }

  getInitialLanguage() {
    const urlLanguage = this.normalizeLanguage(new URLSearchParams(window.location.search).get('lang'));
    if (urlLanguage) {
      this.safeStorageSet(STORAGE_KEY, urlLanguage);
      return urlLanguage;
    }

    const storedLanguage = this.normalizeLanguage(this.safeStorageGet(STORAGE_KEY));
    if (storedLanguage) return storedLanguage;

    const legacyLanguage = this.normalizeLanguage(this.safeStorageGet(LEGACY_STORAGE_KEY));
    if (legacyLanguage) {
      this.safeStorageSet(STORAGE_KEY, legacyLanguage);
      return legacyLanguage;
    }

    return this.detectBrowserLanguage();
  }

  t(key, language = this.currentLang) {
    const selected = this.translations[language] || this.translations[DEFAULT_LANGUAGE];
    return selected[key] ?? this.translations[DEFAULT_LANGUAGE][key] ?? key;
  }

  updatePageTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n;
      const translation = this.t(key);

      if (element.matches('input, textarea')) {
        element.setAttribute('placeholder', translation);
      } else {
        element.textContent = translation;
      }
    });

    document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', this.t(element.dataset.i18nAria));
    });

    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      element.setAttribute('title', this.t(element.dataset.i18nTitle));
    });

    document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
      element.setAttribute('alt', this.t(element.dataset.i18nAlt));
    });

    document.title = this.t('page.title');
  }

  setLanguage(language, { announce = true } = {}) {
    const normalized = this.normalizeLanguage(language);
    if (!normalized) return false;

    this.currentLang = normalized;
    this.safeStorageSet(STORAGE_KEY, normalized);
    document.documentElement.lang = normalized;
    this.updatePageTranslations();

    if (announce) {
      window.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { language: normalized }
      }));
    }

    return true;
  }

  createLanguageSelector() {
    const selector = document.createElement('select');
    selector.id = 'language-selector';
    selector.className = 'language-select';
    selector.setAttribute('aria-label', this.t('settings.languageLabel'));

    for (const language of this.supportedLanguages) {
      const option = document.createElement('option');
      option.value = language;
      option.textContent = this.t(`lang.${language}`, language);
      option.selected = language === this.currentLang;
      selector.appendChild(option);
    }

    selector.addEventListener('change', () => {
      this.setLanguage(selector.value);
    });

    return selector;
  }

  getCurrentLanguage() {
    return this.currentLang;
  }

  getAISystemMessage() {
    const messages = {
      ko: '사용자에게 한국어로 명확하고 자연스럽게 답변하세요.',
      en: 'Respond to the user clearly and naturally in English.',
      ja: 'ユーザーに日本語で明確かつ自然に回答してください。',
      zh: '请用中文清晰、自然地回答用户。',
      id: 'Jawab pengguna dengan jelas dan alami dalam bahasa Indonesia.'
    };

    return messages[this.currentLang] || messages[DEFAULT_LANGUAGE];
  }

  formatDateTime(date) {
    const locales = {
      ko: 'ko-KR',
      en: 'en-US',
      ja: 'ja-JP',
      zh: 'zh-CN',
      id: 'id-ID'
    };

    return new Intl.DateTimeFormat(locales[this.currentLang], {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  async init() {
    if (this.isInitialized) return this.currentLang;

    this.currentLang = this.getInitialLanguage();
    this.isInitialized = true;
    document.documentElement.lang = this.currentLang;
    this.updatePageTranslations();

    window.dispatchEvent(new CustomEvent('i18nInitialized', {
      detail: { language: this.currentLang }
    }));

    return this.currentLang;
  }
}

const i18n = new I18n();
export default i18n;
