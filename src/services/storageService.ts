import { AIProvider, SubtitleStyle, ChatMessage, CustomFont, TranslationToneSettings, UILanguage, AppTheme, ProxySettings, AILog, AILogSettings, WebCustomizerSettings } from '../types';
import { IRANSANS_DATA_URL, IRANSANSX_DATA_URL } from './defaultFontsData';

declare var chrome: any;

const STORAGE_KEYS = {
  PROVIDERS: 'chrome_ai_providers',
  ACTIVE_PROVIDER: 'chrome_ai_active_provider',
  ACTIVE_MODEL: 'chrome_ai_active_model',
  CHAT_HISTORY: 'chrome_ai_chat_history',
  TARGET_LANG: 'chrome_ai_target_lang',
  SUBTITLE_STYLE: 'chrome_ai_subtitle_style',
  CUSTOM_FONTS: 'chrome_ai_custom_fonts',
  TONE_SETTINGS: 'chrome_ai_tone_settings',
  UI_LANGUAGE: 'chrome_ai_ui_language',
  APP_THEME: 'chrome_ai_app_theme',
  PROXY_SETTINGS: 'chrome_ai_proxy_settings',
  AI_LOGS: 'chrome_ai_logs',
  AI_LOG_SETTINGS: 'chrome_ai_log_settings',
  WEB_CUSTOMIZER: 'chrome_ai_web_customizer',
};

const DEFAULT_WEB_CUSTOMIZER: WebCustomizerSettings = {
  enabled: false,
  fontEnabled: true,
  rtlEnabled: true,
  inputsRtl: true,
  selectedFontId: 'vazirmatn',
  applyScope: 'all_sites',
  currentSiteDomain: 'chatgpt.com',
  rtlMode: 'content_only',
  excludedDomains: [],
  includedDomains: [],
  customRtlSelectors: {},
  fontSizeScale: 100,
  textFontSizeScale: 100,
  fontWeight: 'default',
  lineHeight: 'default',
  domainOverrides: {},
};

// Write to both localStorage and chrome.storage.local (if available)
function storageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch (_) {}
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [key]: value });
    }
  } catch (_) {}
}

// Read from localStorage (sync), chrome.storage is async so we read it on app init separately
function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}


export const DEFAULT_CUSTOM_FONTS: CustomFont[] = [
  {
    id: 'vazirmatn',
    name: 'وزیرمتن (Vazirmatn)',
    fontFamily: 'Vazirmatn, sans-serif',
    url: 'https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Vazirmatn-font-face.css',
    isDefault: true,
  },
  {
    id: 'shabnam',
    name: 'شبنم (Shabnam)',
    fontFamily: 'Shabnam, Vazirmatn, sans-serif',
    url: 'https://cdn.jsdelivr.net/npm/shabnam-font@5.0.2/dist/font-face.css',
    isDefault: true,
  },
  {
    id: 'sahel',
    name: 'ساحل (Sahel)',
    fontFamily: 'Sahel, Vazirmatn, sans-serif',
    url: 'https://cdn.jsdelivr.net/npm/sahel-font@3.4.0/dist/font-face.css',
    isDefault: true,
  },
  {
    id: 'lalezar',
    name: 'لاله‌زار (Lalezar)',
    fontFamily: 'Lalezar, cursive, Vazirmatn',
    url: 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap',
    isDefault: true,
  },
  {
    id: 'samim',
    name: 'صمیم (Samim)',
    fontFamily: 'Samim, Vazirmatn, sans-serif',
    url: 'https://cdn.jsdelivr.net/npm/samim-font@4.0.5/dist/font-face.css',
    isDefault: true,
  },
  {
    id: 'iransans',
    name: 'ایران سنس (IRAN Sans)',
    fontFamily: 'IRANSans, "IRAN Sans", Vazirmatn, sans-serif',
    dataUrl: IRANSANS_DATA_URL,
    isDefault: true,
  },
  {
    id: 'iransansx',
    name: 'ایران سنس ایکس (IRAN Sans X)',
    fontFamily: 'IRANSansX, "IRAN SansX", Vazirmatn, sans-serif',
    dataUrl: IRANSANSX_DATA_URL,
    isDefault: true,
  },
  {
    id: 'system_sans',
    name: 'سیستم استاندارد (System Sans)',
    fontFamily: 'system-ui, -apple-[system], BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    isDefault: true,
  },
  {
    id: 'monospace',
    name: 'کد و تک‌فاصله (Monospace)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    isDefault: true,
  },
];

