// i18n Type Definitions

export interface TranslationKeys {
  app: {
    title: string;
    subtitle: string;
    tagline: string;
  };
  nav: {
    newChat: string;
    settings: string;
    install: string;
    download: string;
  };
  chat: {
    placeholder: string;
    send: string;
    uploadFile: string;
    fileSelected: string;
    removeFile: string;
    typing: string;
    thinking: string;
  };
  settings: {
    title: string;
    language: string;
    theme: string;
    apiEndpoint: string;
    save: string;
    cancel: string;
    persona: string;
    personaPlaceholder: string;
    personaDescription: string;
  };
  message: {
    welcome: string;
    error: string;
    networkError: string;
    fileError: string;
    fileSizeError: string;
    fileTypeError: string;
    personaUpdated: string;
    copied: string;
    copyFailed: string;
  };
  pwa: {
    installTitle: string;
    installMessage: string;
    installSuccess: string;
    alreadyInstalled: string;
    notSupported: string;
  };
  errors: {
    network: {
      title: string;
      message: string;
      action: string;
    };
    auth: {
      title: string;
      message: string;
      action: string;
    };
    server: {
      title: string;
      message: string;
      action: string;
    };
    timeout: {
      title: string;
      message: string;
      action: string;
    };
    safety: {
      title: string;
      message: string;
      action: string;
    };
    file: {
      title: string;
      message: string;
      action: string;
    };
    general: {
      title: string;
      message: string;
      action: string;
    };
  };
  languages: {
    ko: string;
    en: string;
    ja: string;
    zh: string;
    id: string;
  };
}

export interface Language {
  code: string;
  name: string;
  translations: TranslationKeys;
}

export interface I18nConfig {
  supportedLanguages: string[];
  defaultLanguage: string;
  fallbackLanguage: string;
  loadPath?: string;
  cacheDuration?: number;
  detection?: {
    order: ('querystring' | 'localStorage' | 'location' | 'navigator' | 'htmlTag')[];
    caches: string[];
  };
}

export interface LocationData {
  country: string;
  country_code: string;
  region?: string;
  city?: string;
  timezone?: string;
}

export type LanguageChangeCallback = (newLang: string, oldLang: string) => void;