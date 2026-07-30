const fs = require('fs');
let js = fs.readFileSync('build-extension.js', 'utf8');
let cjs = js.replace("import fs from 'fs';", "const fs = require('fs');")
            .replace("import path from 'path';", "const path = require('path');")
            .replace("import JSZip from 'jszip';", "const JSZip = require('jszip');");
fs.writeFileSync('build-extension.cjs', cjs);
console.log('build-extension.cjs synced successfully');
