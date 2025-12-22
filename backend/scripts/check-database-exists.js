const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkDatabaseExists() {
  console.log('🔍 Checking if database exists...\n');

  // Parse DATABASE_URL to extract connection details
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL is not set in .env file');
    console.log('\nPlease set DATABASE_URL in backend/.env');
    process.exit(1);
  }

  // Extract database name from URL
  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  
  if (!urlMatch) {
    console.error('❌ ERROR: Invalid DATABASE_URL format');
    console.log('Expected format: postgresql://user:password@host:port/database');
    process.exit(1);
  }

  const [, username, password, host, port, databaseName] = urlMatch;
  
  console.log('📋 Connection Details:');
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   User: ${username}`);
  console.log(`   Database: ${databaseName}\n`);

  // Connect to PostgreSQL server (using 'postgres' database to check if target DB exists)
  const adminPool = new Pool({
    host: host,
    port: parseInt(port, 10),
    user: username,
    password: password,
    database: 'postgres', // Connect to default postgres database
    ssl: false
  });

  try {
    // Check if target database exists
    const result = await adminPool.query(
      `SELECT EXISTS(
        SELECT FROM pg_database 
        WHERE datname = $1
      ) as exists`,
      [databaseName]
    );

    const exists = result.rows[0].exists;

    if (exists) {
      console.log(`✅ Database "${databaseName}" EXISTS!\n`);
      
      // Try to connect to the actual database to check if it's accessible
      const targetPool = new Pool({
        host: host,
        port: parseInt(port, 10),
        user: username,
        password: password,
        database: databaseName,
        ssl: false
      });

      try {
        const connectionTest = await targetPool.query('SELECT version()');
        console.log('✅ Connection to database successful!');
        console.log(`   PostgreSQL version: ${connectionTest.rows[0].version.split(',')[0]}\n`);

        // Check if tables exist
        const tablesResult = await targetPool.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);

        const tableCount = parseInt(tablesResult.rows[0].count, 10);
        
        if (tableCount > 0) {
          console.log(`📊 Database has ${tableCount} table(s) in public schema`);
          
          // List first 10 tables
          const tablesList = await targetPool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
            LIMIT 10
          `);
          
          if (tablesList.rows.length > 0) {
            console.log('\n   Tables found:');
            tablesList.rows.forEach(row => {
              console.log(`   - ${row.table_name}`);
            });
            if (tableCount > 10) {
              console.log(`   ... and ${tableCount - 10} more`);
            }
          }
        } else {
          console.log('⚠️  Database exists but has NO tables yet');
          console.log('   The server will auto-run migrations on startup');
        }

        await targetPool.end();
      } catch (error) {
        console.error(`❌ Cannot connect to database "${databaseName}":`, error.message);
        console.log('\nPossible issues:');
        console.log('   - Database exists but user lacks permissions');
        console.log('   - Connection credentials are incorrect');
        await targetPool.end();
      }
    } else {
      console.log(`❌ Database "${databaseName}" DOES NOT EXIST\n`);
      console.log('📝 To create the database, run:');
      console.log(`   createdb -U ${username} -h ${host} -p ${port} ${databaseName}`);
      console.log('\nOr connect to PostgreSQL and run:');
      console.log(`   CREATE DATABASE ${databaseName};`);
    }

    await adminPool.end();
    process.exit(exists ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Error checking database:', error.message);
    
    if (error.code === '28P01') {
      console.error('\nAuthentication failed. Please check:');
      console.error('   - Username and password in DATABASE_URL');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\nCannot connect to PostgreSQL server. Please check:');
      console.error('   - PostgreSQL is running');
      console.error(`   - Host: ${host}`);
      console.error(`   - Port: ${port}`);
    } else {
      console.error('\nError details:', error);
    }
    
    await adminPool.end();
    process.exit(1);
  }
}

checkDatabaseExists();

