const fs = require('fs');
const content = `
export async function downloadExtensionZip(): Promise<void> {
  const url = '/extension.zip';
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chrome-ai-companion-extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
`;
fs.writeFileSync('src/services/extensionGenerator.ts', content);
console.log('patched generator');
