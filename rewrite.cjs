const fs = require('fs');
let content = fs.readFileSync('src/services/extensionGenerator.ts', 'utf8');

const manifestMatch = content.match(/const manifestJson = \{[\s\S]*?\n  \};\n/);

const newBackground = `
  const backgroundJs = \`// Chrome Extension Manifest V3 Service Worker
console.log("AI Chrome Companion Background Worker Started");

// Open SidePanel when clicking extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TRANSLATE_SUBTITLE" || request.action === "CHAT_MESSAGE") {
    chrome.storage.local.get(['activeProvider', 'activeModel', 'openrouterKey', 'nvidiaKey', 'geminiKey'], (data) => {
      handleGenerativeAI(request, data, sendResponse);
    });
    return true; // async
  }
});

async function handleGenerativeAI(request, settings, sendResponse) {
  try {
    const provider = settings.activeProvider || "gemini";
    const model = settings.activeModel || "gemini-2.5-flash";
    const isChat = request.action === "CHAT_MESSAGE";
    
    let apiKey = "";
    if (provider === "gemini") apiKey = settings.geminiKey;
    if (provider === "openrouter") apiKey = settings.openrouterKey;
    if (provider === "nvidia") apiKey = settings.nvidiaKey;

    if (!apiKey) {
      sendResponse({ success: false, error: "کلید API در تنظیمات وارد نشده است." });
      return;
    }

    const systemPrompt = isChat 
      ? "You are a helpful AI assistant. Answer in Persian."
      : \\\`You are an expert video subtitle translator. Translate into language code \\\${request.targetLang || 'fa'}. Return ONLY the translation, no extra commentary.\\\`;
    
    const userPrompt = isChat ? request.text : \\\`Translate this subtitle line: "\\\${request.text}"\\\`;

    let resultText = "";

    if (provider === "gemini") {
      const url = \\\`https://generativelanguage.googleapis.com/v1beta/models/\\\${model}:generateContent?key=\\\${apiKey}\\\`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      const resData = await res.json();
      resultText = resData.candidates?.[0]?.content?.parts?.[0]?.text || request.text;
    } else {
      const baseUrl = provider === "nvidia" ? "https://integrate.api.nvidia.com/v1" : "https://openrouter.ai/api/v1";
      const url = \\\`\\\${baseUrl}/chat/completions\\\`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \\\`Bearer \\\${apiKey}\\\`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3
        })
      });
      const resData = await res.json();
      resultText = resData.choices?.[0]?.message?.content || request.text;
    }

    sendResponse({ success: true, translation: resultText.trim() });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}
\`;\n`;

const newContentJs = `
  const contentJs = \`// YouTube Subtitle AI Overlay Content Script
console.log("YouTube AI Subtitle Overlay Injected!");

let overlayContainer = null;
let activeTargetLang = "fa";

chrome.storage.local.get(['ytTargetLang'], (data) => {
  if (data.ytTargetLang) activeTargetLang = data.ytTargetLang;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.ytTargetLang) activeTargetLang = changes.ytTargetLang.newValue;
});

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
    
    // Attempt to find native caption
    const nativeCaption = document.querySelector(".ytp-caption-segment");
    if (nativeCaption && overlayContainer) {
      const origText = nativeCaption.innerText.trim();
      if (origText && overlayContainer.dataset.lastText !== origText) {
        overlayContainer.dataset.lastText = origText;
        translateAndDisplay(origText);
      }
    } else if (overlayContainer) {
      // Clear if no caption
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
      overlayContainer.innerText = text;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserver);
} else {
  startObserver();
}
\`;\n`;

