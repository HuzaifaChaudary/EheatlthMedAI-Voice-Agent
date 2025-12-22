const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupPostgresUser() {
  console.log('🔧 PostgreSQL User & Database Setup\n');

  // Parse DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL is not set in .env file');
    process.exit(1);
  }

  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  
  if (!urlMatch) {
    console.error('❌ ERROR: Invalid DATABASE_URL format');
    process.exit(1);
  }

  const [, username, password, host, port, databaseName] = urlMatch;
  
  console.log('📋 Target Configuration:');
  console.log(`   User: ${username}`);
  console.log(`   Database: ${databaseName}`);
  console.log(`   Host: ${host}:${port}\n`);

  // Try to connect as postgres superuser first
  console.log('⚠️  We need to connect as PostgreSQL superuser to create user/database');
  console.log('   Please enter your PostgreSQL superuser credentials:\n');
  
  const superuser = await question('PostgreSQL superuser (usually "postgres"): ') || 'postgres';
  const superuserPassword = await question('Superuser password: ');
  
  rl.close();

  // Connect as superuser
  const superuserPool = new Pool({
    host: host,
    port: parseInt(port, 10),
    user: superuser,
    password: superuserPassword,
    database: 'postgres',
    ssl: false
  });

  try {
    // Test superuser connection
    await superuserPool.query('SELECT 1');
    console.log('\n✅ Connected as superuser\n');

    // Check if user exists
    const userCheck = await superuserPool.query(
      `SELECT EXISTS(SELECT FROM pg_user WHERE usename = $1) as exists`,
      [username]
    );

    if (!userCheck.rows[0].exists) {
      console.log(`📝 Creating user "${username}"...`);
      await superuserPool.query(
        `CREATE USER ${username} WITH PASSWORD '${password}';`
      );
      console.log(`✅ User "${username}" created\n`);
    } else {
      console.log(`✅ User "${username}" already exists`);
      console.log(`   Updating password...`);
      await superuserPool.query(
        `ALTER USER ${username} WITH PASSWORD '${password}';`
      );
      console.log(`✅ Password updated\n`);
    }

    // Grant privileges
    console.log('🔐 Granting privileges...');
    await superuserPool.query(`ALTER USER ${username} CREATEDB;`);
    console.log('✅ Privileges granted\n');

    // Check if database exists
    const dbCheck = await superuserPool.query(
      `SELECT EXISTS(SELECT FROM pg_database WHERE datname = $1) as exists`,
      [databaseName]
    );

    if (!dbCheck.rows[0].exists) {
      console.log(`📝 Creating database "${databaseName}"...`);
      await superuserPool.query(`CREATE DATABASE ${databaseName} OWNER ${username};`);
      console.log(`✅ Database "${databaseName}" created\n`);
    } else {
      console.log(`✅ Database "${databaseName}" already exists`);
      // Update owner
      await superuserPool.query(`ALTER DATABASE ${databaseName} OWNER TO ${username};`);
      console.log(`✅ Database owner set to "${username}"\n`);
    }

    // Grant all privileges on database
    await superuserPool.query(`GRANT ALL PRIVILEGES ON DATABASE ${databaseName} TO ${username};`);
    console.log('✅ All privileges granted\n');

    console.log('🎉 Setup complete!');
    console.log(`\nYou can now run: npm run check-db`);

    await superuserPool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === '28P01') {
      console.error('\nSuperuser authentication failed. Please check:');
      console.error('   - Superuser name and password are correct');
      console.error('   - Or run this manually in psql:');
      console.error(`\n   psql -U postgres`);
      console.error(`   CREATE USER ${username} WITH PASSWORD '${password}';`);
      console.error(`   ALTER USER ${username} CREATEDB;`);
      console.error(`   CREATE DATABASE ${databaseName} OWNER ${username};`);
    }
    
    await superuserPool.end();
    process.exit(1);
  }
}

setupPostgresUser();

