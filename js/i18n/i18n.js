// i18n Language Management Module
import { ko } from './ko.js';
import { en } from './en.js';
import { ja } from './ja.js';
import { zh } from './zh.js';
import { id } from './id.js';

class I18n {
    constructor() {
        this.translations = { ko, en, ja, zh, id };
        this.supportedLanguages = ['ko', 'en', 'ja', 'zh', 'id'];
        this.currentLang = 'ko'; // Default language
        this.isInitialized = false;
        this.initPromise = null;
    }
    
    // Get initial language from URL parameter, localStorage, location, or browser
    async getInitialLanguage() {
        // Check URL parameter first (highest priority)
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && this.supportedLanguages.includes(urlLang)) {
            localStorage.setItem('fera-language', urlLang);
            return urlLang;
        }
        
        // Check localStorage
        const storedLang = localStorage.getItem('fera-language');
        if (storedLang && this.supportedLanguages.includes(storedLang)) {
            return storedLang;
        }
        
        // Check cached location-based language (to avoid repeated API calls)
        const cachedLocationLang = localStorage.getItem('fera-location-language');
        const cacheTimestamp = localStorage.getItem('fera-location-timestamp');
        const cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (cachedLocationLang && cacheTimestamp) {
            const age = Date.now() - parseInt(cacheTimestamp);
            if (age < cacheMaxAge && this.supportedLanguages.includes(cachedLocationLang)) {
                console.log('Using cached location-based language:', cachedLocationLang);
                return cachedLocationLang;
            }
        }
        
        // Try location-based detection
        try {
            const locationLang = await this.detectLocationBasedLanguage();
            if (this.supportedLanguages.includes(locationLang)) {
                // Cache the result
                localStorage.setItem('fera-location-language', locationLang);
                localStorage.setItem('fera-location-timestamp', Date.now().toString());
                return locationLang;
            }
        } catch (error) {
            console.error('Location detection failed, falling back to browser language');
        }
        
