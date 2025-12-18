const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/database');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - allow all Vercel deployments and localhost
const corsOptions = {
  origin: function (origin, callback) {
    // In development, allow all origins for easier debugging
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      if (isDevelopment) {
        console.log('🔓 CORS: Allowing request with no origin (development mode)');
      }
      return callback(null, true);
    }
    
    if (isDevelopment) {
      console.log(`🌐 CORS: Checking origin: ${origin}`);
    }
    
    // Allow localhost in any form (http://localhost, http://localhost:3000, etc.)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      if (isDevelopment) {
        console.log('✅ CORS: Allowing localhost origin');
      }
      return callback(null, true);
    }
    
    // Allow all Vercel deployments
    if (origin.endsWith('.vercel.app')) {
      if (isDevelopment) {
        console.log('✅ CORS: Allowing Vercel deployment');
      }
      return callback(null, true);
    }
    
    // Allow specific origins from env
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : [];
    
    if (allowedOrigins.includes(origin)) {
      if (isDevelopment) {
        console.log('✅ CORS: Allowing origin from env');
      }
      return callback(null, true);
    }
    
    // In development, allow all origins as fallback
    if (isDevelopment) {
      console.log(`⚠️ CORS: Allowing unknown origin in development: ${origin}`);
      return callback(null, true);
    }
    
    console.log(`❌ CORS: Blocking origin: ${origin}`);
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: [
    'Authorization',
    'Content-Type'
  ],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight

// Security middleware
const { helmetConfig, apiLimiter, sanitizeInput } = require('./middleware/security');
app.use(helmetConfig);
app.use(apiLimiter);
app.use(sanitizeInput);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes with rate limiting
const { authLimiter, sensitiveOperationLimiter } = require('./middleware/security');
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/telephony', require('./routes/telephony'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/hipaa', sensitiveOperationLimiter, require('./routes/hipaa'));
app.use('/api/terminology', require('./routes/terminology'));
app.use('/api/references', require('./routes/references'));
app.use('/api/stakeholders', require('./routes/stakeholders'));
app.use('/api/voice-ai', require('./routes/voice-ai'));
app.use('/api/integrations-ehr', require('./routes/integrations-ehr'));
app.use('/api/security', sensitiveOperationLimiter, require('./routes/security'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/presentation', require('./routes/presentation'));
app.use('/api/requirements', require('./routes/requirements'));
app.use('/api/assumptions-constraints', require('./routes/assumptions-constraints'));
app.use('/api/srs', require('./routes/srs'));
app.use('/api/change-control', require('./routes/change-control'));
app.use('/api/deliverables', require('./routes/deliverables'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/ai-status', require('./routes/ai-status'));
app.use('/api/webchat', require('./routes/webchat'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'EHealth Med AI API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'EHealth Med AI API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      docs: 'Contact admin for API documentation'
    }
  });
});

// Error handling middleware - handle CORS errors specifically
app.use((err, req, res, next) => {
  // Handle CORS errors
  if (err.message && err.message.includes('CORS')) {
    console.error('CORS Error:', err.message);
    return res.status(403).json({ 
      error: 'CORS error',
      message: err.message,
      origin: req.headers.origin || 'unknown'
    });
  }
  
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({ 
    message: err.message || 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Endpoint not found',
    path: req.path 
  });
});

/**
 * Parse SQL into separate statements
 */
function parseSQLStatements(sql) {
  const statements = [];
  let current = '';
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('--')) continue;
    
    current += line + '\n';
    
    // End of statement
    if (trimmed.endsWith(';')) {
      const statement = current.trim();
      if (statement && statement !== ';') {
        statements.push(statement);
      }
      current = '';
    }
  }
  
  return statements;
}

/**
 * Initialize database - run migrations if needed
 */
async function initializeDatabase() {
  try {
    console.log('🔍 Checking database...');
    
    // Check if users table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Database tables not found. Running migrations...');
      
      // Run db.sql
      if (fs.existsSync(path.join(__dirname, 'config', 'db.sql'))) {
        console.log('📝 Running db.sql...');
        const schema = fs.readFileSync(path.join(__dirname, 'config', 'db.sql'), 'utf8');
        const statements = parseSQLStatements(schema);
        
        for (let i = 0; i < statements.length; i++) {
          try {
            await db.query(statements[i]);
          } catch (err) {
            if (!err.message.includes('already exists')) {
              console.error(`  ✗ Statement ${i + 1} failed:`, err.message);
            }
          }
        }
        console.log(`✅ db.sql completed (${statements.length} statements)`);
      }
      
      // Run db-updates.sql
      if (fs.existsSync(path.join(__dirname, 'config', 'db-updates.sql'))) {
        console.log('📝 Running db-updates.sql...');
        const updates = fs.readFileSync(path.join(__dirname, 'config', 'db-updates.sql'), 'utf8');
        const statements = parseSQLStatements(updates);
        
        for (let i = 0; i < statements.length; i++) {
          try {
            await db.query(statements[i]);
          } catch (err) {
            if (!err.message.includes('already exists')) {
              console.error(`  ✗ Statement ${i + 1} failed:`, err.message);
            }
          }
        }
        console.log(`✅ db-updates.sql completed (${statements.length} statements)`);
      }
      
      console.log('✅ Database initialization completed!');
    } else {
      console.log('✅ Database tables exist');
      
      // Run updates anyway (they have IF NOT EXISTS checks)
      if (fs.existsSync(path.join(__dirname, 'config', 'db-updates.sql'))) {
        console.log('📝 Running db-updates.sql...');
        const updates = fs.readFileSync(path.join(__dirname, 'config', 'db-updates.sql'), 'utf8');
        const statements = parseSQLStatements(updates);
        
        for (const statement of statements) {
          try {
            await db.query(statement);
          } catch (err) {
            // Silently ignore "already exists" errors
            if (!err.message.includes('already exists')) {
              console.error('  ✗ Error:', err.message);
            }
          }
        }
      }
    }
    
    // List tables
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('📋 Database tables:', tables.rows.map(r => r.table_name).join(', '));
    
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    console.error('⚠️  Server will start but database may not be ready');
  }
}

// Start server function
async function startServer() {
  console.log('═'.repeat(50));
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('═'.repeat(50));
  
  // Initialize database
  await initializeDatabase();
  
  // Test database connection
  try {
    const result = await db.query('SELECT NOW() as time, version() as version');
    console.log('✅ Database connected successfully');
    console.log('⏰ Database time:', result.rows[0].time);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  }
  
  // Start scheduled tasks (only in production or if enabled)
  if (process.env.ENABLE_SCHEDULER === 'true' || process.env.NODE_ENV === 'production') {
    try {
      const schedulerService = require('./services/schedulerService');
      schedulerService.start();
      console.log('✅ Scheduled tasks started');
    } catch (error) {
      console.error('⚠️  Failed to start scheduler:', error.message);
    }
  }
  
  console.log('═'.repeat(50));
  console.log('✨ Server ready to accept requests');
  console.log('═'.repeat(50));
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  startServer().catch(err => {
    console.error('❌ Server startup failed:', err);
  });
});

module.exports = app;
