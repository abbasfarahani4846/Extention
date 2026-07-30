import { AIModel, AIProvider, ProxySettings } from '../types';

// Curated high quality fallback models per provider for instant testing without API key or network block
export const FALLBACK_MODELS: Record<string, AIModel[]> = {
  openrouter: [
    { id: 'google/gemini-2.5-flash:free', name: 'Gemini 2.5 Flash (Free)', providerId: 'openrouter', isFree: true, contextLength: 1000000 },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', providerId: 'openrouter', isFree: true, contextLength: 131072 },
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 Reasoning (Free)', providerId: 'openrouter', isFree: true, contextLength: 64000 },
    { id: 'qwen/qwen-2.5-vl-72b-instruct:free', name: 'Qwen 2.5 VL 72B (Free)', providerId: 'openrouter', isFree: true, contextLength: 32000 },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', providerId: 'openrouter', isFree: true, contextLength: 32000 },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', providerId: 'openrouter', isFree: false, contextLength: 200000 },
    { id: 'openai/gpt-4o', name: 'GPT-4o (Omni)', providerId: 'openrouter', isFree: false, contextLength: 128000 },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openrouter', isFree: false, contextLength: 128000 },
  ],
  nvidia: [
    { id: 'meta/llama-3.3-70b-instruct', name: 'NVIDIA NIM: Llama 3.3 70B Instruct', providerId: 'nvidia', isFree: true, contextLength: 128000 },
    { id: 'deepseek-ai/deepseek-r1', name: 'NVIDIA NIM: DeepSeek R1', providerId: 'nvidia', isFree: true, contextLength: 64000 },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'NVIDIA Nemotron 70B', providerId: 'nvidia', isFree: true, contextLength: 128000 },
    { id: 'mistralai/mistral-large-2-instruct', name: 'NVIDIA NIM: Mistral Large 2', providerId: 'nvidia', isFree: true, contextLength: 128000 },
    { id: 'qwen/qwen2.5-72b-instruct', name: 'NVIDIA NIM: Qwen 2.5 72B', providerId: 'nvidia', isFree: true, contextLength: 32000 },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Google Gemini 2.5 Flash', providerId: 'gemini', isFree: true, contextLength: 1000000 },
    { id: 'gemini-2.5-pro', name: 'Google Gemini 2.5 Pro', providerId: 'gemini', isFree: false, contextLength: 2000000 },
    { id: 'gemini-1.5-flash', name: 'Google Gemini 1.5 Flash', providerId: 'gemini', isFree: true, contextLength: 1000000 },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', isFree: false, contextLength: 128000 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openai', isFree: false, contextLength: 128000 },
    { id: 'o3-mini', name: 'o3-mini Reasoning', providerId: 'openai', isFree: false, contextLength: 200000 },
  ]
};

export async function fetchModelsForProvider(
  provider: AIProvider,
  filterQuery: string = '',
  proxySettings?: ProxySettings
): Promise<{ models: AIModel[]; isLive: boolean; error?: string }> {
  let fetchedModels: AIModel[] = [];
  let isLive = false;
  let fetchError: string | undefined;

  if (provider.modelsEndpoint) {
    try {
      const headers: Record<string, string> = {};
      if (provider.apiKey) {
        if (provider.type === 'gemini') {
          // Gemini handles key in query param or bearer header
          headers['x-goog-api-key'] = provider.apiKey;
        } else {
          headers['Authorization'] = `Bearer ${provider.apiKey}`;
        }
      }

      let url = provider.modelsEndpoint;
      if (provider.type === 'gemini' && provider.apiKey && !url.includes('key=')) {
        url += `${url.includes('?') ? '&' : '?'}key=${provider.apiKey}`;
      }

      if (proxySettings?.enabled && proxySettings.customProxyUrl.trim()) {
        const cleanProxy = proxySettings.customProxyUrl.trim().replace(/\/$/, '');
        url = `${cleanProxy}?url=${encodeURIComponent(url)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        isLive = true;

        if (Array.isArray(data.data)) {
          // Standard OpenAI / OpenRouter / NVIDIA format
          fetchedModels = data.data.map((item: any) => {
            const id = item.id || item.name;
            const name = item.name || item.id;
            const isFree =
              id.includes(':free') ||
              id.toLowerCase().includes('free') ||
              (item.pricing && (item.pricing.prompt === '0' || item.pricing.prompt === 0));

            return {
              id,
              name: name || id,
              providerId: provider.id,
              description: item.description || '',
              contextLength: item.context_length || item.max_tokens,
              isFree: Boolean(isFree),
              pricing: item.pricing,
            };
          });
        } else if (Array.isArray(data.models)) {
          // Gemini format
          fetchedModels = data.models.map((item: any) => {
            const nameClean = item.name ? item.name.replace('models/', '') : item.displayName;
            return {
              id: nameClean,
              name: item.displayName || nameClean,
              providerId: provider.id,
              description: item.description || '',
              contextLength: item.inputTokenLimit || 1000000,
              isFree: true,
            };
          });
        }
      } else {
        fetchError = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (err: any) {
      console.warn(`Could not live-fetch models for ${provider.name}:`, err);
      fetchError = err.message || 'Network error fetching models';
    }
  }

  // If dynamic fetch yielded no models or failed, use fallback set
  if (fetchedModels.length === 0) {
    const fallback = FALLBACK_MODELS[provider.type] || FALLBACK_MODELS['openrouter'];
    fetchedModels = fallback.map((m) => ({
      ...m,
      providerId: provider.id,
    }));
  }

  // Apply optional search & free filter
  let filtered = fetchedModels;
  if (filterQuery && filterQuery.trim() !== '') {
    const query = filterQuery.trim().toLowerCase();
    
    if (query === 'free' || query === 'رایگان') {
      filtered = filtered.filter(
        (m) =>
          m.isFree ||
          m.id.toLowerCase().includes('free') ||
          m.name.toLowerCase().includes('free')
      );
    } else {
      filtered = filtered.filter(
        (m) =>
          m.id.toLowerCase().includes(query) ||
          m.name.toLowerCase().includes(query) ||
          (m.description && m.description.toLowerCase().includes(query))
      );
    }
  }

  return {
    models: filtered,
    isLive,
    error: fetchError,
  };
}
