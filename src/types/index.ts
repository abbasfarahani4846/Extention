export type UILanguage = 'fa' | 'en';
export type AppTheme = 'dark' | 'light';

export interface ProxySettings {
  enabled: boolean;
  customProxyUrl: string;
}

export type ProviderId = 'openrouter' | 'nvidia' | 'gemini' | 'openai' | 'custom';

export interface AIProvider {
  id: string; // unique ID
  name: string;
  type: ProviderId;
  apiKey: string;
  baseUrl: string;
  modelsEndpoint: string;
  enabled: boolean;
  isCustom?: boolean;
  docsUrl?: string;
}

export interface AIModel {
  id: string;
  name: string;
  providerId: string;
  description?: string;
  contextLength?: number;
  isFree?: boolean;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelUsed?: string;
  providerUsed?: string;
}

export interface SubtitleItem {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  originalText: string;
  translatedText?: string;
  isTranslating?: boolean;
}

export type TranslationTone = 'formal' | 'conversational' | 'educational' | 'technical' | 'cinematic';

export interface TranslationToneSettings {
  tone: TranslationTone;
  cleanFillers: boolean;       // remove filler words like um, uh, یعنی
  autoFixPersianChars: boolean; // fix Arabic y/k to Persian
  includeEmojis: boolean;      // include visual emojis
  dualLayout: 'persian_top' | 'english_top' | 'persian_only' | 'english_only';
}

export interface CustomFont {
  id: string;
  name: string;
  fontFamily: string;
  dataUrl?: string; // base64 string for uploaded file
  url?: string;     // web font URL or Google font link
  isDefault?: boolean;
}

export interface SubtitleStyle {
  fontSize: number; // in px
  backgroundColor: string; // e.g. rgba(0,0,0,0.85) or hex
  textColor: string;
  secondaryTextColor?: string;
  position: 'bottom' | 'top' | 'middle';
  verticalOffset?: number; // % or px
  showDualLanguage: boolean;
  dualLayout?: 'persian_top' | 'english_top' | 'persian_only' | 'english_only';
  textDirection: 'rtl' | 'ltr' | 'auto';
  fontFamily: string;
  fontWeight?: string;
  textShadow?: boolean;
  showTranslationPrompt?: boolean;
  borderStyle?: 'none' | 'outline' | 'background_box';
  borderRadius?: number;
  paddingY?: number;
  paddingX?: number;
}

export interface ExtensionFile {
  filename: string;
  content: string;
  description: string;
  type: 'json' | 'javascript' | 'html' | 'css';
}

export type AILogType = 'chat' | 'subtitle_translate' | 'subtitle_batch';

export interface AILog {
  id: string;
  timestamp: number;
  providerId: string;
  providerName?: string;
  modelId: string;
  type: AILogType;
  status: 'pending' | 'success' | 'error';
  requestMessages: Array<{ role: string; content: string }>;
  responseContent?: string;
  error?: string;
  durationMs?: number;
}

export interface AILogSettings {
  maxLogs: number;
}

export interface DomainCustomizerSettings {
  fontEnabled?: boolean;
  rtlEnabled?: boolean;
  inputsRtl?: boolean;
  selectedFontId?: string;
  rtlMode?: 'none' | 'full_site' | 'content_only' | 'custom_selector';
  fontSizeScale?: number;
  textFontSizeScale?: number;
  fontWeight?: 'default' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  lineHeight?: 'default' | '1.4' | '1.6' | '1.8' | '2.0' | '2.2';
  customRtlSelectors?: string[];
}

export interface WebCustomizerSettings {
  enabled: boolean;
  fontEnabled?: boolean;
  rtlEnabled?: boolean;
  inputsRtl?: boolean;
  selectedFontId: string;
  applyScope: 'all_sites' | 'current_site' | 'whitelist';
  currentSiteDomain: string;
  rtlMode: 'none' | 'full_site' | 'content_only' | 'custom_selector';
  excludedDomains?: string[];
  includedDomains?: string[];
  customRtlSelectors?: { [domain: string]: string[] };
  fontSizeScale?: number;
  textFontSizeScale?: number;
  fontWeight?: 'default' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  lineHeight?: 'default' | '1.4' | '1.6' | '1.8' | '2.0' | '2.2';
  domainOverrides?: { [domain: string]: DomainCustomizerSettings };
}
