const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');

try {
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env file not found at:', envPath);
    console.log('\nCreating a new .env file...');
    
    const defaultEnv = `# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/EHealthMedAI

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
`;
    
    fs.writeFileSync(envPath, defaultEnv);
    console.log('✓ Created new .env file with correct database name: EHealthMedAI');
    console.log('\n⚠️  IMPORTANT: Please update the DATABASE_URL with your actual PostgreSQL credentials!');
    process.exit(0);
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  const originalContent = envContent;
  
  // Fix database name - replace EHealthMedAi with EHealthMedAI
  envContent = envContent.replace(
    /DATABASE_URL=(.*?)\/([^\/\s]+)/g,
    (match, prefix, dbName) => {
      if (dbName.toLowerCase() === 'ehealthmedai' || dbName === 'EHealthMedAi') {
        return `${prefix}/EHealthMedAI`;
      }
      return match;
    }
  );
  
  // Also fix any other variations
  envContent = envContent.replace(/EHealthMedAi/g, 'EHealthMedAI');
  envContent = envContent.replace(/ehealthmedai/g, 'EHealthMedAI');
  
  if (envContent !== originalContent) {
    fs.writeFileSync(envPath, envContent);
    console.log('✓ Updated .env file: Changed database name to EHealthMedAI');
    console.log('\nUpdated DATABASE_URL in .env file');
  } else {
    console.log('✓ .env file already has correct database name (EHealthMedAI)');
  }
  
  // Show the current DATABASE_URL (without password)
  const urlMatch = envContent.match(/DATABASE_URL=(.+)/);
  if (urlMatch) {
    const url = urlMatch[1];
    // Mask password
    const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
    console.log('Current DATABASE_URL:', maskedUrl);
  }
  
} catch (error) {
  console.error('Error updating .env file:', error.message);
  process.exit(1);
}

