const fs = require('fs');
const code1 = `const lines = cleanResponse.split('\\n');`;
fs.writeFileSync('test-out.js', code1);
console.log("Written!");
