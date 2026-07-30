# AI Chrome Companion 🚀

AI Chrome Companion is a powerful Chrome Extension that brings an AI-powered Sidepanel and real-time YouTube subtitle translation straight to your browser. 

With support for multiple AI providers (OpenRouter, NVIDIA NIM, Gemini, and Custom local LLMs), it provides an integrated and seamless experience for reading translated subtitles, chatting with AI models, and customizing your web experience.

*Read this in other languages: [فارسی](README.fa.md)*

## ✨ Features

- **💬 AI Chat Sidepanel**: A slide-over right side panel to chat with your favorite AI models directly while browsing.
- **🌐 Multi-Provider Support**: Connect to various AI providers:
  - OpenRouter
  - NVIDIA NIM
  - Google Gemini API
  - Custom Local LLMs (e.g., Ollama)
- **🎥 YouTube Live Subtitle Translator**: Automatically translates YouTube subtitles in real-time using AI for high-quality, context-aware translations.
- **🎨 Web Customizer Studio**: Customize UI themes (Light/Dark), subtitle styles, and custom fonts.
- **🌍 Bilingual Interface**: Fully supports English and Persian (RTL) UI languages.
- **🛡️ Proxy Support**: Built-in proxy configurations for regions with restricted access to AI APIs.
- **🔒 Privacy-Focused**: Stores API keys and chat history locally in your browser (`chrome.storage.local`).

## 🚀 Installation

### Prerequisites
- Node.js (v18 or higher recommended)
- npm, yarn, or bun

### Build from Source
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ai-chrome-companion.git
   cd ai-chrome-companion
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** in the top right corner.
   - Click **Load unpacked**.
   - Select the `dist` folder that was created after running the build command.

### Development Mode
To run the extension in development mode with hot-reloading (via Vite):
```bash
npm run dev
```

## 🛠️ Tech Stack
- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + Framer Motion
- **Bundler**: Vite
- **Extension API**: Manifest V3

## 📝 Configuration
To use the extension, open the side panel and navigate to the **Providers** tab to set up your API keys. Your API keys are securely stored in your browser's local storage and are never sent to external servers other than the providers you choose.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
