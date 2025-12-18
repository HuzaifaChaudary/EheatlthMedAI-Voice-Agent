const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function checkConnection() {
  console.log('Checking database connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set in .env file');
    console.log('\nPlease update backend/.env with:');
    console.log('DATABASE_URL=postgresql://username:password@localhost:5432/EHealthMedAI');
    process.exit(1);
  }
  
  // Extract database name from URL
  const urlMatch = process.env.DATABASE_URL.match(/\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (urlMatch) {
    const dbName = urlMatch[5];
    console.log('Database name in URL:', dbName);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
  
  try {
    const result = await pool.query('SELECT current_database(), version()');
    console.log('\n✓ Connection successful!');
    console.log('Connected to database:', result.rows[0].current_database);
    console.log('PostgreSQL version:', result.rows[0].version.split(',')[0]);
    
    // List all databases
    const dbList = await pool.query(`
      SELECT datname FROM pg_database 
      WHERE datistemplate = false 
      ORDER BY datname;
    `);
    
    console.log('\nAvailable databases:');
    dbList.rows.forEach(row => {
      const marker = row.datname === 'EHealthMedAI' ? ' ← Use this one' : '';
      console.log(`  - ${row.datname}${marker}`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Connection failed:', error.message);
    
    if (error.code === '3D000') {
      console.error('\nThe database does not exist. Please:');
      console.log('1. Make sure PostgreSQL is running');
      console.log('2. Create the database:');
      console.log('   CREATE DATABASE "EHealthMedAI";');
      console.log('\nOr update your .env file to use an existing database name.');
    }
    
    await pool.end();
    process.exit(1);
  }
}

checkConnection();

