const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Color replacements: from blue to slate/teal
const colorReplacements = [
  // Background gradients
  { from: /from-blue-600 via-blue-700 to-blue-800/g, to: 'from-slate-800 via-slate-900 to-slate-950' },
  { from: /from-blue-600 via-blue-700/g, to: 'from-slate-800 via-slate-900' },
  { from: /bg-gradient-to-br from-blue/g, to: 'bg-gradient-to-br from-slate' },
  
  // Text colors
  { from: /text-blue-100/g, to: 'text-slate-200' },
  { from: /text-blue-200/g, to: 'text-slate-300' },
  { from: /text-blue-300/g, to: 'text-teal-300' },
  { from: /text-blue-400/g, to: 'text-teal-400' },
  
  // Background colors
  { from: /bg-blue-400\/30/g, to: 'bg-teal-500/30' },
  { from: /bg-blue-500\/50/g, to: 'bg-teal-600/50' },
  { from: /bg-blue-500/g, to: 'bg-teal-600' },
  { from: /bg-blue-600/g, to: 'bg-teal-600' },
  { from: /bg-blue-700/g, to: 'bg-teal-700' },
  { from: /bg-blue-800/g, to: 'bg-slate-800' },
  { from: /bg-blue-900/g, to: 'bg-slate-900' },
  
  // Hover states
  { from: /hover:bg-blue-500/g, to: 'hover:bg-teal-700' },
  { from: /hover:bg-blue-600/g, to: 'hover:bg-teal-700' },
  { from: /hover:bg-blue-700/g, to: 'hover:bg-teal-800' },
  
  // Border colors
  { from: /border-blue-400/g, to: 'border-teal-500' },
  { from: /border-blue-500/g, to: 'border-teal-600' },
  { from: /border-blue-700/g, to: 'border-slate-700' },
  { from: /border-blue-700\/50/g, to: 'border-slate-700/50' },
  
  // Background with opacity
  { from: /bg-blue-800\/50/g, to: 'bg-slate-800/60' },
  { from: /bg-blue-900/g, to: 'bg-slate-900' },
];

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;
  
  colorReplacements.forEach(({ from, to }) => {
    if (from.test(content)) {
      content = content.replace(from, to);
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  }
  return false;
}

// Find all TypeScript/TSX files in app directory
const files = glob.sync('app/**/*.{tsx,ts}', { cwd: path.join(__dirname, '..') });

console.log('Updating color scheme from blue to slate/teal...\n');
let updatedCount = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (updateFile(filePath)) {
    updatedCount++;
  }
});

console.log(`\n✅ Updated ${updatedCount} files`);

