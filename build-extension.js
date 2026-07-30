import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  console.error("dist folder not found");
  process.exit(1);
}

const manifestJson = {
  manifest_version: 3,
  name: "AI Chrome Companion (SidePanel)",
  version: "1.0.0",
  description: "Live YouTube Subtitle Translator and AI Chat Sidepanel.",
  permissions: [
    "sidePanel",
    "storage",
    "activeTab",
    "scripting"
  ],
  host_permissions: [
    "https://*.youtube.com/*",
    "<all_urls>"
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'"
  },
  background: {
    service_worker: "background.js"
  },
  side_panel: {
    default_path: "index.html"
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["content.js"],
      run_at: "document_idle"
    },
    {
      matches: ["https://*.youtube.com/*"],
      js: ["main-world.js"],
      world: "MAIN",
      run_at: "document_start"
    }
  ],
  action: {
    default_popup: "popup.html",
    default_title: "AI Chrome Companion"
  }
};

const backgroundJs = `// Chrome Extension Manifest V3 Service Worker
console.log("AI Chrome Companion Background Worker Started");

// Port to side panel
let sidePanelPort = null;

// Pending translate callbacks: requestId -> { sendResponse, timeout }
const pendingRequests = {};
let requestCounter = 0;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel-conn") {
    sidePanelPort = port;
    console.log("Side panel connected");

    port.onMessage.addListener((msg) => {
      // Side panel sends back translation results
      if (msg.action === "TRANSLATION_RESULT") {
        const pending = pendingRequests[msg.requestId];
        if (pending) {
          clearTimeout(pending.timeout);
          delete pendingRequests[msg.requestId];
          pending.sendResponse(msg.result);
        }
      }
    });

    port.onDisconnect.addListener(() => {
      sidePanelPort = null;
      console.log("Side panel disconnected");
      // Reject all pending requests
      for (const [id, pending] of Object.entries(pendingRequests)) {
        clearTimeout(pending.timeout);
        pending.sendResponse({ success: false, error: "پنل افزونه بسته شد." });
        delete pendingRequests[id];
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TRANSLATE_SUBTITLE") {
    if (!sidePanelPort) {
      // Try to open the side panel automatically
      if (chrome.sidePanel && chrome.sidePanel.open && sender.tab && sender.tab.windowId) {
        chrome.sidePanel.open({ windowId: sender.tab.windowId }).catch(() => {});
      }
      sendResponse({ success: false, error: "لطفاً ابتدا پنل کناری (آیکون افزونه) را باز کنید (یا اگر باز است یک بار ببندید و دوباره باز کنید)." });
      return false;
    }

    const requestId = ++requestCounter;
    pendingRequests[requestId] = {
      sendResponse,
      timeout: setTimeout(() => {
        if (pendingRequests[requestId]) {
          delete pendingRequests[requestId];
          sendResponse({ success: false, error: "زمان انتظار برای ترجمه تمام شد (timeout)." });
        }
      }, 120000)
    };

    chrome.storage.local.get(['chrome_ai_target_lang'], (res) => {
      sidePanelPort.postMessage({
        action: "TRANSLATE_REQUEST",
        requestId,
        text: request.text,
        targetLang: res.chrome_ai_target_lang || request.targetLang || "fa",
        isBatch: request.isBatch || false
      });
    });

    return true; // keep channel open for async response
  }
});`;

const mainWorldJs = `// Runs in MAIN world to extract YouTube variables
(function() {
  let capturedUrl = null;
  let waitCallbacks = [];

  function intercept(url) {
    if (url && typeof url === 'string' && url.includes('/api/timedtext')) {
      capturedUrl = url;
      waitCallbacks.forEach(cb => cb(url));
      waitCallbacks = [];
    }
  }

  const origFetch = window.fetch;
  window.fetch = function(req, init) {
    try {
      const url = typeof req === 'string' ? req : (req && req.url);
      intercept(url);
    } catch(e) {}
    return origFetch.apply(this, arguments);
  };

  const origXHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try { intercept(url); } catch(e) {}
    return origXHR.apply(this, arguments);
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data.action !== 'REQUEST_YT_RESPONSE') return;
    
    try {
      const player = document.getElementById("movie_player");
      if (!player) return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'NO_PLAYER' }, '*');
      
      const ytResponse = typeof player.getPlayerResponse === 'function' ? player.getPlayerResponse() : window.ytInitialPlayerResponse;
      if (!ytResponse || !ytResponse.captions) {
        return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'NO_CAPTIONS' }, '*');
      }

      // Ensure captions module is loaded
      try { if (typeof player.loadModule === 'function') player.loadModule("captions"); } catch(e) {}
      await new Promise(r => setTimeout(r, 400));
      
      let tracks = [];
      try { tracks = player.getOption("captions", "tracklist") || []; } catch(e) {}
      
      if (!tracks.length) {
        tracks = ytResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      }
      
      if (!tracks.length) {
        return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'NO_TRACKS' }, '*');
      }

      function preferredIndex(tList) {
        const manualEnglish = tList.find(t => t.kind !== "asr" && (t.languageCode || "").startsWith("en"));
        const anyEnglish = tList.find(t => (t.languageCode || "").startsWith("en"));
        const manualAny = tList.find(t => t.kind !== "asr");
        const selected = manualEnglish || anyEnglish || manualAny || tList[0];
        const idx = tList.indexOf(selected);
        return idx > -1 ? idx : 0;
      }
      const selectedTrack = tracks[preferredIndex(tracks)];

      capturedUrl = null;
      
      // Force player to fetch the best available track
      try { player.setOption("captions", "track", {}); } catch(e) {}
      await new Promise(r => setTimeout(r, 100));
      
      try {
        const normTrack = {
          languageCode: selectedTrack.languageCode || selectedTrack.lang || "",
          kind: selectedTrack.kind || (selectedTrack.vssId && selectedTrack.vssId.includes('a.') ? 'asr' : 'manual'),
          vssId: selectedTrack.vssId || ""
        };
        player.setOption("captions", "track", normTrack);
      } catch(e) {}

      // Wait for intercepted URL
      let finalUrl = capturedUrl;
      if (!finalUrl) {
        finalUrl = await new Promise(resolve => {
          waitCallbacks.push(resolve);
          setTimeout(() => {
            const idx = waitCallbacks.indexOf(resolve);
            if (idx > -1) waitCallbacks.splice(idx, 1);
            resolve(capturedUrl);
          }, 3000);
        });
      }
      
      // Reset player track
      try { player.setOption("captions", "track", {}); } catch(e) {}

      if (!finalUrl) {
        // Fallback to baseUrl
        finalUrl = selectedTrack.baseUrl;
      }
      
      if (!finalUrl) {
         return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'CAPTURE_FAILED' }, '*');
      }

      const urlObj = new URL(finalUrl, location.origin);
      urlObj.searchParams.set('fmt', 'json3');
      
      const res = await origFetch(urlObj.toString());
      if (!res.ok) return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'HTTP_ERROR' }, '*');
      
      const text = await res.text();
      if (!text) return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'EMPTY_BODY' }, '*');
      
      const json = JSON.parse(text);
      if (!json.events) return window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'NO_EVENTS' }, '*');
      
      window.postMessage({
        action: 'RESPONSE_YT_RESPONSE',
        success: true,
        events: JSON.parse(JSON.stringify(json.events))
      }, '*');
      
    } catch(e) {
      window.postMessage({ action: 'RESPONSE_YT_RESPONSE', error: 'EXCEPTION', details: e.message }, '*');
    }
  });
})();
console.log('AI Companion Main World Script Injected');
`;

