// Chrome Extension Manifest V3 Service Worker
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
});