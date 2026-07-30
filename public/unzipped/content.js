// YouTube AI Subtitle Translator - Content Script
(function() {
  'use strict';

  let overlayContainer = null;
  let translationEnabled = false;
  let observerInterval = null;
  let lastVideoUrl = '';
  let currentSubtitleStyle = null;

  function injectCSS() {
    if (document.getElementById('ai-sub-style')) return;
    const style = document.createElement('style');
    style.id = 'ai-sub-style';
    style.textContent = `
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
    `;
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
    prompt.innerHTML = `
      <div style="font-size: 16px; margin-bottom: 5px;">🎥 ویدیوی جدید تشخیص داده شد</div>
      <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">آیا می‌خواهید زیرنویس این ویدیو به فارسی ترجمه شود؟</div>
      <div style="display: flex; gap: 10px; margin-top: 5px;">
        <button id="ai-btn-yes">✅ بله، ترجمه کن</button>
        <button id="ai-btn-no">❌ خیر</button>
      </div>
    `;
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
        const textToTranslate = chunk.map(s => s.id + '|' + s.text).join('
');
        
        translationProgress = `⏳ ترجمه: ${Math.min(i + BATCH_SIZE, allSubtitles.length)} از ${allSubtitles.length} خط`;
        
        try {
          const response = await new Promise(resolve => {
            chrome.runtime.sendMessage(
              { action: 'TRANSLATE_SUBTITLE', text: textToTranslate, targetLang: 'fa', isBatch: true },
              resolve
            );
          });

          if (response && response.success) {
            let cleanResponse = response.translation.replace(/^\s*```[a-z]*\n/i, '').replace(/\n```\s*$/i, '').trim();
            const lines = cleanResponse.split('
');
            let matchedCount = 0;
            
            for (const line of lines) {
              const match = line.match(/^\s*(\d+)\s*\|\s*(.*)$/);
              if (match) {
                const id = parseInt(match[1]);
                let trans = match[2].trim();
                // If model maliciously adds original text, strip it out
                trans = trans.replace(/\s*<-\s*.*$/, '').trim();
                const subObj = allSubtitles.find(s => s.id === id);
                if (subObj) {
                  subObj.translated = trans;
                  matchedCount++;
                }
              }
            }
            
            if (matchedCount === 0 && lines.length > 0) {
              const validLines = lines.filter(l => l.trim().length > 0);
              // Allow slight line count mismatch for fallback
              if (Math.abs(validLines.length - chunk.length) <= 2) {
                 chunk.forEach((sub, idx) => {
                   if (validLines[idx]) {
                     sub.translated = validLines[idx].replace(/^\d+\s*[\|\.\-:]\s*/, '').trim();
                   }
                 });
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

  function applyStyleToOverlay(overlay, styleObj) {
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
      overlay.style.setProperty('font-family', `"${styleObj.fontFamily}", Tahoma, Arial, sans-serif`, 'important');
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
       overlay.style.setProperty('padding', `${styleObj.paddingY || 8}px ${styleObj.paddingX || 16}px`, 'important');
    }

    if (styleObj.borderStyle === 'outline') {
      overlay.style.setProperty('border', '2px solid rgba(255,255,255,0.2)', 'important');
    } else if (styleObj.borderStyle === 'none') {
      overlay.style.setProperty('border', 'none', 'important');
    }
  }

  function renderSubtitleHTML(activeSub, progressMsg) {
    if (progressMsg) {
       return `<div style="color: #ffb400; direction: rtl;">${progressMsg}</div>`;
    }
    if (!activeSub) return '';

    const style = currentSubtitleStyle || {};
    const primaryColor = style.textColor || '#ffb400';
    const secondaryColor = style.secondaryTextColor || '#38bdf8';
    
    const layout = style.dualLayout || (style.showDualLanguage ? 'persian_top' : 'persian_only');
    
    let html = '';
    
    const persianText = activeSub.translated || '';
    const englishText = activeSub.text || '';
    
    const persianDiv = persianText ? `<div style="color: ${primaryColor}; direction: rtl; line-height: 1.4;">${persianText}</div>` : '';
    const englishDiv = englishText ? `<div style="color: ${secondaryColor}; direction: ltr; font-size: 0.88em; font-family: sans-serif; opacity: 0.95; line-height: 1.4; margin-top: 4px;">${englishText}</div>` : '';

    if (layout === 'persian_only') {
      html = persianDiv || englishDiv; 
    } else if (layout === 'english_only') {
      html = englishDiv;
    } else if (layout === 'persian_top') {
      html = `<div style="display: flex; flex-direction: column; align-items: center;">${persianDiv}${englishDiv}</div>`;
    } else if (layout === 'english_top') {
      html = `<div style="display: flex; flex-direction: column; align-items: center;">${englishDiv}${persianDiv}</div>`;
    } else {
      html = persianDiv || englishDiv;
    }
    
    return html;
  }

  function syncSubtitle() {
    if (!translationEnabled || (!allSubtitles.length && !translationProgress)) return;
    const overlay = getOrCreateOverlay();
    if (!overlay) return;

    if (currentSubtitleStyle) {
       applyStyleToOverlay(overlay, currentSubtitleStyle);
    }

    const nativeCaption = document.querySelector(".ytp-caption-window-bottom");
    if (!nativeCaption || nativeCaption.style.display === "none") {
      overlay.innerHTML = translationProgress ? renderSubtitleHTML(null, translationProgress) : '';
      return;
    }

    const origText = nativeCaption.innerText.replace(/\n/g, ' ').trim();
    if (!origText && !translationProgress) {
      overlay.innerHTML = '';
      return;
    }

    // Find in our batch by matching string
    // Because DOM text can differ slightly from JSON, we use a generous match or fallback to timing
    let activeSub = null;
    if (origText) {
      activeSub = allSubtitles.find(s => {
        const sText = s.text.replace(/\n/g, ' ').trim();
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
    
    const targetHTML = renderSubtitleHTML(activeSub, !activeSub && !origText ? translationProgress : null);
    
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

    try {
      chrome.storage.local.get(['chrome_ai_subtitle_style'], (res) => {
        if (res.chrome_ai_subtitle_style) currentSubtitleStyle = res.chrome_ai_subtitle_style;
      });
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.chrome_ai_subtitle_style) {
          currentSubtitleStyle = changes.chrome_ai_subtitle_style.newValue;
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