const newSidepanelHtml = `
  const sidepanelHtml = \`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>AI SidePanel</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; height: 100vh; }
    .tabs { display: flex; background: #1e293b; border-bottom: 1px solid #334155; flex-shrink: 0; }
    .tab { flex: 1; padding: 12px 0; text-align: center; cursor: pointer; font-size: 13px; font-weight: bold; color: #94a3b8; border-bottom: 2px solid transparent; transition: all 0.2s; }
    .tab.active { color: #38bdf8; border-bottom-color: #38bdf8; background: #0f172a; }
    .tab-content { display: none; padding: 12px; flex: 1; overflow-y: auto; }
    .tab-content.active { display: flex; flex-direction: column; }
    
    .chat-box { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; border: 1px solid #334155; border-radius: 8px; padding: 10px; background: #1e293b; }
    .msg { padding: 8px 12px; border-radius: 8px; font-size: 13px; max-width: 85%; line-height: 1.5; }
    .msg.user { background: #0284c7; color: white; align-self: flex-start; }
    .msg.assistant { background: #334155; color: #f1f5f9; align-self: flex-end; }
    .input-row { display: flex; gap: 6px; flex-shrink: 0; }
    input[type="text"], input[type="password"], select { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 13px; box-sizing: border-box; }
    button { background: #0284c7; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; }
    button:hover { background: #0369a1; }
    
    .card { background: #1e293b; padding: 16px; border-radius: 10px; margin-bottom: 16px; border: 1px solid #334155; }
    h3 { margin-top: 0; color: #38bdf8; font-size: 14px; margin-bottom: 4px; }
    label { display: block; margin-top: 10px; font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="tabs">
    <div class="tab active" data-target="chatTab">💬 چت</div>
    <div class="tab" data-target="ytTab">🎬 یوتیوب</div>
    <div class="tab" data-target="settingsTab">⚙️ تنظیمات</div>
  </div>

  <div id="chatTab" class="tab-content active">
    <div class="chat-box" id="chat">
      <div class="msg assistant">سلام! من دستیار هوش مصنوعی شما هستم. لطفاً ابتدا در تب تنظیمات کلید API خود را وارد کنید.</div>
    </div>
    <div class="input-row">
      <input type="text" id="userInput" placeholder="پیام خود را بنویسید..." />
      <button id="sendBtn">ارسال</button>
    </div>
  </div>

  <div id="ytTab" class="tab-content">
    <div class="card">
      <h3>زیرنویس هوشمند یوتیوب</h3>
      <p style="font-size:12px; color:#cbd5e1; line-height:1.6; margin-bottom: 12px;">کافیست در یوتیوب دکمه CC (زیرنویس) را روشن کنید تا هوش مصنوعی آن را ترجمه کرده و بالای آن با فونت خوانا نمایش دهد.</p>
      
      <label>زبان مقصد ترجمه:</label>
      <select id="ytTargetLang">
        <option value="fa">فارسی</option>
        <option value="en">English</option>
        <option value="ar">العربية</option>
      </select>
      
      <button id="saveYtBtn" style="width:100%; margin-top:10px; background:#10b981;">ذخیره زبان</button>
    </div>
  </div>

  <div id="settingsTab" class="tab-content">
    <div class="card">
      <h3>هوش مصنوعی فعال</h3>
      <select id="activeProvider">
        <option value="gemini">Google Gemini</option>
        <option value="openrouter">OpenRouter</option>
        <option value="nvidia">NVIDIA NIM</option>
      </select>
      <label>نام مدل:</label>
      <input type="text" id="activeModel" value="gemini-2.5-flash" placeholder="مثلا gemini-2.5-flash" />
    </div>

    <div class="card">
      <h3>کلیدهای API</h3>
      <label>Gemini API Key:</label>
      <input type="password" id="geminiKey" placeholder="AIzaSy..." />
      
      <label>OpenRouter API Key:</label>
      <input type="password" id="openrouterKey" placeholder="sk-or-v1-..." />
      
      <label>NVIDIA NIM API Key:</label>
      <input type="password" id="nvidiaKey" placeholder="nvapi-..." />
    </div>

    <button id="saveSettingsBtn" style="width:100%; margin-top:0px;">ذخیره تنظیمات</button>
  </div>

  <script src="sidepanel.js"></script>
</body>
</html>
\`;\n`;

