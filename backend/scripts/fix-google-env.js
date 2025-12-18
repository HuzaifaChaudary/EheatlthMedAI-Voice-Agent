const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

try {
  let content = fs.readFileSync(envPath, 'utf8');
  
  // Fix GOOGLE_CLIENT_ID line break
  content = content.replace(
    /GOOGLE_CLIENT_ID="122689391467-gbdv4hf7n5fdf34vcsdj1hiq3lvsamo0\.apps\.googleuser\s+content\.com"/g,
    'GOOGLE_CLIENT_ID="122689391467-gbdv4hf7n5fdf34vcsdj1hiq3lvsamo0.apps.googleusercontent.com"'
  );
  
  // Also handle if it's split across lines
  content = content.replace(
    /GOOGLE_CLIENT_ID="([^"]*)\s+([^"]*)"\s*\n\s*content\.com"/g,
    'GOOGLE_CLIENT_ID="$1$2content.com"'
  );
  
  // More aggressive fix - remove line breaks within quoted values
  const lines = content.split('\n');
  const fixedLines = [];
  let inGoogleClientId = false;
  let googleClientIdValue = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.match(/^GOOGLE_CLIENT_ID="/)) {
      inGoogleClientId = true;
      googleClientIdValue = line;
      
      if (line.match(/"\s*$/)) {
        // Complete on same line
        fixedLines.push('GOOGLE_CLIENT_ID="122689391467-gbdv4hf7n5fdf34vcsdj1hiq3lvsamo0.apps.googleusercontent.com"');
        inGoogleClientId = false;
        googleClientIdValue = '';
      }
    } else if (inGoogleClientId) {
      googleClientIdValue += line.trim();
      if (line.match(/"\s*$/)) {
        // End of value
        fixedLines.push('GOOGLE_CLIENT_ID="122689391467-gbdv4hf7n5fdf34vcsdj1hiq3lvsamo0.apps.googleusercontent.com"');
        inGoogleClientId = false;
        googleClientIdValue = '';
      }
    } else {
      fixedLines.push(line);
    }
  }
  
  content = fixedLines.join('\n');
  
  fs.writeFileSync(envPath, content, 'utf8');
  console.log('✅ Fixed GOOGLE_CLIENT_ID in .env file');
  console.log('✅ Please restart your backend server to load the updated environment variables');
} catch (error) {
  console.error('Error fixing .env file:', error);
  process.exit(1);
}

