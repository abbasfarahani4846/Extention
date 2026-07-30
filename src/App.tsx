/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header, TabType } from './components/Header';
import { AIChatStudio } from './components/AIChatStudio';
import { ProviderManager } from './components/ProviderManager';
import { SidePanel } from './components/SidePanel';
import { WebCustomizerStudio } from './components/WebCustomizerStudio';
import { SubtitleSettingsStudio } from './components/SubtitleSettingsStudio';
import { AILogsViewer } from './components/AILogsViewer';
import { StorageService } from './services/storageService';
import { AIService } from './services/aiService';

declare var chrome: any;

import { AIProvider, SubtitleStyle, ChatMessage, CustomFont, TranslationToneSettings, UILanguage, AppTheme, ProxySettings, AILog, AILogSettings } from './types';
import { downloadExtensionZip } from './services/extensionGenerator';

export default function App() {
  const [isPopup] = useState(() => {
    return window.location.pathname.includes('popup.html') || window.location.search.includes('mode=popup');
  });

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return isPopup ? 'webcustomizer' : 'chat';
  });
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(false);

  const handleOpenSidePanel = () => {
    if (typeof chrome !== 'undefined' && chrome.windows && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.windows.getCurrent((win: any) => {
        if (win && win.id) {
          chrome.sidePanel.open({ windowId: win.id }).catch((e: any) => console.error("Error opening side panel:", e));
          if (window.close) {
            setTimeout(() => window.close(), 150);
          }
        }
      });
    } else {
      window.open(window.location.origin + '/index.html?mode=sidepanel', '_blank');
    }
  };

  // Storage synced state
  const [providers, setProviders] = useState<AIProvider[]>(() => StorageService.getProviders());
  const [activeProviderId, setActiveProviderId] = useState<string>(() => StorageService.getActiveProviderId());
  const [activeModelId, setActiveModelId] = useState<string>(() => StorageService.getActiveModelId());
  const [targetLanguage, setTargetLanguage] = useState<string>(() => StorageService.getTargetLanguage());
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(() => StorageService.getSubtitleStyle());
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => StorageService.getChatHistory());
  const [customFonts, setCustomFonts] = useState<CustomFont[]>(() => StorageService.getCustomFonts());
  const [toneSettings, setToneSettings] = useState<TranslationToneSettings>(() => StorageService.getTranslationToneSettings());
  const [uiLanguage, setUiLanguage] = useState<UILanguage>(() => StorageService.getUiLanguage());
  const [appTheme, setAppTheme] = useState<AppTheme>(() => StorageService.getAppTheme());
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [proxySettings, setProxySettings] = useState<ProxySettings>(() => StorageService.getProxySettings());
  const [aiLogs, setAiLogs] = useState<AILog[]>(() => StorageService.getAILogs());
  const [logSettings, setLogSettings] = useState<AILogSettings>(() => StorageService.getAILogSettings());

  // Save changes to storage whenever state updates

  // On mount: sync chrome.storage.local → localStorage so state initializers get fresh data
  useEffect(() => {
    StorageService.initFromChromeStorage().then(() => {
      chrome.storage.local.get(['chrome_ai_target_lang'], (res) => {
        if (res.chrome_ai_target_lang) setTargetLanguage(res.chrome_ai_target_lang);
      });
      // Re-read state from storage after sync
      setProviders(StorageService.getProviders());
      setActiveProviderId(StorageService.getActiveProviderId());
      setActiveModelId(StorageService.getActiveModelId());
      setToneSettings(StorageService.getTranslationToneSettings());
      setProxySettings(StorageService.getProxySettings());
    });
  }, []);

  // Listen for ai-logs-updated event
  useEffect(() => {
    const handleLogsUpdated = () => {
      setAiLogs(StorageService.getAILogs());
    };
    window.addEventListener('ai-logs-updated', handleLogsUpdated);
    return () => window.removeEventListener('ai-logs-updated', handleLogsUpdated);
  }, []);

  useEffect(() => {
    StorageService.saveAILogSettings(logSettings);
  }, [logSettings]);

  // Connect port to background service worker + listen for translate requests

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.connect) return;

    const port = chrome.runtime.connect({ name: 'sidepanel-conn' });

    const handlePortMessage = async (msg: any) => {
      if (msg.action === 'TRANSLATE_REQUEST') {
        const { requestId, text, targetLang } = msg;

        // Read fresh settings from chrome.storage so we always have current API key/model
        let currentProvider = providers.find(p => p.id === activeProviderId);
        let currentModelId = activeModelId;

        try {
          const stored = await new Promise<any>((resolve) =>
            chrome.storage.local.get(
              ['chrome_ai_providers', 'chrome_ai_active_provider', 'chrome_ai_active_model',
               'chrome_ai_tone_settings', 'chrome_ai_proxy_settings'],
              resolve
            )
          );
          if (stored.chrome_ai_providers) {
            const storedProviders: AIProvider[] = JSON.parse(stored.chrome_ai_providers);
            const storedActiveId = stored.chrome_ai_active_provider || activeProviderId;
            const storedProvider = storedProviders.find(p => p.id === storedActiveId);
            if (storedProvider) currentProvider = storedProvider;
          }
          if (stored.chrome_ai_active_model) currentModelId = stored.chrome_ai_active_model;
        } catch (_) {/* use state values as fallback */}

        if (!currentProvider) {
          port.postMessage({ action: 'TRANSLATION_RESULT', requestId, result: { success: false, error: `سرویس دهنده فعال پیدا نشد (ID: ${activeProviderId}).` } });
          return;
        }

        // Allow bypassing API key check if proxy is enabled or provider is custom (might be a local LLM)
        let currentProxy = proxySettings;
        try {
          const stored2 = await new Promise<any>((resolve) =>
            chrome.storage.local.get(['chrome_ai_proxy_settings'], resolve)
          );
          if (stored2.chrome_ai_proxy_settings) currentProxy = JSON.parse(stored2.chrome_ai_proxy_settings);
        } catch (_) {}

        if (!currentProvider.apiKey && currentProvider.type !== 'custom' && !currentProxy?.enabled) {
          port.postMessage({ action: 'TRANSLATION_RESULT', requestId, result: { success: false, error: `کلید API برای سرویس "${currentProvider.name}" تنظیم نشده است. مطمئن شوید سرویس درست را "انتخاب" (فعال) کرده‌اید.` } });
          return;
        }

        let currentTone = toneSettings;
        try {
          const stored2 = await new Promise<any>((resolve) =>
            chrome.storage.local.get(['chrome_ai_tone_settings', 'chrome_ai_proxy_settings'], resolve)
          );
          if (stored2.chrome_ai_tone_settings) currentTone = JSON.parse(stored2.chrome_ai_tone_settings);
          if (stored2.chrome_ai_proxy_settings) currentProxy = JSON.parse(stored2.chrome_ai_proxy_settings);
        } catch (_) {/* use state values */}

        try {
          const translation = await AIService.translateSubtitleText(
            text, targetLang, currentProvider, currentModelId, currentTone, currentProxy, msg.isBatch
          );
          port.postMessage({ action: 'TRANSLATION_RESULT', requestId, result: { success: true, translation: translation.trim() } });
        } catch (err: any) {
          port.postMessage({ action: 'TRANSLATION_RESULT', requestId, result: { success: false, error: err.message || String(err) } });
        }
      }
    };

    port.onMessage.addListener(handlePortMessage);
    port.onDisconnect.addListener(() => {
      console.log('Background port disconnected, reconnecting...');
      setTimeout(() => setReconnectTrigger(prev => prev + 1), 1000);
    });

    return () => {
      try { port.disconnect(); } catch (_) {}
    };
  }, [providers, activeProviderId, activeModelId, toneSettings, proxySettings, reconnectTrigger]);


