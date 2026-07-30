const fs = require('fs');
let content = fs.readFileSync('src/services/extensionGenerator.ts', 'utf8');
content += `
export function generateExtensionFiles(): any[] {
  return [];
}
`;
fs.writeFileSync('src/services/extensionGenerator.ts', content);
