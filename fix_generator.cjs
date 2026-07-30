const fs = require('fs');
let content = fs.readFileSync('src/services/extensionGenerator.ts', 'utf8');

const replacement = `
  const appUrl = window.location.origin + window.location.pathname;

  const manifestJson = {
    manifest_version: 3,
    name: "AI Chrome Companion (SidePanel)",
    version: "1.0.0",
    description: "Live YouTube Subtitle Translator and AI Chat Sidepanel.",
    permissions: [
      "sidePanel",
      "storage",
      "activeTab",
      "scripting",
      "declarativeNetRequest"
    ],
    host_permissions: [
      "https://*.youtube.com/*",
      "<all_urls>"
    ],
    background: {
      service_worker: "background.js"
    },
    side_panel: {
      default_path: "sidepanel.html"
    },
    declarative_net_request: {
      rule_resources: [{
        id: "ruleset_1",
        enabled: true,
        path: "rules.json"
      }]
    },
    content_scripts: [
      {
        matches: ["https://*.youtube.com/*"],
        js: ["content.js"],
        run_at: "document_idle"
      }
    ],
    action: {
      default_title: "Open AI SidePanel"
    }
  };

  const rulesJson = [
    {
      "id": 1,
      "priority": 1,
      "action": {
        "type": "modifyHeaders",
        "responseHeaders": [
          { "header": "x-frame-options", "operation": "remove" },
          { "header": "content-security-policy", "operation": "remove" }
        ]
      },
      "condition": {
        "resourceTypes": ["sub_frame"]
      }
    }
  ];

  const backgroundJs = \`// Chrome Extension Manifest V3 Service Worker
console.log("AI Chrome Companion Background Worker Started");

// Open SidePanel when clicking extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

let sidePanelPort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel-conn") {
    sidePanelPort = port;
    port.onDisconnect.addListener(() => {
      sidePanelPort = null;
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TRANSLATE_SUBTITLE") {
    if (!sidePanelPort) {
      sendResponse({ success: false, error: "لطفاً ابتدا پنل کناری (آیکن افزونه) را باز کنید تا هوش مصنوعی متصل شود." });
      return false;
    }
    
    // Relay to sidepanel via port
    chrome.runtime.sendMessage({
      action: "FORWARD_TO_IFRAME",
      payload: request
    }, (res) => {
      sendResponse(res);
    });
    return true; // async
  }
});\`;

  const contentJs = \`// YouTube Subtitle AI Overlay Content Script
console.log("YouTube AI Subtitle Overlay Injected!");

let overlayContainer = null;
let activeTargetLang = "fa";

function createOverlay() {
  if (document.getElementById("ai-subtitle-overlay")) return;
  const player = document.querySelector(".html5-video-player") || document.querySelector("#movie_player");
  if (!player) return;

  overlayContainer = document.createElement("div");
  overlayContainer.id = "ai-subtitle-overlay";
  overlayContainer.style.cssText = \\\`
    position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%);
    z-index: 9999; padding: 10px 20px; background: rgba(0, 0, 0, 0.85);
    color: #ffd700; font-size: 26px; font-weight: bold; font-family: Tahoma, sans-serif;
    border-radius: 8px; text-align: center; direction: rtl; pointer-events: none;
    transition: all 0.1s ease; max-width: 85%; text-shadow: 2px 2px 4px #000;
  \\\`;
  player.appendChild(overlayContainer);
}

function startObserver() {
  createOverlay();
  setInterval(() => {
    if (!document.getElementById("ai-subtitle-overlay")) createOverlay();
    
    const nativeCaption = document.querySelector(".ytp-caption-segment");
    if (nativeCaption && overlayContainer) {
      const origText = nativeCaption.innerText.trim();
      if (origText && overlayContainer.dataset.lastText !== origText) {
        overlayContainer.dataset.lastText = origText;
        translateAndDisplay(origText);
      }
    } else if (overlayContainer) {
      const captionsPanel = document.querySelector(".caption-window");
      if (!captionsPanel || captionsPanel.style.display === "none") {
        overlayContainer.innerText = "";
        overlayContainer.dataset.lastText = "";
      }
    }
  }, 500);
}

function translateAndDisplay(text) {
  if (!overlayContainer) return;
  overlayContainer.innerText = "⏳ ...";
  chrome.runtime.sendMessage({
    action: "TRANSLATE_SUBTITLE",
    text: text,
    targetLang: activeTargetLang
  }, (response) => {
    if (response && response.success) {
      overlayContainer.innerText = response.translation;
    } else {
      overlayContainer.innerText = text + (response?.error ? " ⚠️(" + response.error + ")" : "");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserver);
} else {
  startObserver();
}
\`;

  const sidepanelHtml = \`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>AI SidePanel</title>
  <style>
    body { margin: 0; padding: 0; background: #0f172a; height: 100vh; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe id="app-frame" src="\${appUrl}" allow="clipboard-write; clipboard-read; microphone; camera"></iframe>
  <script src="sidepanel.js"></script>
</body>
</html>
\`;

  const sidepanelJs = \`// Connect to background to declare we are alive
const port = chrome.runtime.connect({ name: "sidepanel-conn" });

const iframe = document.getElementById("app-frame");
let pendingRequests = {};
let msgIdCounter = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FORWARD_TO_IFRAME") {
    const id = ++msgIdCounter;
    pendingRequests[id] = sendResponse;
    iframe.contentWindow.postMessage({
      type: "TRANSLATE_REQUEST",
      id: id,
      payload: request.payload
    }, "*");
    return true; // async
  }
});

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "TRANSLATE_RESPONSE") {
    const resFn = pendingRequests[event.data.id];
    if (resFn) {
      resFn(event.data.result);
      delete pendingRequests[event.data.id];
    }
  }
});
\`;

  const readmeMd = \`# AI Chrome Extension Package

این پکیج کامل افزونه کروم است که مستقیماً به نسخه وب اپلیکیشن متصل است.
تمامی تنظیمات پنل (کلیدهای API، مدل‌ها) از برنامه اصلی خوانده می‌شود!

## نحوه نصب در مرورگر کروم:

1. فایل های این پوشه یا فایل ZIP را اکسترکت کنید.
2. مرورگر Chrome را باز کنید و به آدرس زیر بروید:
   chrome://extensions
3. گزینه‌ی **Developer mode** را از سمت راست بالا فعال کنید.
4. روی دکمه **Load unpacked** کلیک کنید.
5. پوشه حاوی فایل های اکسترکت شده (شامل manifest.json) را انتخاب کنید.
6. افزونه نصب شد! با کلیک روی آیکون افزونه در نوار بالای مرورگر، پنل کناری باز شده و تنظیمات شما دقیقاً مثل پنل اصلی کار خواهد کرد!
\`;

  return [
    { filename: 'manifest.json', content: JSON.stringify(manifestJson, null, 2), description: 'Manifest V3 configuration file', type: 'json' },
    { filename: 'rules.json', content: JSON.stringify(rulesJson, null, 2), description: 'Rules to allow iframe embedding', type: 'json' },
    { filename: 'background.js', content: backgroundJs, description: 'Service worker for AI calls & messages', type: 'javascript' },
    { filename: 'content.js', content: contentJs, description: 'YouTube subtitle translator script', type: 'javascript' },
    { filename: 'sidepanel.html', content: sidepanelHtml, description: 'Right SidePanel UI layout', type: 'html' },
    { filename: 'sidepanel.js', content: sidepanelJs, description: 'Right SidePanel logic', type: 'javascript' },
    { filename: 'README.md', content: readmeMd, description: 'Installation guide', type: 'html' }
  ];
`;

content = content.replace(/const appUrl = [\s\S]*?return \[/m, replacement.replace(/return \[/m, 'return ['));
fs.writeFileSync('src/services/extensionGenerator.ts', content);
console.log('Fixed extension generator.');
