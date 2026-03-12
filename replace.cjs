const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/zinc-/g, 'gray-');
content = content.replace(/indigo-/g, 'blue-');
fs.writeFileSync('src/App.tsx', content);
console.log('Replaced colors');
