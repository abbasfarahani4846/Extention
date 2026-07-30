import { ExtensionFile } from '../types';

export function generateExtensionFiles(): ExtensionFile[] {
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
      }
    ],
    action: {
      default_title: "Open AI SidePanel"
    }
  };

  const backgroundJs = `// Chrome Extension Manifest V3 Service Worker
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
    
    // Send message to sidepanel index.html logic
    chrome.runtime.sendMessage({
      action: "FORWARD_TO_APP",
      payload: request
    }, (res) => {
      sendResponse(res);
    });
    return true; // async
  }
});`;

  const contentJs = `// YouTube Subtitle AI Overlay Content Script
console.log("YouTube AI Subtitle Overlay Injected!");

let overlayContainer = null;
let activeTargetLang = "fa";

function createOverlay() {
  if (document.getElementById("ai-subtitle-overlay")) return;
  const player = document.querySelector(".html5-video-player") || document.querySelector("#movie_player");
  if (!player) return;

  overlayContainer = document.createElement("div");
  overlayContainer.id = "ai-subtitle-overlay";
  overlayContainer.style.cssText = \`
    position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%);
    z-index: 9999; padding: 10px 20px; background: rgba(0, 0, 0, 0.85);
    color: #ffd700; font-size: 26px; font-weight: bold; font-family: Tahoma, sans-serif;
    border-radius: 8px; text-align: center; direction: rtl; pointer-events: none;
    transition: all 0.1s ease; max-width: 85%; text-shadow: 2px 2px 4px #000;
  \`;
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
`;

  return [
    { filename: 'manifest.json', content: JSON.stringify(manifestJson, null, 2), description: 'Manifest V3 configuration file', type: 'json' },
    { filename: 'background.js', content: backgroundJs, description: 'Service worker for AI calls & messages', type: 'javascript' },
    { filename: 'content.js', content: contentJs, description: 'YouTube subtitle translator script', type: 'javascript' }
  ];
}

export async function downloadExtensionZip(): Promise<void> {
  const url = '/extension.zip';
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chrome-ai-companion-extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