export const DEFAULT_TONE_SETTINGS: TranslationToneSettings = {
  tone: 'conversational',
  cleanFillers: true,
  autoFixPersianChars: true,
  includeEmojis: false,
  dualLayout: 'persian_top',
};

export const DEFAULT_LOG_SETTINGS: AILogSettings = {
  maxLogs: 200,
};

export const DEFAULT_PROVIDERS: AIProvider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter AI',
    type: 'openrouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    enabled: true,
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM (Build.NVIDIA)',
    type: 'nvidia',
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    modelsEndpoint: 'https://integrate.api.nvidia.com/v1/models',
    enabled: true,
    docsUrl: 'https://build.nvidia.com',
  },
  {
    id: 'gemini',
    name: 'Google Gemini AI',
    type: 'gemini',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    enabled: true,
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'openai',
    name: 'OpenAI (Official)',
    type: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    enabled: true,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
];

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 20,
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  textColor: '#FFFFFF',
  position: 'bottom',
  showDualLanguage: true,
  textDirection: 'rtl', // Farsi / Persian default
  fontFamily: 'Vazirmatn, Tahoma, sans-serif',
  showTranslationPrompt: true,
};

export const StorageService = {
  // Call once on app start to sync chrome.storage.local → localStorage
  async initFromChromeStorage(): Promise<void> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
      const data = await new Promise<any>((resolve) =>
        chrome.storage.local.get(null, resolve)
      );
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          try { localStorage.setItem(key, value); } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Error syncing from chrome.storage:', e);
    }
  },

  getProviders(): AIProvider[] {
    try {
      const saved = storageGet(STORAGE_KEYS.PROVIDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading providers from storage:', e);
    }
    return DEFAULT_PROVIDERS;
  },

  saveProviders(providers: AIProvider[]): void {
    try {
      storageSet(STORAGE_KEYS.PROVIDERS, JSON.stringify(providers));
    } catch (e) {
      console.error('Error saving providers:', e);
    }
  },

  getActiveProviderId(): string {
    return storageGet(STORAGE_KEYS.ACTIVE_PROVIDER) || 'openrouter';
  },

  setActiveProviderId(id: string): void {
    storageSet(STORAGE_KEYS.ACTIVE_PROVIDER, id);
  },

  getActiveModelId(): string {
    return storageGet(STORAGE_KEYS.ACTIVE_MODEL) || 'google/gemini-2.5-flash:free';
  },

  setActiveModelId(modelId: string): void {
    storageSet(STORAGE_KEYS.ACTIVE_MODEL, modelId);
  },

  getTargetLanguage(): string {
    return storageGet(STORAGE_KEYS.TARGET_LANG) || 'fa';
  },

  setTargetLanguage(lang: string): void {
    storageSet(STORAGE_KEYS.TARGET_LANG, lang);
  },

  getSubtitleStyle(): SubtitleStyle {
    try {
      const saved = storageGet(STORAGE_KEYS.SUBTITLE_STYLE);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading subtitle style:', e);
    }
    return DEFAULT_SUBTITLE_STYLE;
  },

  saveSubtitleStyle(style: SubtitleStyle): void {
    storageSet(STORAGE_KEYS.SUBTITLE_STYLE, JSON.stringify(style));
  },

  getCustomFonts(): CustomFont[] {
    try {
      const saved = storageGet(STORAGE_KEYS.CUSTOM_FONTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const customOnly = parsed.filter((f: CustomFont) => !f.isDefault);
          return [...DEFAULT_CUSTOM_FONTS, ...customOnly];
        }
      }
    } catch (e) {
      console.error('Error reading custom fonts:', e);
    }
    return DEFAULT_CUSTOM_FONTS;
  },

  saveCustomFonts(fonts: CustomFont[]): void {
    try {
      storageSet(STORAGE_KEYS.CUSTOM_FONTS, JSON.stringify(fonts));
    } catch (e) {
      console.error('Error saving custom fonts:', e);
    }
  },

  getTranslationToneSettings(): TranslationToneSettings {
    try {
      const saved = storageGet(STORAGE_KEYS.TONE_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading tone settings:', e);
    }
    return DEFAULT_TONE_SETTINGS;
  },

  saveTranslationToneSettings(settings: TranslationToneSettings): void {
    try {
      storageSet(STORAGE_KEYS.TONE_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving tone settings:', e);
    }
  },

  getUiLanguage(): UILanguage {
    try {
      const saved = storageGet(STORAGE_KEYS.UI_LANGUAGE);
      if (saved === 'en' || saved === 'fa') return saved;
    } catch (e) {
      console.error('Error reading UI language:', e);
    }
    return 'fa';
  },

  saveUiLanguage(lang: UILanguage): void {
    try {
      storageSet(STORAGE_KEYS.UI_LANGUAGE, lang);
    } catch (e) {
      console.error('Error saving UI language:', e);
    }
  },

  getAppTheme(): AppTheme {
    try {
      const saved = storageGet(STORAGE_KEYS.APP_THEME);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {
      console.error('Error reading app theme:', e);
    }
    return 'dark';
  },

  saveAppTheme(theme: AppTheme): void {
    try {
      storageSet(STORAGE_KEYS.APP_THEME, theme);
    } catch (e) {
      console.error('Error saving app theme:', e);
    }
  },

  getProxySettings(): ProxySettings {
    try {
      const saved = storageGet(STORAGE_KEYS.PROXY_SETTINGS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error reading proxy settings:', e);
    }
    return { enabled: false, customProxyUrl: '' };
  },

  saveProxySettings(settings: ProxySettings): void {
    try {
      storageSet(STORAGE_KEYS.PROXY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving proxy settings:', e);
    }
  },

  getChatHistory(): ChatMessage[] {
    try {
      const saved = storageGet(STORAGE_KEYS.CHAT_HISTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any, idx: number) => ({
            id: item.id || `msg_${idx}_${Date.now()}`,
            role: item.role === 'user' ? 'user' : 'assistant',
            content: typeof item.content === 'string' ? item.content : (item.text || ''),
            timestamp: item.timestamp || Date.now(),
            modelUsed: item.modelUsed,
            providerUsed: item.providerUsed,
          }));
        }
      }
    } catch (e) {
      console.error('Error reading chat history:', e);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'سلام! من دستیار هوش مصنوعی افزونه شما هستم. چطور می‌تونم کمکتون کنم؟\n\nمی‌تونید کلیدهای API رو وارد کنید، مدل‌های رایگان مثل OpenRouter یا NVIDIA NIM رو لود کنید و زیرنویس ویدیوهای یوتیوب رو به فارسی یا زبان‌های دیگه ترجمه کنید.',
        timestamp: Date.now(),
      }
    ];
  },

  saveChatHistory(chats: ChatMessage[]): void {
    try {
      storageSet(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(chats));
    } catch (e) {
      console.error('Error saving chat history:', e);
    }
  },

  getAILogSettings(): AILogSettings {
    try {
      const saved = storageGet(STORAGE_KEYS.AI_LOG_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading log settings:', e);
    }
    return DEFAULT_LOG_SETTINGS;
  },

  saveAILogSettings(settings: AILogSettings): void {
    try {
      storageSet(STORAGE_KEYS.AI_LOG_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving log settings:', e);
    }
  },

  getAILogs(): AILog[] {
    try {
      const saved = storageGet(STORAGE_KEYS.AI_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading AI logs:', e);
    }
    return [];
  },

  saveAILogs(logs: AILog[]): void {
    try {
      storageSet(STORAGE_KEYS.AI_LOGS, JSON.stringify(logs));
      // Dispatch event to notify UI
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ai-logs-updated'));
      }
    } catch (e) {
      console.error('Error saving AI logs:', e);
    }
  },

  addAILog(log: AILog): void {
    const logs = this.getAILogs();
    logs.unshift(log); // Add to beginning (newest first)
    
    const settings = this.getAILogSettings();
    if (logs.length > settings.maxLogs) {
      logs.splice(settings.maxLogs);
    }
    
    this.saveAILogs(logs);
  },

  updateAILog(id: string, updates: Partial<AILog>): void {
    const logs = this.getAILogs();
    const index = logs.findIndex(l => l.id === id);
    if (index !== -1) {
      logs[index] = { ...logs[index], ...updates };
      this.saveAILogs(logs);
    }
  },

  clearAILogs(): void {
    this.saveAILogs([]);
  },

  getWebCustomizerSettings(): WebCustomizerSettings {
    try {
      const saved = storageGet(STORAGE_KEYS.WEB_CUSTOMIZER);
      if (saved) return { ...DEFAULT_WEB_CUSTOMIZER, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Error reading web customizer settings:', e);
    }
    return DEFAULT_WEB_CUSTOMIZER;
  },

  saveWebCustomizerSettings(settings: WebCustomizerSettings): void {
    try {
      storageSet(STORAGE_KEYS.WEB_CUSTOMIZER, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving web customizer settings:', e);
    }
  }
};

