// i18n Language Management Module
import { ko } from './ko.js';
import { en } from './en.js';
import { ja } from './ja.js';
import { zh } from './zh.js';

class I18n {
    constructor() {
        this.translations = { ko, en, ja, zh };
        this.currentLang = this.detectBrowserLanguage();
        this.supportedLanguages = ['ko', 'en', 'ja', 'zh'];
    }

    // Detect browser language with more comprehensive matching
    detectBrowserLanguage() {
        // Debug logging
        console.log('Browser language detection:');
        console.log('navigator.languages:', navigator.languages);
        console.log('navigator.language:', navigator.language);
        console.log('navigator.userLanguage:', navigator.userLanguage);
        
        // Get all browser languages in order of preference
        const browserLanguages = navigator.languages || [navigator.language || navigator.userLanguage || 'ko'];
        console.log('Browser languages to check:', browserLanguages);
        
        // Check each browser language in order
        for (const lang of browserLanguages) {
            if (!lang) continue;
            
            const langCode = lang.split('-')[0].toLowerCase();
            console.log(`Checking language: ${lang} -> ${langCode}`);
            
            if (this.supportedLanguages.includes(langCode)) {
                console.log(`Matched supported language: ${langCode}`);
                return langCode;
            }
            
            // Special handling for Chinese variants
            if (lang.toLowerCase().includes('zh')) {
                console.log('Matched Chinese variant');
                return 'zh';
            }
        }
        
        // Default to Korean
        console.log('No match found, defaulting to Korean');
        return 'ko';
    }

    // Set current language
    setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.error(`Language ${lang} not supported`);
            return false;
        }
        
        this.currentLang = lang;
        document.documentElement.lang = lang;
        this.updatePageTranslations();
        this.dispatchLanguageChangeEvent(lang);
        return true;
    }

    // Get current language
    getCurrentLanguage() {
        return this.currentLang;
    }

    // Get translation for a key
    t(key, lang = null) {
        const targetLang = lang || this.currentLang;
        const translations = this.translations[targetLang];
        
        if (!translations) {
            console.error(`No translations found for language: ${targetLang}`);
            return key;
        }
        
        return translations[key] || key;
    }

    // Update all page translations
    updatePageTranslations() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update aria-labels
        document.querySelectorAll('[data-i18n-aria]').forEach(element => {
            const key = element.getAttribute('data-i18n-aria');
            element.setAttribute('aria-label', this.t(key));
        });

        // Update title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.setAttribute('title', this.t(key));
        });

        // Update document title
        document.title = this.t('page.title', this.currentLang) || 'FERA - AI Platform';
    }

    // Create language selector HTML
    createLanguageSelector() {
        const selector = document.createElement('select');
        selector.id = 'language-selector';
        selector.className = 'px-3 py-1.5 text-sm rounded-lg glass-effect cursor-pointer transition-all';
        selector.setAttribute('aria-label', this.t('a11y.languageSelector'));
        
        this.supportedLanguages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = this.t(`lang.${lang}`, lang);
            option.selected = lang === this.currentLang;
            selector.appendChild(option);
        });
        
        selector.addEventListener('change', (e) => {
            this.setLanguage(e.target.value);
        });
        
        return selector;
    }
    
    // Get next language in cycle
    getNextLanguage() {
        const currentIndex = this.supportedLanguages.indexOf(this.currentLang);
        const nextIndex = (currentIndex + 1) % this.supportedLanguages.length;
        return this.supportedLanguages[nextIndex];
    }
    
    // Cycle to next language
    cycleLanguage() {
        const nextLang = this.getNextLanguage();
        this.setLanguage(nextLang);
        return nextLang;
    }

    // Dispatch language change event
    dispatchLanguageChangeEvent(lang) {
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }

    // Get message for AI based on language
    getAISystemMessage() {
        const langMessages = {
            ko: '한국어로 응답해주세요.',
            en: 'Please respond in English.',
            ja: '日本語で返答してください。',
            zh: '请用中文回复。'
        };
        return langMessages[this.currentLang] || langMessages.ko;
    }

    // Format date/time based on language
    formatDateTime(date) {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const localeMap = {
            ko: 'ko-KR',
            en: 'en-US',
            ja: 'ja-JP',
            zh: 'zh-CN'
        };
        
        return new Intl.DateTimeFormat(localeMap[this.currentLang], options).format(date);
    }

    // Initialize i18n
    init() {
        // Re-detect language when initializing (in case browser wasn't ready)
        this.currentLang = this.detectBrowserLanguage();
        
        // Set initial language
        document.documentElement.lang = this.currentLang;
        console.log(`i18n initialized with language: ${this.currentLang}`);
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.updatePageTranslations();
            });
        } else {
            this.updatePageTranslations();
        }
    }
}

// Create and export singleton instance
const i18n = new I18n();
export default i18n;