useEffect(() => {
    StorageService.saveUiLanguage(uiLanguage);
    document.documentElement.dir = uiLanguage === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  useEffect(() => {
    StorageService.saveAppTheme(appTheme);
    if (appTheme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.body.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
    }
  }, [appTheme]);

  useEffect(() => {
    StorageService.saveProxySettings(proxySettings);
  }, [proxySettings]);
  useEffect(() => {
    StorageService.saveProviders(providers);
  }, [providers]);

  useEffect(() => {
    StorageService.setActiveProviderId(activeProviderId);
  }, [activeProviderId]);

  useEffect(() => {
    StorageService.setActiveModelId(activeModelId);
  }, [activeModelId]);

  useEffect(() => {
    StorageService.setTargetLanguage(targetLanguage);
  }, [targetLanguage]);

  useEffect(() => {
    StorageService.saveSubtitleStyle(subtitleStyle);
  }, [subtitleStyle]);

  useEffect(() => {
    StorageService.saveChatHistory(chatHistory);
  }, [chatHistory]);

  useEffect(() => {
    StorageService.saveCustomFonts(customFonts);
  }, [customFonts]);

  useEffect(() => {
    StorageService.saveTranslationToneSettings(toneSettings);
  }, [toneSettings]);

  const themeClasses =
    appTheme === 'light'
      ? 'bg-slate-100 text-slate-900 selection:bg-amber-500 selection:text-white'
      : 'bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950';

  return (
    <div className={`min-h-screen font-sans flex flex-col relative overflow-hidden pb-16 md:pb-0 transition-colors duration-500 ${themeClasses}`}>
      {/* Frosted Glass Ambient Glowing Orbs */}
      {appTheme === 'light' ? (
        <>
          <div className="fixed -top-40 -left-40 w-96 h-96 bg-cyan-200/50 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="fixed top-1/3 -right-40 w-96 h-96 bg-amber-200/50 rounded-full blur-[140px] pointer-events-none z-0" />
        </>
      ) : (
        <>
          <div className="fixed -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="fixed top-1/3 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none z-0" />
          <div className="fixed -bottom-40 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-[130px] pointer-events-none z-0" />
        </>
      )}

      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidePanelOpen={isSidePanelOpen}
        setIsSidePanelOpen={setIsSidePanelOpen}
        providers={providers}
        activeProviderId={activeProviderId}
        activeModelId={activeModelId}
        onDownloadZip={downloadExtensionZip}
        uiLanguage={uiLanguage}
        setUiLanguage={setUiLanguage}
        appTheme={appTheme}
        setAppTheme={setAppTheme}
        isPopup={isPopup}
        onOpenSidePanel={handleOpenSidePanel}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 relative z-10">
        <div className="transition-all duration-300">
          {activeTab === 'chat' && (
            <AIChatStudio
              providers={providers}
              activeProviderId={activeProviderId}
              setActiveProviderId={setActiveProviderId}
              activeModelId={activeModelId}
              setActiveModelId={setActiveModelId}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              proxySettings={proxySettings}
            />
          )}

          {activeTab === 'providers' && (
            <ProviderManager
              providers={providers}
              setProviders={setProviders}
              activeProviderId={activeProviderId}
              setActiveProviderId={setActiveProviderId}
              activeModelId={activeModelId}
              setActiveModelId={setActiveModelId}
              proxySettings={proxySettings}
              setProxySettings={setProxySettings}
              uiLanguage={uiLanguage}
              setUiLanguage={setUiLanguage}
              onDownloadZip={downloadExtensionZip}
            />
          )}

          {activeTab === 'subtitles' && (
            <SubtitleSettingsStudio
              subtitleStyle={subtitleStyle}
              setSubtitleStyle={setSubtitleStyle}
              customFonts={customFonts}
              setCustomFonts={setCustomFonts}
              toneSettings={toneSettings}
              setToneSettings={setToneSettings}
              uiLanguage={uiLanguage}
              targetLanguage={targetLanguage}
              setTargetLanguage={setTargetLanguage}
            />
          )}

          {(activeTab === 'webcustomizer' || isPopup) && (
            <WebCustomizerStudio
              customFonts={customFonts}
              subtitleStyle={subtitleStyle}
              isPopup={isPopup}
            />
          )}

          {activeTab === 'logs' && (
            <AILogsViewer
              logs={aiLogs}
              onClearLogs={() => StorageService.clearAILogs()}
              logSettings={logSettings}
              onUpdateSettings={setLogSettings}
            />
          )}
        </div>

        {/* Slide-over Right SidePanel AI Chat */}
        <SidePanel
          isOpen={isSidePanelOpen}
          onClose={() => setIsSidePanelOpen(false)}
          providers={providers}
          activeProviderId={activeProviderId}
          setActiveProviderId={setActiveProviderId}
          activeModelId={activeModelId}
          setActiveModelId={setActiveModelId}
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          proxySettings={proxySettings}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950/60 backdrop-blur-xl py-4 text-center text-xs text-slate-400 dir-rtl relative z-10 hidden md:block">
        <p>
          طراحی شده به صورت مهندسی نرم‌افزار ماژولار | افزونه هوش مصنوعی کروم متصل به OpenRouter، NVIDIA NIM و Gemini
        </p>
      </footer>
    </div>
  );
}
