import { AIProvider, TranslationToneSettings, ProxySettings, AILogType } from '../types';
import { StorageService } from './storageService';
export interface GenerateTextOptions {
  provider: AIProvider;
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  proxySettings?: ProxySettings;
  logType?: AILogType;
}

export const AIService = {
  async generateText(options: GenerateTextOptions): Promise<string> {
    const { provider, modelId, messages, systemPrompt, temperature = 0.7, proxySettings, logType = 'chat' } = options;

    // Build payload messages
    const fullMessages = [];
    if (systemPrompt) {
      fullMessages.push({ role: 'system', content: systemPrompt });
    }
    fullMessages.push(...messages);

    const startTime = Date.now();
    let responseText = '';
    let errorText = '';
    
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initial log: pending status
    StorageService.addAILog({
      id: logId,
      timestamp: startTime,
      providerId: provider.id,
      providerName: provider.name,
      modelId,
      type: logType,
      status: 'pending',
      requestMessages: fullMessages,
    });

    // Check if user has provided an API key
    if (!provider.apiKey) {
      // Fallback simulated response when API key is missing
      responseText = generateSimulatedResponse(messages, modelId, provider.name);
      
      StorageService.updateAILog(logId, {
        status: 'success',
        responseContent: responseText,
        durationMs: Date.now() - startTime
      });
      return responseText;
    }

    try {
      if (provider.type === 'gemini') {
        responseText = await callGeminiAPI(provider, modelId, fullMessages, temperature, proxySettings);
      } else {
        // OpenRouter, NVIDIA NIM, OpenAI, and Custom (OpenAI-compatible)
        responseText = await callOpenAICompatibleAPI(provider, modelId, fullMessages, temperature, proxySettings);
      }
      
      StorageService.updateAILog(logId, {
        status: 'success',
        responseContent: responseText,
        durationMs: Date.now() - startTime
      });
      
      return responseText;
    } catch (error: any) {
      console.error(`Error calling AI provider ${provider.name}:`, error);
      errorText = error.message || String(error);
      // Fallback to simulated message with error detail
      responseText = `⚠️ خطایی در برقراری ارتباط با ${provider.name} رخ داد:\n${errorText}\n\nپاسخ آزمایشی:\n` +
        generateSimulatedResponse(messages, modelId, provider.name);
        
      StorageService.updateAILog(logId, {
        status: 'error',
        error: errorText,
        responseContent: responseText,
        durationMs: Date.now() - startTime
      });
        
      if (logType && logType.toString().startsWith('subtitle')) {
        throw new Error(`[${provider.name}] ${errorText}`);
      }

      return responseText;
    }
  },

  async translateSubtitleText(
    text: string,
    targetLanguage: string = 'fa',
    provider: AIProvider,
    modelId: string,
    toneSettings?: TranslationToneSettings,
    proxySettings?: ProxySettings,
    isBatch: boolean = false
  ): Promise<string> {
    const langNames: Record<string, string> = {
      fa: 'Persian (Farsi / فارسی)',
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ar: 'Arabic',
      tr: 'Turkish',
      ru: 'Russian',
      zh: 'Chinese',
    };

    const targetLangName = langNames[targetLanguage] || targetLanguage;

    let toneDescription = 'colloquial modern Iranian Persian (محاوره‌ای و روان)';
    if (toneSettings) {
      switch (toneSettings.tone) {
        case 'formal':
          toneDescription = 'formal, literary and standard written Persian (کتابی و رسمی)';
          break;
        case 'educational':
          toneDescription = 'simple, clear, educational Persian suitable for language learners (ساده و آموزشی)';
          break;
        case 'technical':
          toneDescription = 'accurate technical and engineering terms in Persian (تخصصی و نرم‌افزاری)';
          break;
        case 'cinematic':
          toneDescription = 'dramatic cinematic subtitle dubbing tone in Persian (سینمایی و دوبله)';
          break;
        case 'conversational':
        default:
          toneDescription = 'colloquial modern Iranian Persian (محاوره‌ای و روان)';
          break;
      }
    }

    const rules = [
      `1. Provide ONLY the direct translated subtitle text. Do not add quotes, explanations, or notes.`,
      `2. Keep the translation concise, natural, and rhythmically aligned with spoken video speed.`,
      `3. Tone style: Use ${toneDescription}.`,
    ];

    if (toneSettings?.cleanFillers) {
      rules.push(`4. Filter out speech filler words like 'um', 'uh', 'you know', 'like' or Persian fillers 'امم', 'خب', 'یعنی'.`);
    }

    if (toneSettings?.autoFixPersianChars) {
      rules.push(`5. Ensure correct Persian orthography (use 'ی' and 'ک' instead of Arabic versions and fix punctuation).`);
    }

    if (toneSettings?.includeEmojis) {
      rules.push(`6. Optionally include a single relevant visual emoji at the start if it aids quick comprehension.`);
    }

    if (isBatch) {
      rules.push(`7. CRITICAL: The input text consists of multiple lines in the format "ID|Text". You MUST return the exact same format "ID|TranslatedText" for every line. Maintain the exact line count and the exact IDs from the input. DO NOT include the original text in your response. DO NOT add "<-" or any english words. ONLY output the translated text for each ID.
Example Input:
23|Hello there.
24|How are you?
Example Output:
23|سلام.
24|حالت چطوره؟`);
    }

    const systemPrompt = `You are an expert video subtitle translator. Translate the given video subtitle text into ${targetLangName}.\nRules:\n${rules.join('\n')}`;

    const userMessage = isBatch ? `Translate the following batch:\n${text}` : `Translate this subtitle line: "${text}"`;

    return await this.generateText({
      provider,
      modelId,
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt,
      temperature: 0.3,
      proxySettings,
      logType: isBatch ? 'subtitle_batch' : 'subtitle_translate',
    });
  },

  async translateSubtitleBatch(
    texts: string[],
    targetLanguage: string = 'fa',
    provider: AIProvider,
    modelId: string,
    toneSettings?: TranslationToneSettings,
    proxySettings?: ProxySettings
  ): Promise<string[]> {
    if (texts.length === 0) return [];

    const langNames: Record<string, string> = {
      fa: 'Persian (Farsi / فارسی)',
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ar: 'Arabic',
      tr: 'Turkish',
      ru: 'Russian',
      zh: 'Chinese',
    };
    const targetLangName = langNames[targetLanguage] || targetLanguage;

    let toneDescription = 'colloquial modern Iranian Persian (محاوره‌ای و روان)';
    if (toneSettings) {
      switch (toneSettings.tone) {
        case 'formal':
          toneDescription = 'formal, literary and standard written Persian (کتابی و رسمی)';
          break;
        case 'educational':
          toneDescription = 'simple, clear, educational Persian suitable for language learners (ساده و آموزشی)';
          break;
        case 'technical':
          toneDescription = 'accurate technical terms (تخصصی)';
          break;
        case 'cinematic':
          toneDescription = 'dramatic cinematic dubbing tone (سینمایی و دوبله)';
          break;
        case 'conversational':
        default:
          toneDescription = 'colloquial modern Iranian Persian (محاوره‌ای و روان)';
          break;
      }
    }

    const systemPrompt = `You are a professional video subtitle translator. Translate the array of subtitle lines into ${targetLangName} using tone: ${toneDescription}.
CRITICAL INSTRUCTIONS:
1. Return ONLY a valid JSON array of strings containing the translated lines, strictly corresponding 1-to-1 in exact order with the input array elements.
2. Do NOT wrap output in \`\`\`json markdown blocks or include explanations outside the JSON array. Output raw JSON array: ["translation 1", "translation 2", ...]
3. Maintain natural video subtitle flow and concise spoken style.`;

    const userMessage = JSON.stringify(texts);

    try {
      const rawResponse = await this.generateText({
        provider,
        modelId,
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt,
        temperature: 0.3,
        proxySettings,
        logType: 'subtitle_batch',
      });

      let cleanJson = rawResponse.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      }

      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        return texts.map((orig, idx) => {
          const item = parsed[idx];
          return typeof item === 'string' && item.trim() ? item.trim() : mockTranslate(orig);
        });
      }
    } catch (err) {
      console.warn('Batch translation JSON parsing failed, using fallback:', err);
    }

    // Fallback to single line translations if batch JSON parse failed
    const fallbackResults: string[] = [];
    for (const t of texts) {
      try {
        const single = await this.translateSubtitleText(t, targetLanguage, provider, modelId, toneSettings, proxySettings);
        fallbackResults.push(single);
      } catch (e) {
        fallbackResults.push(mockTranslate(t));
      }
    }
    return fallbackResults;
  }
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoffMs = 2000): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && (response.status === 429 || response.status >= 500)) {
        if (attempt < retries) {
          console.warn(`[AI Service] HTTP ${response.status} from ${url}. Retrying attempt ${attempt + 1}/${retries} in ${backoffMs}ms...`);
          await new Promise(r => setTimeout(r, backoffMs));
          backoffMs *= 1.5;
          continue;
        }
      }
      return response;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        console.warn(`[AI Service] Network error calling ${url}: ${err.message || String(err)}. Retrying attempt ${attempt + 1}/${retries} in ${backoffMs}ms...`);
        await new Promise(r => setTimeout(r, backoffMs));
        backoffMs *= 1.5;
        continue;
      }
    }
  }
  if (lastError) throw lastError;
  throw new Error('Fetch failed after retries.');
}

