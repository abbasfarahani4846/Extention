const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

const importRegex = /import { AIService } from '\.\/services\/aiService';/;
if (!importRegex.test(app)) {
  app = app.replace(
    "import { AIProvider, SubtitleStyle",
    "import { AIService } from './services/aiService';\nimport { AIProvider, SubtitleStyle"
  );
}

const useEffectHook = `
  // Listen for messages from Chrome Extension Sidepanel iframe wrapper
  useEffect(() => {
    const handleExtensionMessage = async (event) => {
      if (event.data && event.data.type === 'TRANSLATE_REQUEST') {
        const { id, payload } = event.data;
        if (payload.action === 'TRANSLATE_SUBTITLE') {
          const text = payload.text;
          const targetLang = payload.targetLang || 'fa';
          
          const currentProvider = providers.find(p => p.id === activeProviderId);
          if (!currentProvider || !currentProvider.apiKey) {
            window.parent.postMessage({
              type: 'TRANSLATE_RESPONSE',
              id,
              result: { success: false, error: 'کلید API تنظیم نشده است.' }
            }, '*');
            return;
          }

          try {
            const translation = await AIService.translateSubtitleText(
              text,
              targetLang,
              currentProvider,
              activeModelId,
              toneSettings,
              proxySettings
            );
            window.parent.postMessage({
              type: 'TRANSLATE_RESPONSE',
              id,
              result: { success: true, translation: translation.trim() }
            }, '*');
          } catch (err) {
            window.parent.postMessage({
              type: 'TRANSLATE_RESPONSE',
              id,
              result: { success: false, error: err.message }
            }, '*');
          }
        }
      }
    };
    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, [providers, activeProviderId, activeModelId, toneSettings, proxySettings]);

`;

// Insert after the existing useEffects
const marker = "useEffect(() => {\n    StorageService.saveUiLanguage(uiLanguage);";
app = app.replace(marker, useEffectHook + marker);

fs.writeFileSync('src/App.tsx', app);
console.log("App patched.");