const newSidepanelJs = `
  const sidepanelJs = \`// Tab Switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

// Load Settings
chrome.storage.local.get(['activeProvider', 'activeModel', 'openrouterKey', 'nvidiaKey', 'geminiKey', 'ytTargetLang'], (data) => {
  if (data.activeProvider) document.getElementById('activeProvider').value = data.activeProvider;
  if (data.activeModel) document.getElementById('activeModel').value = data.activeModel;
  if (data.openrouterKey) document.getElementById('openrouterKey').value = data.openrouterKey;
  if (data.nvidiaKey) document.getElementById('nvidiaKey').value = data.nvidiaKey;
  if (data.geminiKey) document.getElementById('geminiKey').value = data.geminiKey;
  if (data.ytTargetLang) document.getElementById('ytTargetLang').value = data.ytTargetLang;
});

// Save Settings
document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  chrome.storage.local.set({
    activeProvider: document.getElementById('activeProvider').value,
    activeModel: document.getElementById('activeModel').value,
    openrouterKey: document.getElementById('openrouterKey').value,
    nvidiaKey: document.getElementById('nvidiaKey').value,
    geminiKey: document.getElementById('geminiKey').value
  }, () => {
    alert('تنظیمات با موفقیت ذخیره شدند!');
  });
});

document.getElementById('saveYtBtn').addEventListener('click', () => {
  chrome.storage.local.set({
    ytTargetLang: document.getElementById('ytTargetLang').value
  }, () => {
    alert('زبان ترجمه یوتیوب ذخیره شد!');
  });
});

// Chat Logic
document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('userInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  const chat = document.getElementById('chat');
  const userDiv = document.createElement('div');
  userDiv.className = 'msg user';
  userDiv.innerText = text;
  chat.appendChild(userDiv);
  input.value = '';

  const botDiv = document.createElement('div');
  botDiv.className = 'msg assistant';
  botDiv.innerText = 'در حال پردازش...';
  chat.appendChild(botDiv);
  chat.scrollTop = chat.scrollHeight;

  chrome.runtime.sendMessage({
    action: "CHAT_MESSAGE",
    text: text
  }, (res) => {
    if (res && res.success) {
      botDiv.innerText = res.translation;
    } else {
      botDiv.innerText = "خطا: " + (res?.error || "لطفاً کلید API را تنظیم کنید.");
    }
    chat.scrollTop = chat.scrollHeight;
  });
}
\`;\n`;

// Since we use sidepanel for everything, we don't need popup or options.
// But we still need an empty options.html if it's in the manifest.
const newManifest = `
  const manifestJson = {
    manifest_version: 3,
    name: "AI Chrome Companion & Subtitle Translator",
    version: "1.0.0",
    description: "Multi-provider AI SidePanel assistant (OpenRouter, NVIDIA, Gemini) with real-time YouTube subtitle translation overlay.",
    permissions: [
      "sidePanel",
      "storage",
      "activeTab",
      "scripting"
    ],
    host_permissions: [
      "https://*.youtube.com/*",
      "https://openrouter.ai/*",
      "https://integrate.api.nvidia.com/*",
      "https://generativelanguage.googleapis.com/*",
      "https://api.openai.com/*"
    ],
    background: {
      service_worker: "background.js"
    },
    side_panel: {
      default_path: "sidepanel.html"
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
`;

const newReadme = `
  const readmeMd = \`# AI Chrome Extension Package

این پکیج کامل افزونه کروم شامل زیرنویس هوش مصنوعی یوتیوب و پنل چت سمت راست است.

## نحوه نصب در مرورگر کروم:

1. فایل های این پوشه یا فایل ZIP را اکسترکت کنید.
2. مرورگر Chrome را باز کنید و به آدرس زیر بروید:
   \\\`chrome://extensions\\\`
3. گزینه‌ی **Developer mode** را از سمت راست بالا فعال کنید.
4. روی دکمه **Load unpacked** کلیک کنید.
5. پوشه حاوی فایل های اکسترکت شده (شامل \\\`manifest.json\\\`) را انتخاب کنید.
6. افزونه نصب شد! با کلیک روی آیکون افزونه در نوار بالای مرورگر، پنل کناری (SidePanel) باز می‌شود.
\`;\n`;

const newReturn = `
  return [
    { filename: 'manifest.json', content: JSON.stringify(manifestJson, null, 2), description: 'Manifest V3 configuration file', type: 'json' },
    { filename: 'background.js', content: backgroundJs, description: 'Service worker for AI calls & messages', type: 'javascript' },
    { filename: 'content.js', content: contentJs, description: 'YouTube subtitle translator script', type: 'javascript' },
    { filename: 'sidepanel.html', content: sidepanelHtml, description: 'Right SidePanel UI layout', type: 'html' },
    { filename: 'sidepanel.js', content: sidepanelJs, description: 'Right SidePanel logic', type: 'javascript' },
    { filename: 'README.md', content: readmeMd, description: 'Installation guide', type: 'html' }
  ];
}

export async function downloadExtensionZip(): Promise<void> {
`;

// Replace entire file content from `const manifestJson...` to `export async function downloadExtensionZip`
const header = content.substring(0, content.indexOf('const manifestJson'));
const footerIndex = content.indexOf('export async function downloadExtensionZip');
const footer = content.substring(footerIndex + 'export async function downloadExtensionZip(): Promise<void> {\n'.length);

const finalContent = header + newManifest + newBackground + newContentJs + newSidepanelHtml + newSidepanelJs + newReadme + newReturn + footer;

fs.writeFileSync('src/services/extensionGenerator.ts', finalContent);
console.log("Rewrite complete.");
