const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load .env from project root (where server.js lives)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Build pool config
let poolConfig = {};

if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
  };
  console.log('DB: using DATABASE_URL (present:', !!process.env.DATABASE_URL, ')');
} else if (process.env.DB_HOST || process.env.DB_USER || process.env.DB_NAME) {
  poolConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  };
  console.log('DB: using individual DB_* env vars (host present:', !!process.env.DB_HOST, ')');
} else {
  console.error('DB: No DATABASE_URL or DB_* env vars found. Database will not be initialized.');
  module.exports = {
    query: async () => { throw new Error('No DB config available (DATABASE_URL / DB_HOST missing)'); },
    pool: null,
  };
  return;
}

// Create pool and export a safe wrapper
const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected idle client error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

