import React, { useState, useEffect } from 'react';
import {
  Key,
  Globe,
  RefreshCw,
  Search,
  Filter,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Download
} from 'lucide-react';
import { AIModel, AIProvider, ProxySettings, UILanguage } from '../types';
import { fetchModelsForProvider } from '../services/modelFetcher';
import { getTranslation } from '../services/i18n';
import { Copy, ShieldCheck, Terminal, Code } from 'lucide-react';

interface ProviderManagerProps {
  providers: AIProvider[];
  setProviders: (providers: AIProvider[]) => void;
  activeProviderId: string;
  setActiveProviderId: (id: string) => void;
  activeModelId: string;
  setActiveModelId: (modelId: string) => void;
  proxySettings: ProxySettings;
  setProxySettings: (settings: ProxySettings) => void;
  uiLanguage?: UILanguage;
  setUiLanguage?: (lang: UILanguage) => void;
  onDownloadZip?: () => void;
}

export const ProviderManager: React.FC<ProviderManagerProps> = ({
  providers,
  setProviders,
  activeProviderId,
  setActiveProviderId,
  activeModelId,
  setActiveModelId,
  proxySettings,
  setProxySettings,
  uiLanguage = 'fa',
  setUiLanguage,
  onDownloadZip,
}) => {
  const t = getTranslation(uiLanguage);
  const [copiedWorkerCode, setCopiedWorkerCode] = useState<boolean>(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(activeProviderId);
  const [filterQuery, setFilterQuery] = useState<string>('free'); // default filter keyword as requested
  const [loadedModels, setLoadedModels] = useState<AIModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [isLiveConnection, setIsLiveConnection] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  // Form state for adding custom provider
  const [showAddCustomModal, setShowAddCustomModal] = useState<boolean>(false);
  const [newProviderName, setNewProviderName] = useState<string>('');
  const [newBaseUrl, setNewBaseUrl] = useState<string>('https://api.openai.com/v1');
  const [newModelsEndpoint, setNewModelsEndpoint] = useState<string>('https://api.openai.com/v1/models');
  const [newApiKey, setNewApiKey] = useState<string>('');

  const currentProvider = providers.find((p) => p.id === selectedProviderId) || providers[0];

  // Load models whenever selected provider or filter query changes
  useEffect(() => {
    if (currentProvider) {
      loadProviderModels(currentProvider, filterQuery);
    }
  }, [selectedProviderId, filterQuery]);

  const loadProviderModels = async (provider: AIProvider, query: string) => {
    setIsLoadingModels(true);
    setFetchError(null);
    try {
      const result = await fetchModelsForProvider(provider, query, proxySettings);
      setLoadedModels(result.models);
      setIsLiveConnection(result.isLive);
      if (result.error) {
        setFetchError(result.error);
      }
    } catch (err: any) {
      setFetchError(err.message || 'Error fetching models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleUpdateProviderField = (id: string, field: keyof AIProvider, value: any) => {
    const updated = providers.map((p) => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setProviders(updated);
  };

  const handleAddCustomProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderName.trim()) return;

    const newProvider: AIProvider = {
      id: `custom_${Date.now()}`,
      name: newProviderName.trim(),
      type: 'custom',
      apiKey: newApiKey.trim(),
      baseUrl: newBaseUrl.trim(),
      modelsEndpoint: newModelsEndpoint.trim(),
      enabled: true,
      isCustom: true,
    };

    const updated = [...providers, newProvider];
    setProviders(updated);
    setSelectedProviderId(newProvider.id);

    // Reset modal
    setNewProviderName('');
    setNewApiKey('');
    setShowAddCustomModal(false);
  };

  const handleDeleteProvider = (id: string) => {
    if (providers.length <= 1) return;
    const updated = providers.filter((p) => p.id !== id);
    setProviders(updated);
    if (selectedProviderId === id) {
      setSelectedProviderId(updated[0].id);
    }
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const workerCodeSnippet = `// Standard CORS & API Relay Worker for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    // Handle CORS preflight options request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ status: "active", message: "Worker proxy operational" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const forwardHeaders = new Headers(request.headers);
      forwardHeaders.delete("host");

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? null : await request.arrayBuffer(),
      });

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Headers", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};`;

  const handleCopyWorkerCode = () => {
    navigator.clipboard.writeText(workerCodeSnippet);
    setCopiedWorkerCode(true);
    setTimeout(() => setCopiedWorkerCode(false), 3000);
  };

  return (
    <div className={`space-y-6 ${uiLanguage === 'fa' ? 'dir-rtl text-right' : 'dir-ltr text-left'}`}>
      {/* Proxy Settings Card */}
      <div className="bg-slate-900/40 backdrop-blur-2xl p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30 backdrop-blur-md">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{t.proxySettingsTitle}</span>
                <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md font-mono">
                  Workers & Pages Relay
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {t.proxySettingsSubtitle}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
            <input
              type="checkbox"
              checked={proxySettings.enabled}
              onChange={(e) =>
                setProxySettings({ ...proxySettings, enabled: e.target.checked })
              }
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-200">
              {t.enableProxyLabel}
            </span>
          </label>
        </div>

        {/* Input for Worker Proxy URL */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            {t.proxyUrlLabel}
          </label>
          <input
            type="text"
            value={proxySettings.customProxyUrl}
            onChange={(e) =>
              setProxySettings({ ...proxySettings, customProxyUrl: e.target.value })
            }
            placeholder={t.proxyUrlPlaceholder}
            className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono dir-ltr text-left text-cyan-300 focus:outline-none focus:border-cyan-500 backdrop-blur-md"
          />
        </div>

        {/* Cloudflare Worker Deployment & Setup Guide */}
        <div className="bg-slate-950/60 backdrop-blur-md p-4 rounded-xl border border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Terminal className="w-4 h-4" />
              <span>{t.cloudflareGuideTitle}</span>
            </div>
            <a
              href="https://dash.cloudflare.com/?to=/:account/workers-and-pages"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.cloudflareLinkBtn}</span>
            </a>
          </div>

          <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
            {t.cloudflareGuideText}
          </p>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono">
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                worker.js
              </span>
              <button
                onClick={handleCopyWorkerCode}
                className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
              >
                {copiedWorkerCode ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.codeCopied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t.copyCodeBtn}</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3 bg-slate-900 border border-white/10 rounded-xl text-[11px] font-mono text-cyan-200 dir-ltr text-left overflow-x-auto max-h-40 leading-normal select-all">
              {workerCodeSnippet}
            </pre>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {setUiLanguage && (
            <button
              onClick={() => setUiLanguage(uiLanguage === 'fa' ? 'en' : 'fa')}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              title="تغییر زبان محیط / Switch UI Language"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>{uiLanguage === 'fa' ? 'زبان: فارسی 🇮🇷 (تغییر به انگلیسی)' : 'Language: English 🇬🇧 (Switch to Persian)'}</span>
            </button>
          )}

          {onDownloadZip && (
            <button
              onClick={onDownloadZip}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-500 backdrop-blur-md border border-emerald-400/30 text-white rounded-xl text-xs font-medium shadow-lg shadow-emerald-950/30 transition-all cursor-pointer"
              title="دانلود کل پکیج افزونه کروم"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">دانلود افزونه</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAddCustomModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 backdrop-blur-md font-medium text-xs rounded-xl shadow-lg shadow-cyan-950/30 transition-all cursor-pointer whitespace-nowrap mr-auto sm:mr-0"
        >
          <Plus className="w-4 h-4" />
          <span>{uiLanguage === 'fa' ? 'افزودن ارائه دهنده جدید' : 'Add Custom Provider'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Provider List Navigation (Left/Right) */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            سرویس‌های هوش مصنوعی فعال
          </h3>

          <div className="space-y-2">
            {providers.map((prov) => {
              const isSelected = prov.id === selectedProviderId;
              const isActive = prov.id === activeProviderId;

              return (
                <div
                  key={prov.id}
                  onClick={() => setSelectedProviderId(prov.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between backdrop-blur-xl ${
                    isSelected
                      ? 'bg-slate-800/60 border-cyan-500/80 shadow-lg shadow-cyan-950/30'
                      : 'bg-slate-900/30 border-white/10 hover:border-white/20 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm backdrop-blur-md ${
                        prov.type === 'openrouter'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : prov.type === 'nvidia'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : prov.type === 'gemini'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {prov.name.substring(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100">{prov.name}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md backdrop-blur-md">
                            فعال
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono dir-ltr block text-left">
                        {prov.apiKey ? '🔑 Key Set' : '⚠️ کلید وارد نشده'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {isActive ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveProviderId(prov.id);
                        }}
                        className="px-2.5 py-1 text-[11px] bg-slate-800/80 hover:bg-cyan-600 hover:text-white text-slate-300 rounded-lg transition-colors border border-white/10"
                        title="تنظیم به عنوان سرویس اصلی"
                      >
                        انتخاب
                      </button>
                    )}

                    {prov.isCustom && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProvider(prov.id);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        title="حذف سرویس سفارشی"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Provider Config & Live Model Fetcher */}
        <div className="lg:col-span-8 space-y-6">
          {currentProvider && (
            <div className="bg-slate-900/40 backdrop-blur-2xl p-5 rounded-2xl border border-white/10 space-y-5 shadow-2xl">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-800/60 rounded-xl border border-white/10 backdrop-blur-md">
                    <Key className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">{currentProvider.name}</h3>
                    <p className="text-xs text-slate-400">تنظیمات کلید API و آدرس فراخوانی مدل‌ها</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {currentProvider.id !== activeProviderId && (
                    <button
                      onClick={() => setActiveProviderId(currentProvider.id)}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all animate-pulse"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>فعال‌سازی این سرویس</span>
                    </button>
                  )}
                  {currentProvider.docsUrl && (
                    <a
                      href={currentProvider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium bg-cyan-950/40 px-3 py-1.5 rounded-xl border border-cyan-900/50"
                    >
                      <span>دریافت API Key</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {currentProvider.id !== activeProviderId && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 text-amber-300/90 text-xs">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
                  <p className="leading-relaxed">
                    <strong>توجه:</strong> شما در حال ویرایش تنظیمات یک سرویس غیرفعال هستید. 
                    برای استفاده از این سرویس در ترجمه، روی دکمه «فعال‌سازی این سرویس» کلیک کنید.
                  </p>
                </div>
              )}

              {/* Form Inputs: API Key, Base URL, Models Endpoint */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* API Key Input */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>کلید اختصاصی (API Key):</span>
                    <span className="text-[11px] text-slate-400">به صورت امن در مرورگر ذخیره می‌شود</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey[currentProvider.id] ? 'text' : 'password'}
                      value={currentProvider.apiKey}
                      onChange={(e) =>
                        handleUpdateProviderField(currentProvider.id, 'apiKey', e.target.value)
                      }
                      placeholder={
                        currentProvider.type === 'openrouter'
                          ? 'sk-or-v1-...'
                          : currentProvider.type === 'nvidia'
                          ? 'nvapi-...'
                          : currentProvider.type === 'gemini'
                          ? 'AIzaSy...'
                          : 'sk-...'
                      }
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500/60 backdrop-blur-md transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowApiKey(currentProvider.id)}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showApiKey[currentProvider.id] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Base API URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">لینک اصلی API (Base URL):</label>
                  <input
                    type="text"
                    value={currentProvider.baseUrl}
                    onChange={(e) =>
                      handleUpdateProviderField(currentProvider.id, 'baseUrl', e.target.value)
                    }
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono dir-ltr text-left focus:outline-none focus:border-cyan-500/60 backdrop-blur-md"
                  />
                </div>

                {/* Models Fetch Endpoint */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    لینک دریافت لیست مدل‌ها (Models Endpoint):
                  </label>
                  <input
                    type="text"
                    value={currentProvider.modelsEndpoint}
                    onChange={(e) =>
                      handleUpdateProviderField(currentProvider.id, 'modelsEndpoint', e.target.value)
                    }
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono dir-ltr text-left focus:outline-none focus:border-cyan-500/60 backdrop-blur-md"
                  />
                </div>
              </div>

              {/* Dynamic Models Inspector & Filter Query */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-sm text-white">مدل‌های بارگذاری شده</h4>
                    <span className="px-2 py-0.5 text-[10px] bg-slate-800/60 text-slate-300 rounded-full font-mono border border-white/10 backdrop-blur-md">
                      {loadedModels.length} مدل
                    </span>

                    {isLiveConnection ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full backdrop-blur-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        لایو API
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full backdrop-blur-md">
                        کاتالوگ پیش‌فرض
                      </span>
                    )}
                  </div>

                  {/* Filter Keyword Input */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                      <input
                        type="text"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder='فیلتر مثلا: free یا llama...'
                        className="w-full bg-slate-950/60 border border-white/10 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 backdrop-blur-md"
                      />
                    </div>

                    <button
                      onClick={() => setFilterQuery('free')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                        filterQuery === 'free'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-800/50 text-slate-300 border-white/10 hover:bg-slate-800'
                      }`}
                      title="فیلتر اختصاصی فقط مدل‌های رایگان"
                    >
                      🆓 مدل‌های Free
                    </button>

                    <button
                      onClick={() => loadProviderModels(currentProvider, filterQuery)}
                      disabled={isLoadingModels}
                      className="p-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 rounded-xl border border-white/10 backdrop-blur-md cursor-pointer disabled:opacity-50"
                      title="بارگذاری مجدد مدل‌ها از API"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModels ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {fetchError && (
                  <div className="p-3 bg-rose-950/40 backdrop-blur-md border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{fetchError} (از کاتالوگ مدل‌های جایگزین برای تست استفاده شد)</span>
                  </div>
                )}

                {/* Model Cards Grid */}
                {isLoadingModels ? (
                  <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                    <span>در حال فراخوانی هوشمند لیست مدل‌ها...</span>
                  </div>
                ) : loadedModels.length === 0 ? (
                  <div className="py-8 text-center bg-slate-950/30 backdrop-blur-md rounded-xl border border-white/10 text-slate-400 text-xs">
                    هیچ مدلی با فیلتر «{filterQuery}» پیدا نشد. عبارت فیلتر را تغییر دهید.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {loadedModels.map((model) => {
                      const isSelectedModel = activeModelId === model.id;

                      return (
                        <div
                          key={model.id}
                          onClick={() => setActiveModelId(model.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between backdrop-blur-md ${
                            isSelectedModel
                              ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/40'
                              : 'bg-slate-950/40 border-white/10 hover:border-white/20 hover:bg-slate-900/50'
                          }`}
                        >
                          <div className="space-y-0.5 overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs text-slate-100 truncate">
                                {model.name}
                              </span>
                              {model.isFree && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                                  FREE
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono dir-ltr text-left block truncate">
                              {model.id}
                            </span>
                          </div>

                          <div className="shrink-0 mr-2">
                            {isSelectedModel ? (
                              <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-1 rounded-lg border border-white/10 hover:bg-slate-700">
                                انتخاب
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Provider Modal */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl dir-rtl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>افزودن سرویس هوش مصنوعی جدید (Custom API)</span>
            </h3>
            <p className="text-xs text-slate-400">
              می‌توانید هر سرویس سازگار با الگوی OpenAI (مانند Ollama, LocalAI, vLLM یا پروکسی اختصاصی) را اضافه کنید.
            </p>

            <form onSubmit={handleAddCustomProvider} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  نام سرویس:
                </label>
                <input
                  type="text"
                  required
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  placeholder="مثلا: Local Ollama یا My AI Server"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 backdrop-blur-md"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  آدرس پایه (Base URL):
                </label>
                <input
                  type="text"
                  required
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono dir-ltr text-left text-white focus:outline-none focus:border-cyan-500 backdrop-blur-md"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  لینک دریافت مدل‌ها (Models Endpoint):
                </label>
                <input
                  type="text"
                  required
                  value={newModelsEndpoint}
                  onChange={(e) => setNewModelsEndpoint(e.target.value)}
                  placeholder="http://localhost:11434/v1/models"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono dir-ltr text-left text-white focus:outline-none focus:border-cyan-500 backdrop-blur-md"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  کلید API (در صورت نیاز):
                </label>
                <input
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="اختیاری برای سرورهای محلی..."
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono backdrop-blur-md"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 backdrop-blur-md rounded-xl text-xs font-semibold"
                >
                  افزودن و ذخيره
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
