const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

if (!app.includes('declare var chrome: any;')) {
  app = app.replace(
    "import { AIService } from './services/aiService';",
    "import { AIService } from './services/aiService';\n\ndeclare var chrome: any;\n"
  );
  fs.writeFileSync('src/App.tsx', app);
}
console.log('patched chrome types');
