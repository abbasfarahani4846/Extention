const fs = require('fs');
let content = fs.readFileSync('src/components/ProviderManager.tsx', 'utf8');

// The function is loadProviderModels
content = content.replace(
  "const result = await fetchModelsForProvider(provider, query);",
  "const result = await fetchModelsForProvider(provider, query, proxySettings);"
);

fs.writeFileSync('src/components/ProviderManager.tsx', content);
console.log('ProviderManager patched');