let iransansDataUrl = '';
let iransansxDataUrl = '';
try {
  const dataTs = fs.readFileSync(path.join(process.cwd(), 'src/services/defaultFontsData.ts'), 'utf8');
  const mReg = dataTs.match(/IRANSANS_DATA_URL\s*=\s*'([^']+)'/);
  const mX = dataTs.match(/IRANSANSX_DATA_URL\s*=\s*'([^']+)'/);
  if (mReg) iransansDataUrl = mReg[1];
  if (mX) iransansxDataUrl = mX[1];
} catch (e) {
  console.log('Note: defaultFontsData.ts not found or readable during build');
}

const contentJs = `// YouTube AI Subtitle Translator - Content Script
(function() {
  'use strict';

  let overlayContainer = null;
  let translationEnabled = false;
  let observerInterval = null;
  let lastVideoUrl = '';
  let currentSubtitleStyle = null;
  let currentCustomFonts = null;
  let currentWebCustomizerSettings = null;

  function injectCSS() {
    if (document.getElementById('ai-sub-style')) return;
    const style = document.createElement('style');
    style.id = 'ai-sub-style';
    style.textContent = \`
      #ai-sub-prompt {
        position: fixed !important;
        top: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        background: #0f172a !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 14px !important;
        padding: 16px 20px !important;
        color: #ffffff !important;
        font-family: Tahoma, Arial, sans-serif !important;
        direction: rtl !important;
        box-shadow: 0 10px 35px rgba(0, 0, 0, 0.8) !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        min-width: 290px !important;
        max-width: 380px !important;
      }
      #ai-sub-prompt button {
        padding: 8px 16px !important;
        border-radius: 8px !important;
        border: none !important;
        cursor: pointer !important;
        font-weight: bold !important;
        transition: all 0.2s !important;
      }
      #ai-btn-yes { background: #3b82f6 !important; color: white !important; }
      #ai-btn-yes:hover { background: #2563eb !important; }
      #ai-btn-no { background: #334155 !important; color: white !important; }
      #ai-btn-no:hover { background: #475569 !important; }
      
      #ai-sub-overlay {
        position: absolute !important;
        bottom: 12% !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 999999 !important;
        background: rgba(0, 0, 0, 0.75) !important;
        color: #ffb400 !important;
        font-size: 26px !important;
        font-weight: bold !important;
        padding: 8px 16px !important;
        border-radius: 8px !important;
        text-align: right !important;
        direction: rtl !important;
        unicode-bidi: isolate !important;
        font-family: Tahoma, Arial, sans-serif !important;
        text-shadow: 1px 1px 2px black !important;
        pointer-events: none !important;
        max-width: 80% !important;
      }
      #ai-toast-overlay {
        position: absolute !important;
        top: 24px !important;
        left: 24px !important;
        z-index: 999999 !important;
        background: rgba(15, 23, 42, 0.85) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        color: #ffb400 !important;
        font-size: 14px !important;
        font-weight: bold !important;
        padding: 8px 16px !important;
        border-radius: 8px !important;
        text-align: right !important;
        direction: rtl !important;
        font-family: Tahoma, Arial, sans-serif !important;
        pointer-events: none !important;
      }
      body.ai-hide-native .ytp-caption-window-bottom {
        opacity: 0.01 !important;
        pointer-events: none !important;
      }
    \`;
    (document.head || document.documentElement).appendChild(style);
  }

  const DEFAULT_FONTS_LIST = [
    { name: 'وزیرمتن (Vazirmatn)', fontFamily: 'Vazirmatn, sans-serif', url: 'https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Vazirmatn-font-face.css', isDefault: true },
    { name: 'شبنم (Shabnam)', fontFamily: 'Shabnam, Vazirmatn, sans-serif', url: 'https://cdn.jsdelivr.net/npm/shabnam-font@5.0.2/dist/font-face.css', isDefault: true },
    { name: 'ساحل (Sahel)', fontFamily: 'Sahel, Vazirmatn, sans-serif', url: 'https://cdn.jsdelivr.net/npm/sahel-font@3.4.0/dist/font-face.css', isDefault: true },
    { name: 'لاله‌زار (Lalezar)', fontFamily: 'Lalezar, cursive, Vazirmatn', url: 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap', isDefault: true },
    { name: 'صمیم (Samim)', fontFamily: 'Samim, Vazirmatn, sans-serif', url: 'https://cdn.jsdelivr.net/npm/samim-font@4.0.5/dist/font-face.css', isDefault: true },
    { name: 'ایران سنس (IRAN Sans)', fontFamily: 'IRANSans, "IRAN Sans", Vazirmatn, sans-serif', dataUrl: "${iransansDataUrl}", isDefault: true },
    { name: 'ایران سنس ایکس (IRAN Sans X)', fontFamily: 'IRANSansX, "IRAN SansX", Vazirmatn, sans-serif', dataUrl: "${iransansxDataUrl}", isDefault: true }
  ];

  function injectCustomFontsCSS() {
    let styleTag = document.getElementById('ai-sub-custom-fonts-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'ai-sub-custom-fonts-style';
      (document.head || document.documentElement).appendChild(styleTag);
    }

    let fontsToInject = DEFAULT_FONTS_LIST;
    if (currentCustomFonts && Array.isArray(currentCustomFonts) && currentCustomFonts.length > 0) {
      const customOnly = currentCustomFonts.filter(f => !f.isDefault);
      fontsToInject = [...DEFAULT_FONTS_LIST, ...customOnly];
    }

    let cssRules = '';
    fontsToInject.forEach((font) => {
      if (font.dataUrl) {
        const familyName = font.fontFamily ? font.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : font.name;
        cssRules += \`
          @font-face {
            font-family: '\${familyName}';
            src: url('\${font.dataUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          @font-face {
            font-family: '\${font.name}';
            src: url('\${font.dataUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        \`;
      } else if (font.url) {
        cssRules += \`@import url('\${font.url}');\\n\`;
      }
    });

    styleTag.textContent = cssRules;
  }

  function applyWebCustomizer(settings) {
    let styleEl = document.getElementById('ai-web-customizer-style');
    if (!settings || !settings.enabled) {
      if (styleEl) styleEl.remove();
      document.documentElement.removeAttribute('data-ai-rtl');
      document.body.removeAttribute('data-ai-rtl');
      return;
    }

    const currentHost = window.location.hostname.toLowerCase();
    if (settings.applyScope === 'current_site' && settings.currentSiteDomain) {
      const domain = settings.currentSiteDomain.toLowerCase().trim();
      if (!currentHost.includes(domain) && !domain.includes(currentHost)) {
        if (styleEl) styleEl.remove();
        document.documentElement.removeAttribute('data-ai-rtl');
        document.body.removeAttribute('data-ai-rtl');
        return;
      }
    } else if (settings.applyScope === 'whitelist') {
      const whitelist = settings.includedDomains || [];
      const inWhitelist = whitelist.some(d => currentHost === d.toLowerCase().trim() || currentHost.endsWith('.' + d.toLowerCase().trim()));
      if (!inWhitelist) {
        if (styleEl) styleEl.remove();
        document.documentElement.removeAttribute('data-ai-rtl');
        document.body.removeAttribute('data-ai-rtl');
        return;
      }
    } else {
      const blacklist = settings.excludedDomains || [];
      const inBlacklist = blacklist.some(d => currentHost === d.toLowerCase().trim() || currentHost.endsWith('.' + d.toLowerCase().trim()));
      if (inBlacklist) {
        if (styleEl) styleEl.remove();
        document.documentElement.removeAttribute('data-ai-rtl');
        document.body.removeAttribute('data-ai-rtl');
        return;
      }
    }

    injectCustomFontsCSS();

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'ai-web-customizer-style';
      (document.head || document.documentElement).appendChild(styleEl);
    }

    let allFonts = DEFAULT_FONTS_LIST;
    if (currentCustomFonts && Array.isArray(currentCustomFonts) && currentCustomFonts.length > 0) {
      const customOnly = currentCustomFonts.filter(f => !f.isDefault);
      allFonts = [...DEFAULT_FONTS_LIST, ...customOnly];
    }
    let activeSettings = Object.assign({}, settings);
    if (settings.domainOverrides && settings.domainOverrides[currentHost]) {
      activeSettings = Object.assign({}, activeSettings, settings.domainOverrides[currentHost]);
    }

    const fontObj = allFonts.find(f => f.id === activeSettings.selectedFontId) || allFonts[0];
    const familyName = fontObj ? (fontObj.fontFamily ? fontObj.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : fontObj.name) : 'Vazirmatn';

    const customSelectors = (activeSettings.customRtlSelectors && Array.isArray(activeSettings.customRtlSelectors))
      ? activeSettings.customRtlSelectors
      : ((settings.customRtlSelectors && settings.customRtlSelectors[currentHost]) || []);
    const isCustomScope = (activeSettings.rtlMode === 'custom_selector' && customSelectors.length > 0);

    let css = '';
    if (activeSettings.fontEnabled !== false) {
      let weightRule = (activeSettings.fontWeight && activeSettings.fontWeight !== 'default') ? (" font-weight: " + activeSettings.fontWeight + " !important;") : "";
      let notIcons = ":not(i):not(svg):not(canvas):not(code):not(pre):not(kbd):not(samp):not(icon):not(md-icon):not(mat-icon):not(mwc-icon):not(ui-icon):not(google-icon):not(google-symbol):not(ion-icon):not(feather-icon):not(lucide-icon):not(fa-icon):not(font-icon):not(iconify-icon):not(sl-icon):not(vaadin-icon):not(vwc-icon):not(shoelace-icon):not(glyph):not([class*='icon' i]):not([class*='symbol' i]):not([class*='glyph' i]):not([class*='fa-' i]):not([class*='material-' i]):not([class*='md-' i]):not([class*='mat-' i]):not([role='img']):not([aria-hidden='true'])";

      if (isCustomScope) {
        let scopedFontTargets = customSelectors.map(s => s + notIcons + ", " + s + " *" + notIcons).join(', ');
        css += scopedFontTargets + " { font-family: '" + familyName + "', Vazirmatn, sans-serif !important;" + weightRule + " } ";
      } else {
        css += "*" + notIcons + " { font-family: '" + familyName + "', Vazirmatn, sans-serif !important;" + weightRule + " } ";
      }

      css += "i, svg, icon, md-icon, mat-icon, mwc-icon, ui-icon, google-icon, google-symbol, ion-icon, feather-icon, lucide-icon, fa-icon, font-icon, iconify-icon, sl-icon, vaadin-icon, vwc-icon, shoelace-icon, glyph, .material-icons, .material-icons-outlined, .material-symbols-outlined, .material-symbols-rounded, .material-symbols-sharp, .google-symbols, .g-symbols, [class*='material-symbols' i], [class*='material-icons' i], [class*='google-symbols' i], [class*='google-icons' i], [class*='md-icon' i], [class*='mat-icon' i], [class*='mwc-icon' i], [class*='symbol' i], [class*='icon' i], [class*='glyph' i], [role='img'], [aria-hidden='true'] { font-family: 'Google Symbols', 'Google Material Icons', 'Material Symbols Outlined', 'Material Icons', 'Material Symbols Rounded', 'Material Symbols Sharp', 'FontAwesome', 'Font Awesome 6 Free', 'Font Awesome 5 Free', 'Font Awesome 6 Pro', 'Font Awesome 5 Pro', 'Ionicons', 'Codicon', 'lucide', 'Feather', 'Glyphicons Halflings', inherit !important; font-feature-settings: 'normal', 'liga' !important; -webkit-font-feature-settings: 'normal', 'liga' !important; } ";
      css += "code, pre, kbd, samp, .monospace, .font-mono, [class*='code'], [class*='mono'] { font-family: monospace, consolas, 'Courier New' !important; } ";

      if (activeSettings.fontSizeScale && activeSettings.fontSizeScale !== 100) {
        const sizeTargets = "p, .prose p, .markdown p, .chat-message p, .conversation p, li, td, th, input, textarea, select, button, .text-sm, .text-base, .text-lg";
        if (isCustomScope) {
          const scopedSizeTargets = customSelectors.map(s => s + ", " + sizeTargets.split(', ').map(t => s + " " + t).join(', ')).join(', ');
          css += scopedSizeTargets + " { font-size: " + activeSettings.fontSizeScale + "% !important; } ";
        } else {
          css += "html { font-size: " + activeSettings.fontSizeScale + "% !important; } ";
          css += sizeTargets + " { font-size: " + activeSettings.fontSizeScale + "% !important; } ";
        }
      }

      if (activeSettings.textFontSizeScale && activeSettings.textFontSizeScale !== 100) {
        const textTargets = "p, li, td, th, input, textarea, select, button, label, h1, h2, h3, h4, h5, h6, blockquote, .prose p, .markdown p, .chat-message p, .conversation p, .text-xs, .text-sm, .text-base, .text-lg, .text-xl, .text-2xl, .text-3xl, .text-4xl";
        const noCompoundTargets = "li li, td td, th th, blockquote blockquote, p *, h1 *, h2 *, h3 *, h4 *, h5 *, h6 *, button *, label *, .prose p *, .markdown p *, .chat-message p *";
        if (isCustomScope) {
          const scopedTextTargets = customSelectors.map(s => s + ", " + textTargets.split(', ').map(t => s + " " + t).join(', ')).join(', ');
          const scopedNoCompound = customSelectors.map(s => noCompoundTargets.split(', ').map(t => s + " " + t).join(', ')).join(', ');
          css += scopedTextTargets + " { font-size: " + activeSettings.textFontSizeScale + "% !important; } ";
          css += scopedNoCompound + " { font-size: 100% !important; } ";
        } else {
          css += textTargets + " { font-size: " + activeSettings.textFontSizeScale + "% !important; } ";
          css += noCompoundTargets + " { font-size: 100% !important; } ";
        }
      }

      if (activeSettings.lineHeight && activeSettings.lineHeight !== 'default') {
        const lhTargets = "p, li, td, th, h1, h2, h3, h4, h5, h6, label, textarea, .prose, .markdown, .chat-message, .conversation, .content, [role='main'], [class*='message'], [class*='chat'], [class*='text']";
        if (isCustomScope) {
          const scopedLhTargets = customSelectors.map(s => s + ", " + lhTargets.split(', ').map(t => s + " " + t).join(', ')).join(', ');
          css += scopedLhTargets + " { line-height: " + activeSettings.lineHeight + " !important; } ";
        } else {
          css += lhTargets + " { line-height: " + activeSettings.lineHeight + " !important; } ";
        }
      }
    }

    if (activeSettings.rtlEnabled !== false && activeSettings.rtlMode !== 'none') {
      if (activeSettings.rtlMode === 'full_site') {
        document.documentElement.setAttribute('data-ai-rtl', 'full');
        document.body.setAttribute('data-ai-rtl', 'full');
        css += "html, body, div, p, span, h1, h2, h3, h4, h5, h6, ul, ol, li, table, form, select { direction: rtl !important; text-align: right !important; } ";
      } else if (activeSettings.rtlMode === 'content_only') {
        document.documentElement.setAttribute('data-ai-rtl', 'content');
        document.body.setAttribute('data-ai-rtl', 'content');
        css += "main, article, .prose, .markdown, .chat-message, .conversation, .content, #content, [role='main'], [class*='message'], [class*='chat'], [class*='content'], p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, code { direction: rtl !important; text-align: right !important; } ";
        css += "nav, aside, [role='navigation'], [class*='sidebar'], [class*='menu'], [class*='nav'] { direction: ltr !important; text-align: left !important; } ";
      } else if (activeSettings.rtlMode === 'custom_selector') {
        document.documentElement.setAttribute('data-ai-rtl', 'custom');
        document.body.setAttribute('data-ai-rtl', 'custom');
        if (customSelectors.length > 0) {
          const selString = customSelectors.join(', ');
          css += selString + " { direction: rtl !important; text-align: right !important; } ";
          css += selString + " * { direction: rtl !important; text-align: right !important; } ";
        }
      }

      if (activeSettings.inputsRtl !== false) {
        const inputTargets = "input:not([type='checkbox']):not([type='radio']):not([type='submit']):not([type='button']), textarea, [contenteditable='true'], [role='textbox'], .ProseMirror, .cm-content, .ql-editor";
        if (activeSettings.rtlMode === 'custom_selector' && customSelectors.length > 0) {
          const scopedInputs = customSelectors.map(s => inputTargets.split(', ').map(t => s + " " + t + ", " + s + t).join(', ')).join(', ');
          css += scopedInputs + " { text-align: right !important; unicode-bidi: plaintext !important; } ";
        } else {
          css += inputTargets + " { text-align: right !important; unicode-bidi: plaintext !important; } ";
        }
      } else {
        const inputTargets = "input, textarea, [contenteditable='true'], [role='textbox'], .ProseMirror, .cm-content, .ql-editor";
        css += inputTargets + " { direction: ltr !important; text-align: left !important; unicode-bidi: normal !important; } ";
      }
    } else {
      document.documentElement.removeAttribute('data-ai-rtl');
      document.body.removeAttribute('data-ai-rtl');
    }

    if (!css.trim()) {
      if (styleEl) styleEl.remove();
      return;
    }
    styleEl.textContent = css;
  }

  function removePrompt() {
    const el = document.getElementById('ai-sub-prompt');
    if (el) el.remove();
  }

  function showPrompt() {
    injectCSS();
    if (document.getElementById('ai-sub-prompt')) return;
    const prompt = document.createElement('div');
    prompt.id = 'ai-sub-prompt';
    prompt.innerHTML = \`
      <div style="font-size: 16px; margin-bottom: 5px;">🎥 ویدیوی جدید تشخیص داده شد</div>
      <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">آیا می‌خواهید زیرنویس این ویدیو به فارسی ترجمه شود؟</div>
      <div style="display: flex; gap: 10px; margin-top: 5px;">
        <button id="ai-btn-yes">✅ بله، ترجمه کن</button>
        <button id="ai-btn-no">❌ خیر</button>
      </div>
    \`;
    (document.body || document.documentElement).appendChild(prompt);

    document.getElementById('ai-btn-yes').onclick = () => {
      translationEnabled = true;
      removePrompt();
      document.body.classList.add('ai-hide-native');
      startBatchTranslation();
    };

    document.getElementById('ai-btn-no').onclick = () => {
      stopTranslation();
      removePrompt();
    };
  }

  function getOrCreateOverlay() {
    let el = document.getElementById('ai-sub-overlay');
    if (el) return el;
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (!player) return null;
    el = document.createElement('div');
    el.id = 'ai-sub-overlay';
    player.appendChild(el);
    overlayContainer = el;
    return el;
  }

  function updateToast(msg) {
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (!player) return;
    let toast = document.getElementById('ai-toast-overlay');
    if (!msg) {
      if (toast) toast.remove();
      return;
    }
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ai-toast-overlay';
      player.appendChild(toast);
    }
    toast.innerHTML = msg;
  }

  let allSubtitles = []; 
  const BATCH_SIZE = 60; 
  let videoEl = null;
  let translationProgress = '';

  async function startBatchTranslation() {
    const overlay = getOrCreateOverlay();
    if (!overlay) return;
    
    try {
      translationProgress = '⏳ در حال دریافت فایل زیرنویس...';
      updateToast(translationProgress);
      
      let resData = await new Promise(resolve => {
        const listener = (event) => {
          if (event.source !== window || event.data.action !== 'RESPONSE_YT_RESPONSE') return;
          window.removeEventListener('message', listener);
          resolve(event.data);
        };
        window.addEventListener('message', listener);
        window.postMessage({ action: 'REQUEST_YT_RESPONSE' }, '*');
        
        setTimeout(() => {
          window.removeEventListener('message', listener);
          resolve({ error: 'TIMEOUT' });
        }, 10000);
      });
      
      if (!resData.success) {
        console.error("Subtitle extraction failed:", resData.error, resData.details || "");
        if (resData.error === 'NO_CAPTIONS') translationProgress = '⚠️ این ویدیو زیرنویس ندارد.';
        else if (resData.error === 'NO_TRACKS') translationProgress = '⚠️ زیرنویسی برای استخراج یافت نشد.';
        else if (resData.error === 'EMPTY_BODY') translationProgress = '⚠️ فایل زیرنویس خالی بود.';
        else translationProgress = '⚠️ خطا در دانلود فایل زیرنویس.';
        
        updateToast(translationProgress);
        return;
      }

      const events = resData.events;
      allSubtitles = [];
      let idCounter = 0;
      for (const event of events) {
        if (!event.segs) continue;
        const text = event.segs.map(s => s.utf8).join('').trim();
        if (!text) continue;
        
        allSubtitles.push({
          id: idCounter++,
          startMs: event.tStartMs,
          durMs: event.dDurationMs || 0,
          text: text,
          translated: ''
        });
      }

      if (allSubtitles.length === 0) {
        translationProgress = '⚠️ فایل زیرنویس خالی است.';
        updateToast(translationProgress);
        return;
      }

      startPlaybackSync();
      
      let i = 0;
      while (i < allSubtitles.length) {
        if (!translationEnabled) break;
        
        // First batch is small (5 lines) to return translation instantly, subsequent batches are larger
        const currentBatchSize = i === 0 ? Math.min(5, BATCH_SIZE) : BATCH_SIZE;
        const chunk = allSubtitles.slice(i, i + currentBatchSize);
        const textToTranslate = chunk.map(s => s.id + '|' + s.text).join('\\n');
        
        translationProgress = \`⏳ ترجمه: \${Math.min(i + currentBatchSize, allSubtitles.length)} از \${allSubtitles.length} خط\`;
        updateToast(translationProgress);
        
        let batchAttempts = 0;
        let batchSuccess = false;
        while (batchAttempts < 3 && !batchSuccess && translationEnabled) {
          try {
            const response = await new Promise(resolve => {
              chrome.runtime.sendMessage(
                { action: 'TRANSLATE_SUBTITLE', text: textToTranslate, targetLang: 'fa', isBatch: true },
                resolve
              );
            });

            if (response && response.success) {
              let cleanResponse = response.translation.replace(/^\\s*\`\`\`[a-z]*\\n/i, '').replace(/\\n\`\`\`\\s*$/i, '').trim();
              const lines = cleanResponse.split('\\n');
              let matchedUniqueIds = new Set();
              
              for (const line of lines) {
                const match = line.match(/^\\s*(\\d+)\\s*\\|\\s*(.*)$/);
                if (match) {
                  const id = parseInt(match[1]);
                  let trans = match[2].trim();
                  // If model maliciously adds original text, strip it out
                  trans = trans.replace(/\\s*<-\\s*.*$/, '').trim();
                  const subObj = allSubtitles.find(s => s.id === id);
                  if (subObj) {
                    subObj.translated = trans;
                    matchedUniqueIds.add(id);
                  }
                }
              }
              
              const validLines = lines.filter(l => l.trim().length > 0);
              if (matchedUniqueIds.size < chunk.length / 2 && validLines.length > 0) {
                // Fallback: Model hallucinated IDs (e.g. returned same ID for all) or didn't return IDs
                // Allow slight line count mismatch for fallback
                if (Math.abs(validLines.length - chunk.length) <= 5) {
                   chunk.forEach((sub, idx) => {
                     if (validLines[idx]) {
                       sub.translated = validLines[idx].replace(/^\\d+\\s*[\\|\\.\\-:]\\s*/, '').trim();
                     }
                   });
                }
              }
              batchSuccess = true;
            } else {
              batchAttempts++;
              console.error("Batch error attempt " + batchAttempts, response);
              if (batchAttempts < 3 && translationEnabled) {
                updateToast("⏳ تلاش مجدد برای ترجمه (تلاش " + (batchAttempts + 1) + " از ۳) - سرور مشغول است...");
                await new Promise(r => setTimeout(r, batchAttempts * 3000));
              }
            }
          } catch (e) {
            batchAttempts++;
            console.error("Batch exception attempt " + batchAttempts, e);
            if (batchAttempts < 3 && translationEnabled) {
              updateToast("⏳ تلاش مجدد در ارتباط (تلاش " + (batchAttempts + 1) + " از ۳)...");
              await new Promise(r => setTimeout(r, batchAttempts * 3000));
            }
          }
        }

        if (!batchSuccess) {
          updateToast("⚠️ خطا در ترجمه این بخش پس از ۳ تلاش. رفتن به بخش بعدی...");
          await new Promise(r => setTimeout(r, 2000));
        } else {
          // Cooldown between successful batches to prevent rate limits / throttling
          await new Promise(r => setTimeout(r, 1200));
        }
        
        i += currentBatchSize;
      }
      
      if (translationEnabled) {
        translationProgress = '';
        updateToast('');
      }
    } catch (e) {
      console.error(e);
      translationProgress = '⚠️ خطا در دانلود زیرنویس.';
      updateToast(translationProgress);
    }
  }

  function parseStyleObj(val) {
    if (!val) return null;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch(e) { return null; }
    }
    return val;
  }

  function applyStyleToOverlay(overlay, styleObj) {
    styleObj = parseStyleObj(styleObj);
    if (!styleObj) return;
    
    if (styleObj.position === 'top') {
      overlay.style.setProperty('bottom', 'auto', 'important');
      overlay.style.setProperty('top', (styleObj.verticalOffset || 12) + '%', 'important');
      overlay.style.setProperty('transform', 'translateX(-50%)', 'important');
    } else if (styleObj.position === 'middle') {
      overlay.style.setProperty('bottom', 'auto', 'important');
      overlay.style.setProperty('top', '50%', 'important');
      overlay.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
    } else {
      overlay.style.setProperty('top', 'auto', 'important');
      overlay.style.setProperty('bottom', (styleObj.verticalOffset || 12) + '%', 'important');
      overlay.style.setProperty('transform', 'translateX(-50%)', 'important');
    }

    overlay.style.setProperty('background-color', styleObj.backgroundColor || 'rgba(0,0,0,0.75)', 'important');
    overlay.style.setProperty('font-size', (styleObj.fontSize || 26) + 'px', 'important');
    
    if (styleObj.fontFamily) {
      overlay.style.setProperty('font-family', \`\${styleObj.fontFamily}, Tahoma, Arial, sans-serif\`, 'important');
    }
    
    if (styleObj.fontWeight) {
      overlay.style.setProperty('font-weight', styleObj.fontWeight, 'important');
    }

    if (styleObj.textShadow === false) {
      overlay.style.setProperty('text-shadow', 'none', 'important');
    } else {
      overlay.style.setProperty('text-shadow', '1px 1px 2px black', 'important');
    }
    
    if (styleObj.borderRadius !== undefined) {
      overlay.style.setProperty('border-radius', styleObj.borderRadius + 'px', 'important');
    }
    
    if (styleObj.paddingY !== undefined || styleObj.paddingX !== undefined) {
       overlay.style.setProperty('padding', \`\${styleObj.paddingY || 8}px \${styleObj.paddingX || 16}px\`, 'important');
    }

    if (styleObj.borderStyle === 'outline') {
      overlay.style.setProperty('border', '2px solid rgba(255,255,255,0.2)', 'important');
    } else if (styleObj.borderStyle === 'none') {
      overlay.style.setProperty('border', 'none', 'important');
    }
  }

  function renderSubtitleHTML(activeSub) {
    if (!activeSub) return '';

    const style = parseStyleObj(currentSubtitleStyle) || {};
    const primaryColor = style.textColor || '#ffb400';
    const secondaryColor = style.secondaryTextColor || '#38bdf8';
    
    const showDual = style.showDualLanguage !== undefined ? style.showDualLanguage : true;
    const layout = style.dualLayout || (showDual ? 'persian_top' : 'persian_only');
    
    let html = '';
    
    const persianText = activeSub.translated || '';
    const englishText = activeSub.text || '';
    
    const persianDiv = persianText ? \`<div style="color: \${primaryColor}; direction: rtl; line-height: 1.4;">\${persianText}</div>\` : '';
    const englishDiv = englishText ? \`<div style="color: \${secondaryColor}; direction: ltr; font-size: 0.88em; font-family: sans-serif; opacity: 0.95; line-height: 1.4; margin-top: 4px;">\${englishText}</div>\` : '';

    if (layout === 'persian_only') {
      html = persianDiv || englishDiv; 
    } else if (layout === 'english_only') {
      html = englishDiv;
    } else if (layout === 'persian_top') {
      html = \`<div style="display: flex; flex-direction: column; align-items: center;">\${persianDiv}\${englishDiv}</div>\`;
    } else if (layout === 'english_top') {
      html = \`<div style="display: flex; flex-direction: column; align-items: center;">\${englishDiv}\${persianDiv}</div>\`;
    } else {
      html = persianDiv || englishDiv;
    }
    
    return html;
  }

  function syncSubtitle() {
    if (!translationEnabled || !allSubtitles.length) return;
    const overlay = getOrCreateOverlay();
    if (!overlay) return;

    if (currentSubtitleStyle) {
       applyStyleToOverlay(overlay, currentSubtitleStyle);
    }

    const nativeCaption = document.querySelector(".ytp-caption-window-bottom");
    if (!nativeCaption || nativeCaption.style.display === "none") {
      overlay.innerHTML = '';
      return;
    }

    const origText = nativeCaption.innerText.replace(/\\n/g, ' ').trim();
    if (!origText) {
      overlay.innerHTML = '';
      return;
    }

    // Find in our batch by matching string
    // Because DOM text can differ slightly from JSON, we use a generous match or fallback to timing
    let activeSub = null;
    if (origText) {
      activeSub = allSubtitles.find(s => {
        const sText = s.text.replace(/\\n/g, ' ').trim();
        return sText === origText || sText.includes(origText) || origText.includes(sText);
      });
    }

    if (!activeSub) {
      // Fallback to video timing
      if (!videoEl) videoEl = document.querySelector('video');
      if (videoEl) {
        const currentMs = videoEl.currentTime * 1000;
        activeSub = allSubtitles.find(s => currentMs >= s.startMs && currentMs <= (s.startMs + s.durMs));
      }
    }
    
    const targetHTML = renderSubtitleHTML(activeSub);
    
    if (overlay.innerHTML !== targetHTML) {
      overlay.innerHTML = targetHTML;
    }
  }

  function startPlaybackSync() {
    if (observerInterval) clearInterval(observerInterval);
    observerInterval = setInterval(syncSubtitle, 50);
  }

  function stopTranslation() {
    translationEnabled = false;
    if (observerInterval) {
      clearInterval(observerInterval);
      observerInterval = null;
    }
    const el = document.getElementById('ai-sub-overlay');
    if (el) el.remove();
    overlayContainer = null;
    allSubtitles = [];
    translationProgress = '';
    if (document.body) document.body.classList.remove('ai-hide-native');
  }

  function onVideoPage() {
    if (!location.pathname.startsWith('/watch')) return;
    const url = location.href;
    if (url === lastVideoUrl) return;
    lastVideoUrl = url;

    stopTranslation();
    removePrompt();

    let tries = 0;
    const checkPlayer = setInterval(() => {
      tries++;
      if (document.body && (document.querySelector('#movie_player') || document.querySelector('.html5-video-player'))) {
        clearInterval(checkPlayer);
        setTimeout(showPrompt, 500);
      } else if (tries > 25) {
        clearInterval(checkPlayer);
        if (document.body) setTimeout(showPrompt, 300);
      }
    }, 200);
  }

  let pickerActive = false;
  let hoveredEl = null;
  let origOutline = '';
  let origBoxShadow = '';
  let pickerBadge = null;

  function startRtlElementPicker() {
    if (pickerActive) return;
    pickerActive = true;

    pickerBadge = document.createElement('div');
    pickerBadge.style.cssText = "position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2147483647; background: #020617; border: 2px solid #00f2fe; color: #fff; padding: 10px 20px; border-radius: 9999px; font-family: Tahoma, Vazirmatn, sans-serif; font-size: 13px; font-weight: bold; box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events: none; direction: rtl;";
    pickerBadge.innerText = "🎯 حالت انتخاب بخش: موس را روی ناحیه مورد نظر ببرید و کلیک کنید (Esc برای انصراف)";
    (document.body || document.documentElement).appendChild(pickerBadge);

    function onMouseOver(e) {
      if (!pickerActive) return;
      e.stopPropagation();
      if (hoveredEl && hoveredEl !== e.target) {
        hoveredEl.style.outline = origOutline;
        hoveredEl.style.boxShadow = origBoxShadow;
      }
      hoveredEl = e.target;
      origOutline = hoveredEl.style.outline || '';
      origBoxShadow = hoveredEl.style.boxShadow || '';
      hoveredEl.style.outline = "2px dashed #00f2fe";
      hoveredEl.style.boxShadow = "inset 0 0 0 2px rgba(0, 242, 254, 0.3)";
    }

    function onMouseOut(e) {
      if (!pickerActive || !hoveredEl) return;
      e.stopPropagation();
      hoveredEl.style.outline = origOutline;
      hoveredEl.style.boxShadow = origBoxShadow;
      hoveredEl = null;
    }

    function getCssSelector(el) {
      if (!(el instanceof Element)) return null;
      let path = [];
      while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id && !el.id.match(/^[0-9]/)) {
          selector += '#' + el.id;
          path.unshift(selector);
          break;
        } else {
          let sib = el, nth = 1;
          while (sib = sib.previousElementSibling) {
            if (sib.nodeName.toLowerCase() == selector) nth++;
          }
          if (nth != 1) selector += ":nth-of-type(" + nth + ")";
        }
        path.unshift(selector);
        el = el.parentNode;
        if (!el || el.nodeName.toLowerCase() === 'body' || el.nodeName.toLowerCase() === 'html') break;
      }
      return path.join(" > ");
    }

    function stopPicker() {
      pickerActive = false;
      if (hoveredEl) {
        hoveredEl.style.outline = origOutline;
        hoveredEl.style.boxShadow = origBoxShadow;
        hoveredEl = null;
      }
      if (pickerBadge && pickerBadge.parentNode) {
        pickerBadge.parentNode.removeChild(pickerBadge);
        pickerBadge = null;
      }
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    }

    function onClick(e) {
      if (!pickerActive) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.target;
      stopPicker();
      if (target) {
        const selector = getCssSelector(target);
        if (selector) {
          const currentHost = window.location.hostname.toLowerCase();
          chrome.storage.local.get(['chrome_ai_web_customizer'], (res) => {
            let settings = (res && res.chrome_ai_web_customizer && parseStyleObj(res.chrome_ai_web_customizer)) || {};
            let domainOverrides = settings.domainOverrides || {};
            let hostOverride = domainOverrides[currentHost] || {};
            let hostList = (hostOverride.customRtlSelectors && Array.isArray(hostOverride.customRtlSelectors)) ? hostOverride.customRtlSelectors : ((settings.customRtlSelectors && settings.customRtlSelectors[currentHost]) || []);
            if (!hostList.includes(selector)) {
              hostList.push(selector);
            }
            hostOverride.customRtlSelectors = hostList;
            hostOverride.rtlMode = 'custom_selector';
            hostOverride.enabled = true;
            domainOverrides[currentHost] = hostOverride;
            settings.domainOverrides = domainOverrides;
            settings.enabled = true;
            chrome.storage.local.set({ chrome_ai_web_customizer: JSON.stringify(settings) }, () => {
              applyWebCustomizer(settings);
            });
          });
        }
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        stopPicker();
      }
    }

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function init() {
    document.addEventListener('yt-navigate-finish', onVideoPage);
    window.addEventListener('popstate', onVideoPage);

    try {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request && request.action === "START_RTL_PICKER") {
          startRtlElementPicker();
          sendResponse({ success: true });
          return true;
        }
      });
    } catch(e) {}

    let pollUrl = location.href;
    setInterval(() => {
      if (location.href !== pollUrl) {
        pollUrl = location.href;
        onVideoPage();
      }
    }, 700);

    try {
      chrome.storage.local.get(['chrome_ai_subtitle_style', 'chrome_ai_custom_fonts', 'chrome_ai_web_customizer'], (res) => {
        if (res && res.chrome_ai_subtitle_style) currentSubtitleStyle = parseStyleObj(res.chrome_ai_subtitle_style);
        if (res && res.chrome_ai_custom_fonts) currentCustomFonts = parseStyleObj(res.chrome_ai_custom_fonts);
        if (res && res.chrome_ai_web_customizer) currentWebCustomizerSettings = parseStyleObj(res.chrome_ai_web_customizer);
        injectCustomFontsCSS();
        if (currentWebCustomizerSettings) applyWebCustomizer(currentWebCustomizerSettings);
      });
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
          if (changes.chrome_ai_subtitle_style) {
            currentSubtitleStyle = parseStyleObj(changes.chrome_ai_subtitle_style.newValue);
            if (overlayContainer && currentSubtitleStyle) {
              applyStyleToOverlay(overlayContainer, currentSubtitleStyle);
            }
          }
          if (changes.chrome_ai_custom_fonts) {
            currentCustomFonts = parseStyleObj(changes.chrome_ai_custom_fonts.newValue);
            injectCustomFontsCSS();
            if (currentWebCustomizerSettings) applyWebCustomizer(currentWebCustomizerSettings);
          }
          if (changes.chrome_ai_web_customizer) {
            currentWebCustomizerSettings = parseStyleObj(changes.chrome_ai_web_customizer.newValue);
            applyWebCustomizer(currentWebCustomizerSettings);
          }
        }
      });
    } catch(e) {}

    onVideoPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifestJson, null, 2), 'utf8');
fs.writeFileSync(path.join(distDir, 'background.js'), backgroundJs, 'utf8');
fs.writeFileSync(path.join(distDir, 'content.js'), contentJs, 'utf8');
fs.writeFileSync(path.join(distDir, 'main-world.js'), mainWorldJs, 'utf8');

try {
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    const indexHtmlContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    const popupStyle = `
    <style>
      html, body {
        width: 480px !important;
        min-width: 480px !important;
        max-width: 480px !important;
        height: 620px !important;
        min-height: 620px !important;
        max-height: 620px !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #020617 !important;
        overflow-x: hidden !important;
      }
      #root {
        width: 480px !important;
        min-width: 480px !important;
        height: 620px !important;
        min-height: 620px !important;
      }
    </style>
  </head>`;
    const popupHtmlContent = indexHtmlContent.replace('</head>', popupStyle);
    fs.writeFileSync(path.join(distDir, 'popup.html'), popupHtmlContent, 'utf8');
  }
} catch (e) {
  console.error("Could not create popup.html:", e);
}

async function buildZip() {
  const zip = new JSZip();
  
  function addFilesFromDir(dirPath, zipFolder) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file === 'extension.zip') continue;
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        addFilesFromDir(fullPath, zipFolder.folder(file));
      } else {
        zipFolder.file(file, fs.readFileSync(fullPath));
      }
    }
  }

  addFilesFromDir(distDir, zip);
  
  const content = await zip.generateAsync({ type: "nodebuffer" });
  if (!fs.existsSync(path.join(process.cwd(), 'public'))) fs.mkdirSync(path.join(process.cwd(), 'public'));
  fs.writeFileSync(path.join(process.cwd(), 'public', 'extension.zip'), content);
  console.log('Zip built and saved to public/extension.zip!');
}

buildZip();
