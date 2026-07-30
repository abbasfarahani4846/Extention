const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Find the old message listener:
const oldHookRegex = /\/\/ Listen for messages from Chrome Extension Sidepanel iframe wrapper[\s\S]*?}, \[providers, activeProviderId, activeModelId, toneSettings, proxySettings\]\);\n/m;
if (app.match(oldHookRegex)) {
  const newHook = `
  // Listen for messages from Chrome Extension
  useEffect(() => {
    const handleExtensionMessage = async (request, sender, sendResponse) => {
      if (request.action === 'FORWARD_TO_APP') {
        const payload = request.payload;
        if (payload.action === 'TRANSLATE_SUBTITLE') {
          const text = payload.text;
          const targetLang = payload.targetLang || 'fa';
          
          const currentProvider = providers.find(p => p.id === activeProviderId);
          if (!currentProvider || !currentProvider.apiKey) {
            sendResponse({ success: false, error: 'کلید API تنظیم نشده است.' });
            return true;
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
            sendResponse({ success: true, translation: translation.trim() });
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
          return true; // async
        }
      }
    };
    
    // Check if running inside Chrome Extension
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleExtensionMessage);
      return () => chrome.runtime.onMessage.removeListener(handleExtensionMessage);
    }
  }, [providers, activeProviderId, activeModelId, toneSettings, proxySettings]);
`;
  app = app.replace(oldHookRegex, newHook);
  fs.writeFileSync('src/App.tsx', app);
  console.log('App patched with chrome.runtime');
} else {
  console.log('Regex not found');
}
