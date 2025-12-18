require('dotenv').config();

console.log('\n=== Google OAuth Configuration Check ===\n');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const apiUrl = process.env.API_URL || 'http://localhost:5000';

console.log('Current Configuration:');
console.log('─────────────────────────────────────────');
console.log(`GOOGLE_CLIENT_ID: ${clientId ? clientId.substring(0, 20) + '...' : '❌ NOT SET'}`);
console.log(`GOOGLE_CLIENT_SECRET: ${clientSecret ? '✅ SET (hidden)' : '❌ NOT SET'}`);
console.log(`GOOGLE_REDIRECT_URI: ${redirectUri}`);
console.log(`FRONTEND_URL: ${frontendUrl}`);
console.log(`API_URL: ${apiUrl}`);
console.log('\n');

console.log('⚠️  IMPORTANT: Redirect URI Configuration');
console.log('─────────────────────────────────────────');
console.log(`Your redirect URI must be: ${redirectUri}`);
console.log('\n');

console.log('📋 Steps to Fix in Google Cloud Console:');
console.log('─────────────────────────────────────────');
console.log('1. Go to: https://console.cloud.google.com/');
console.log('2. Select your project');
console.log('3. Navigate to: APIs & Services > Credentials');
console.log('4. Click on your OAuth 2.0 Client ID');
console.log('5. Under "Authorized redirect URIs", add:');
console.log(`   ${redirectUri}`);
console.log('\n');

console.log('💡 Common Redirect URIs:');
console.log('─────────────────────────────────────────');
console.log('For local development:');
console.log('  http://localhost:5000/api/auth/google/callback');
console.log('\n');
console.log('For production (replace with your domain):');
console.log('  https://yourdomain.com/api/auth/google/callback');
console.log('\n');

console.log('✅ After updating Google Cloud Console:');
console.log('─────────────────────────────────────────');
console.log('1. Save the changes in Google Cloud Console');
console.log('2. Wait 1-2 minutes for changes to propagate');
console.log('3. Try signing in with Google again');
console.log('\n');