        // Fall back to browser detection
        return this.detectBrowserLanguage();
    }

    // Detect browser language with more comprehensive matching
    detectBrowserLanguage() {
        // Get all browser languages in order of preference
        const browserLanguages = navigator.languages || [navigator.language || navigator.userLanguage || 'ko'];
        
        // Check each browser language in order
        for (const lang of browserLanguages) {
            if (!lang) continue;
            
            const langCode = lang.split('-')[0].toLowerCase();
            
            if (this.supportedLanguages.includes(langCode)) {
                return langCode;
            }
            
            // Special handling for Chinese variants
            if (lang.toLowerCase().includes('zh')) {
                return 'zh';
            }
        }
        
        // Default to Korean
        return 'ko';
    }

    // Detect language based on user's location (IP-based)
    async detectLocationBasedLanguage() {
        try {
            // Using ipapi.co free service for IP geolocation
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            console.log('Detected location:', data.country_name, data.country_code);
            
            // Map country codes to languages
            const countryToLanguage = {
                'KR': 'ko',  // South Korea
                'JP': 'ja',  // Japan
                'CN': 'zh',  // China
                'TW': 'zh',  // Taiwan
                'HK': 'zh',  // Hong Kong
                'SG': 'en',  // Singapore (English is the main language)
                'ID': 'id',  // Indonesia
                'US': 'en',  // United States
                'GB': 'en',  // United Kingdom
                'CA': 'en',  // Canada
                'AU': 'en',  // Australia
                'NZ': 'en',  // New Zealand
                'IN': 'en',  // India
                // Default to English for other countries
            };
            
            const detectedLang = countryToLanguage[data.country_code] || 'en';
            console.log('Location-based language:', detectedLang);
            
            return detectedLang;
        } catch (error) {
            console.error('Failed to detect location:', error);
            // Fall back to timezone-based detection
            return this.detectLanguageByTimezone();
        }
    }

    // Detect language based on timezone (fallback method)
    detectLanguageByTimezone() {
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            console.log('Detected timezone:', timezone);
            
            // Map timezones to languages
            if (timezone.includes('Asia/Seoul') || timezone.includes('Asia/Pyongyang')) {
                return 'ko'; // Korean timezone
            }
            if (timezone.includes('Asia/Tokyo') || timezone.includes('Asia/Osaka')) {
                return 'ja'; // Japanese timezone
            }
            if (timezone.includes('Asia/Jakarta')) {
                return 'id'; // Indonesian timezone
            }
            if (timezone.includes('Asia/Singapore')) {
                return 'en'; // Singapore uses English as main language
            }
            if (timezone.includes('Asia/Shanghai') || 
                timezone.includes('Asia/Beijing') || 
                timezone.includes('Asia/Hong_Kong') || 
                timezone.includes('Asia/Taipei')) {
                return 'zh'; // Chinese timezone
            }
            
            // For other timezones, check if they're in English-speaking regions
            const englishTimezones = [
                'America/', 'US/', 'Canada/', 'Europe/London', 
                'Australia/', 'Pacific/Auckland', 'Europe/Dublin'
            ];
            
            for (const tz of englishTimezones) {
                if (timezone.includes(tz)) {
                    return 'en';
                }
            }
            
            // Default to English for unmatched timezones
            return 'en';
        } catch (error) {
            console.error('Failed to detect timezone:', error);
            // Final fallback to Korean
            return 'ko';
        }
    }

    // Set current language
    setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.error(`Language ${lang} not supported`);
            return false;
        }
        
        this.currentLang = lang;
        localStorage.setItem('fera-language', lang);
        document.documentElement.lang = lang;
        this.updatePageTranslations();
        this.dispatchLanguageChangeEvent(lang);
        return true;
    }

    // Get current language
    getCurrentLanguage() {
        return this.isInitialized ? this.currentLang : 'ko';
    }

    // Get translation for a key
    t(key, lang = null) {
        // If not initialized yet, use default language or key
        if (!this.isInitialized) {
            const targetLang = lang || 'ko';
            const translations = this.translations[targetLang];
            return translations ? (translations[key] || key) : key;
        }
        
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
            zh: '请用中文回复。',
            id: 'Harap merespons dalam bahasa Indonesia.'
        };
        // Use current language if initialized, otherwise use default
        const lang = this.isInitialized ? this.currentLang : 'ko';
        return langMessages[lang] || langMessages.ko;
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
            zh: 'zh-CN',
            id: 'id-ID'
        };
        
        return new Intl.DateTimeFormat(localeMap[this.currentLang], options).format(date);
    }

    // Initialize i18n with async language detection
    async init() {
        // Prevent multiple initializations
        if (this.initPromise) {
            return this.initPromise;
        }
        
        this.initPromise = (async () => {
            try {
                // Get initial language asynchronously
                const detectedLang = await this.getInitialLanguage();
                this.currentLang = detectedLang;
                this.isInitialized = true;
                
                // Set language in DOM
                document.documentElement.lang = this.currentLang;
                
                // Wait for DOM to be ready
                if (document.readyState === 'loading') {
                    await new Promise(resolve => {
                        document.addEventListener('DOMContentLoaded', resolve, { once: true });
                    });
                }
                
                // Update all translations
                this.updatePageTranslations();
                
                // Dispatch initialization event
                window.dispatchEvent(new CustomEvent('i18nInitialized', { 
                    detail: { language: this.currentLang } 
                }));
                
                console.log('i18n initialized with language:', this.currentLang);
                
                return this.currentLang;
            } catch (error) {
                console.error('Failed to initialize i18n:', error);
                // Fallback to default
                this.isInitialized = true;
                document.documentElement.lang = this.currentLang;
                this.updatePageTranslations();
                return this.currentLang;
            }
        })();
        
        return this.initPromise;
    }
}

// Create and export singleton instance
const i18n = new I18n();
export default i18n;