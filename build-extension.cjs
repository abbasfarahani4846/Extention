const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

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
      matches: ["https://*.youtube.com/*"],
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
    default_title: "Open AI SidePanel"
  }
};

const backgroundJs = `// Chrome Extension Manifest V3 Service Worker
console.log("AI Chrome Companion Background Worker Started");

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

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

const contentJs = `// YouTube AI Subtitle Translator - Content Script
(function() {
  'use strict';

  let overlayContainer = null;
  let translationEnabled = false;
  let observerInterval = null;
  let lastVideoUrl = '';

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
      body.ai-hide-native .ytp-caption-window-bottom {
        opacity: 0.01 !important;
        pointer-events: none !important;
      }
    \`;
    (document.head || document.documentElement).appendChild(style);
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

  let allSubtitles = []; 
  const BATCH_SIZE = 60; 
  let videoEl = null;
  let translationProgress = '';

  async function startBatchTranslation() {
    const overlay = getOrCreateOverlay();
    if (!overlay) return;
    
    try {
      translationProgress = '⏳ در حال دریافت فایل زیرنویس...';
      overlay.innerText = translationProgress;
      
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
        
        overlay.innerText = translationProgress;
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
        overlay.innerText = translationProgress;
        return;
      }

      startPlaybackSync();
      
      for (let i = 0; i < allSubtitles.length; i += BATCH_SIZE) {
        if (!translationEnabled) break;
        const chunk = allSubtitles.slice(i, i + BATCH_SIZE);
        const textToTranslate = chunk.map(s => s.id + '|' + s.text).join('\\n');
        
        translationProgress = \`⏳ ترجمه: \${Math.min(i + BATCH_SIZE, allSubtitles.length)} از \${allSubtitles.length} خط\`;
        
        try {
          const response = await new Promise(resolve => {
            chrome.runtime.sendMessage(
              { action: 'TRANSLATE_SUBTITLE', text: textToTranslate, targetLang: 'fa', isBatch: true },
              resolve
            );
          });

          if (response && response.success) {
            const lines = response.translation.split('\\n');
            for (const line of lines) {
              const match = line.match(/^(\\d+)\\|(.*)$/);
              if (match) {
                const id = parseInt(match[1]);
                const trans = match[2].trim();
                const subObj = allSubtitles.find(s => s.id === id);
                if (subObj) subObj.translated = trans;
              }
            }
          } else {
            console.error("Batch error", response);
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      if (translationEnabled) {
        translationProgress = '';
      }
    } catch (e) {
      console.error(e);
      translationProgress = '⚠️ خطا در دانلود زیرنویس.';
      if (overlay) overlay.innerText = translationProgress;
    }
  }

  function syncSubtitle() {
    if (!translationEnabled || !allSubtitles.length) return;
    const overlay = getOrCreateOverlay();
    if (!overlay) return;
    if (!videoEl) videoEl = document.querySelector('video');
    if (!videoEl) return;

    const currentMs = videoEl.currentTime * 1000;
    const activeSub = allSubtitles.find(s => currentMs >= s.startMs && currentMs <= (s.startMs + s.durMs));
    
    if (activeSub) {
      if (activeSub.translated && overlay.innerText !== activeSub.translated) {
        overlay.innerText = activeSub.translated;
      } else if (!activeSub.translated && overlay.innerText !== activeSub.text) {
        overlay.innerText = activeSub.text;
      }
    } else {
      if (overlay.innerText !== translationProgress) {
        overlay.innerText = translationProgress;
      }
    }
  }

  function startPlaybackSync() {
    if (observerInterval) clearInterval(observerInterval);
    observerInterval = setInterval(syncSubtitle, 150);
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

  function init() {
    document.addEventListener('yt-navigate-finish', onVideoPage);
    window.addEventListener('popstate', onVideoPage);

    let pollUrl = location.href;
    setInterval(() => {
      if (location.href !== pollUrl) {
        pollUrl = location.href;
        onVideoPage();
      }
    }, 700);

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