async function callOpenAICompatibleAPI(
  provider: AIProvider,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  proxySettings?: ProxySettings
): Promise<string> {
  let targetUrl = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  
  if (proxySettings?.enabled && proxySettings.customProxyUrl.trim()) {
    const cleanProxy = proxySettings.customProxyUrl.trim().replace(/\/$/, '');
    targetUrl = `${cleanProxy}?url=${encodeURIComponent(targetUrl)}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
  };

  if (provider.type === 'openrouter') {
    headers['HTTP-Referer'] = 'https://ai.studio';
    headers['X-Title'] = 'Chrome AI Companion Extension';
  }

  const response = await fetchWithRetry(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`[${response.status}] ${response.statusText} - ${errBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'پاسخی دریافت نشد.';
}

async function callGeminiAPI(
  provider: AIProvider,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  proxySettings?: ProxySettings
): Promise<string> {
  const cleanModel = modelId.replace('models/', '');
  let targetUrl = `${provider.baseUrl}/models/${cleanModel}:generateContent?key=${provider.apiKey}`;

  if (proxySettings?.enabled && proxySettings.customProxyUrl.trim()) {
    const cleanProxy = proxySettings.customProxyUrl.trim().replace(/\/$/, '');
    targetUrl = `${cleanProxy}?url=${encodeURIComponent(targetUrl)}`;
  }

  // Convert messages to Gemini contents structure
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = messages.find((m) => m.role === 'system');

  const body: any = {
    contents,
    generationConfig: { temperature },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction.content }],
    };
  }

  const response = await fetchWithRetry(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error [${response.status}]: ${errBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || 'پاسخی از Gemini دریافت نشد.';
}

function generateSimulatedResponse(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  providerName: string
): string {
  const lastUserMsg = messages[messages.length - 1]?.content || '';

  if (lastUserMsg.trim().startsWith('[') && lastUserMsg.trim().endsWith(']')) {
    try {
      const arr = JSON.parse(lastUserMsg);
      if (Array.isArray(arr)) {
        const translatedArr = arr.map((text: string) => mockTranslate(text));
        return JSON.stringify(translatedArr);
      }
    } catch (e) {
      // ignore
    }
  }

  if (lastUserMsg.toLowerCase().includes('translate the following batch:')) {
    const lines = lastUserMsg.split('\n');
    const translatedLines = lines.map(line => {
      const match = line.match(/^\s*(\d+)\s*\|\s*(.*)$/);
      if (match) {
        return `${match[1]}|${mockTranslate(match[2])}`;
      }
      return '';
    }).filter(l => l !== '');
    if (translatedLines.length > 0) return translatedLines.join('\n');
  }

  if (lastUserMsg.toLowerCase().includes('translate this subtitle line:')) {
    // Subtitle translation simulation
    const rawText = lastUserMsg.replace(/Translate this subtitle line: "([^"]+)"/, '$1');
    return mockTranslate(rawText);
  }

  return `[پاسخ شبیه‌سازی شده با مدل ${modelId} از ${providerName}]\n\nپیام شما دریافت شد: "${lastUserMsg}"\n\n💡 برای دریافت پاسخ واقعی از هوش مصنوعی، لطفاً کلید API ارائه دهنده (${providerName}) را در بخش «تنظیمات سرویس‌دهنده‌ها» وارد کنید. کلید به صورت امن در مرورگر شما ذخیره خواهد شد.`;
}

function mockTranslate(text: string): string {
  const translations: Record<string, string> = {
    'Welcome back to another video!': 'به یک ویدیوی دیگه خوش آمدید!',
    'Today we are building an AI Chrome extension.': 'امروز قراره یک افزونه هوش مصنوعی کروم بسازیم.',
    'It connects to OpenRouter, NVIDIA, and Gemini.': 'این افزونه به اوپن‌روتر، انویدیا و جمینای متصل میشه.',
    'You can auto-translate YouTube subtitles in real time.': 'می‌تونید زیرنویس‌های یوتیوب رو به صورت زنده ترجمه کنید.',
    'Let us get started with the code tutorial.': 'بیایید آموزش کدنویسی رو شروع کنیم.',
    'First, open your browser extension settings.': 'اول، تنظیمات افزونه مرورگرتون رو باز کنید.',
    'Select your favorite AI model and target language.': 'مدل هوش مصنوعی و زبان دلخواهتون رو انتخاب کنید.',
  };

  for (const [key, val] of Object.entries(translations)) {
    if (text.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }

  return `ترجمه زنده: ${text}`;
}
