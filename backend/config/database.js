const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Support both DATABASE_URL and individual connection parameters
let poolConfig;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
} else {
  // Use individual connection parameters
  // Ensure password is always a string (even if empty/undefined)
  const dbPassword = process.env.DB_PASSWORD;
  const passwordString = dbPassword !== undefined && dbPassword !== null ? String(dbPassword) : '';
  
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
    password: passwordString, // Always a string
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

