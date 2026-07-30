const fs = require('fs');
let content = fs.readFileSync('build-extension.js', 'utf8');

content = content.replace(
  "const content = await zip.generateAsync({ type: \"nodebuffer\" });\n  fs.writeFileSync(path.join(process.cwd(), 'public', 'extension.zip'), content);",
  "const content = await zip.generateAsync({ type: \"nodebuffer\" });\n  if (!fs.existsSync(path.join(process.cwd(), 'public'))) fs.mkdirSync(path.join(process.cwd(), 'public'));\n  fs.writeFileSync(path.join(process.cwd(), 'public', 'extension.zip'), content);"
);

fs.writeFileSync('build-extension.js', content);
