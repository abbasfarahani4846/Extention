const fs = require('fs');
let content = fs.readFileSync('src/services/extensionGenerator.ts', 'utf8');

const prefix = "export async function downloadExtensionZip(): Promise<void> {";
const index = content.indexOf(prefix);
let top = content.substring(0, index);
const bottom = content.substring(index);

// Remove everything after the first `];` in top from `return [`
const returnIndex = top.lastIndexOf('return [');
const endBracketIndex = top.indexOf('];', returnIndex);

top = top.substring(0, endBracketIndex + 2) + "\n}\n\n";

fs.writeFileSync('src/services/extensionGenerator.ts', top + bottom);
console.log('Fixed properly.');
