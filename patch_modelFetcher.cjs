const fs = require('fs');
let content = fs.readFileSync('src/services/modelFetcher.ts', 'utf8');

// Add proxy type import
if (!content.includes('ProxySettings')) {
  content = content.replace("import { AIModel, AIProvider } from '../types';", "import { AIModel, AIProvider, ProxySettings } from '../types';");
}

// Modify signature
content = content.replace(
  "export async function fetchModelsForProvider(\n  provider: AIProvider,\n  filterQuery: string = ''\n)",
  "export async function fetchModelsForProvider(\n  provider: AIProvider,\n  filterQuery: string = '',\n  proxySettings?: ProxySettings\n)"
);

// Modify fetch URL and logic
const fetchLogic = `      let url = provider.modelsEndpoint;
      if (provider.type === 'gemini' && provider.apiKey && !url.includes('key=')) {
        url += \`\${url.includes('?') ? '&' : '?'}key=\${provider.apiKey}\`;
      }

      if (proxySettings?.enabled && proxySettings.customProxyUrl.trim()) {
        const cleanProxy = proxySettings.customProxyUrl.trim().replace(/\\/$/, '');
        url = \`\${cleanProxy}?url=\${encodeURIComponent(url)}\`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);`;

content = content.replace(
  /      let url = provider\.modelsEndpoint;[\s\S]*?headers: headers,\n      }\);/,
  fetchLogic
);

fs.writeFileSync('src/services/modelFetcher.ts', content);
console.log('modelFetcher patched');
