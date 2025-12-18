const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '../.env');

// Generate a secure random JWT secret
function generateJWTSecret() {
  return crypto.randomBytes(64).toString('hex');
}

console.log('Setting up environment variables...\n');

// Check if .env exists
if (!fs.existsSync(envPath)) {
  console.log('Creating .env file...');
  
  const defaultEnv = `# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/EHealthMedAI

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=${generateJWTSecret()}
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Google OAuth (Optional - add your keys)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# AI Services (Optional - add your keys)
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
`;

  fs.writeFileSync(envPath, defaultEnv);
  console.log('✓ Created .env file with default values');
  console.log('⚠️  IMPORTANT: Update DATABASE_URL with your PostgreSQL credentials!\n');
} else {
  console.log('Reading existing .env file...');
  let envContent = fs.readFileSync(envPath, 'utf8');
  let updated = false;
  
  // Check if JWT_SECRET is set
  if (!envContent.includes('JWT_SECRET=') || envContent.match(/JWT_SECRET=\s*$/m) || envContent.match(/JWT_SECRET=your-/)) {
    const newSecret = generateJWTSecret();
    
    if (envContent.includes('JWT_SECRET=')) {
      // Replace existing JWT_SECRET
      envContent = envContent.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${newSecret}`);
    } else {
      // Add JWT_SECRET after JWT Configuration comment or at the end
      if (envContent.includes('# JWT Configuration')) {
        envContent = envContent.replace(
          /(# JWT Configuration\n)/,
          `$1JWT_SECRET=${newSecret}\n`
        );
      } else {
        envContent += `\n# JWT Configuration\nJWT_SECRET=${newSecret}\nJWT_EXPIRES_IN=7d\n`;
      }
    }
    
    updated = true;
    console.log('✓ Added/Updated JWT_SECRET');
  } else {
    console.log('✓ JWT_SECRET is already set');
  }
  
  // Check if DATABASE_URL is set
  if (!envContent.includes('DATABASE_URL=') || envContent.match(/DATABASE_URL=postgresql:\/\/username:password/)) {
    console.log('⚠️  WARNING: DATABASE_URL needs to be updated with your actual database credentials');
  } else {
    console.log('✓ DATABASE_URL is set');
  }
  
  if (updated) {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✓ Updated .env file');
  }
}

console.log('\n✅ Setup complete!');
console.log('\nNext steps:');
console.log('1. Update DATABASE_URL in backend/.env with your PostgreSQL credentials');
console.log('2. Restart your backend server');
console.log('3. Try logging in again\n');

