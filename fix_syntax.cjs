const fs = require('fs');
let content = fs.readFileSync('src/services/extensionGenerator.ts', 'utf8');

const regex = /  ];\n    \{ filename: 'manifest\.json',[\s\S]*?\];\n\}/;
content = content.replace(regex, '  ];\n}');

fs.writeFileSync('src/services/extensionGenerator.ts', content);
console.log('Fixed syntax error.');
