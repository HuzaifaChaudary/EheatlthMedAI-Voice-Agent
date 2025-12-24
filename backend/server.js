// Load environment variables FIRST, before any other requires
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const db = require('./config/database');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Socket.io setup (if installed)
let io = null;
let server = null;

try {
  const { Server } = require('socket.io');
  server = http.createServer(app);
  
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log('✅ Socket client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('❌ Socket client disconnected:', socket.id);
    });

    // Handle authentication
    socket.on('authenticate', (token) => {
      console.log('🔐 Socket authentication attempt');
    });
  });

  // Make io available to routes
  app.set('io', io);
  console.log('✅ Socket.io initialized');
} catch (error) {
  // Fallback if socket.io not installed
  console.warn('⚠️  Socket.io not installed, starting without WebSocket support');
  server = http.createServer(app);
}

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
const { checkIPBlock, detectSuspiciousRequests } = require('./middleware/ipBlockCheck');

app.use(helmetConfig);
// Global IP block check - runs before rate limiting to save resources
app.use(checkIPBlock);
// Detect suspicious requests globally
app.use(detectSuspiciousRequests);

app.use(apiLimiter);
app.use(sanitizeInput);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve receipt PDFs
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));
// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes with rate limiting
const { authLimiter, sensitiveOperationLimiter } = require('./middleware/security');
const { authenticateToken } = require('./middleware/auth'); // Added this line
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
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reminder-config', require('./routes/reminder-config'));
app.use('/api/medical-assistant', require('./routes/medical-assistant'));
app.use('/api/triage', require('./routes/triage'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/collections', require('./routes/collections'));

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
  console.log('❌ 404 - Endpoint not found:', req.method, req.path);
  console.log('   Full URL:', req.url);
  res.status(404).json({
    message: 'Endpoint not found',
    path: req.path,
    method: req.method
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
      // Only add non-empty statements that are more than just a semicolon
      if (statement && statement !== ';' && statement.length > 1) {
        // Remove trailing semicolons if multiple
        const cleaned = statement.replace(/;+$/, ';');
        if (cleaned.length > 1) {
          statements.push(cleaned);
        }
      }
      current = '';
    }
  }

  // Handle any remaining statement without semicolon (shouldn't happen, but just in case)
  if (current.trim() && current.trim().length > 1) {
    const remaining = current.trim();
    if (!remaining.startsWith('--')) {
      statements.push(remaining);
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
            // Ignore common non-critical errors
            const errorMsg = err.message.toLowerCase();
            const shouldIgnore = 
              err.message.includes('already exists') ||
              err.message.includes('does not exist') ||
              errorMsg.includes('must be member of role') ||
              errorMsg.includes('cannot change owner') ||
              errorMsg.includes('multiple primary keys') ||
              errorMsg.includes('syntax error at end of input') ||
              errorMsg.includes('unrecognized configuration parameter');
            
            if (!shouldIgnore) {
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
            // Ignore common non-critical errors
            const errorMsg = err.message.toLowerCase();
            const shouldIgnore = 
              err.message.includes('already exists') ||
              err.message.includes('does not exist') ||
              errorMsg.includes('must be member of role') ||
              errorMsg.includes('cannot change owner') ||
              errorMsg.includes('multiple primary keys') ||
              errorMsg.includes('syntax error at end of input') ||
              errorMsg.includes('unrecognized configuration parameter');
            
            if (!shouldIgnore) {
              console.error(`  ✗ Statement ${i + 1} failed:`, err.message);
            }
          }
        }
        console.log(`✅ db-updates.sql completed (${statements.length} statements)`);
      }

      // Run security-incidents-schema.sql
      if (fs.existsSync(path.join(__dirname, 'config', 'security-incidents-schema.sql'))) {
        console.log('📝 Running security-incidents-schema.sql...');
        const securitySchema = fs.readFileSync(path.join(__dirname, 'config', 'security-incidents-schema.sql'), 'utf8');
        const statements = parseSQLStatements(securitySchema);

        for (let i = 0; i < statements.length; i++) {
          try {
            await db.query(statements[i]);
          } catch (err) {
            // Ignore common non-critical errors
            const errorMsg = err.message.toLowerCase();
            const shouldIgnore = 
              err.message.includes('already exists') ||
              err.message.includes('does not exist') ||
              errorMsg.includes('must be member of role') ||
              errorMsg.includes('cannot change owner') ||
              errorMsg.includes('multiple primary keys') ||
              errorMsg.includes('syntax error at end of input') ||
              errorMsg.includes('unrecognized configuration parameter');
            
            if (!shouldIgnore) {
              console.error(`  ✗ Statement ${i + 1} failed:`, err.message);
            }
          }
        }
        console.log(`✅ security-incidents-schema.sql completed (${statements.length} statements)`);
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
            // Ignore common non-critical errors
            const errorMsg = err.message.toLowerCase();
            const shouldIgnore = 
              err.message.includes('already exists') ||
              err.message.includes('does not exist') ||
              errorMsg.includes('must be member of role') ||
              errorMsg.includes('cannot change owner') ||
              errorMsg.includes('multiple primary keys') ||
              errorMsg.includes('syntax error at end of input') ||
              errorMsg.includes('unrecognized configuration parameter');
            
            if (!shouldIgnore) {
              console.error('  ✗ Error:', err.message);
            }
          }
        }
      }

      // Run security-incidents-schema.sql updates
      if (fs.existsSync(path.join(__dirname, 'config', 'security-incidents-schema.sql'))) {
        console.log('📝 Checking security-incidents-schema.sql...');
        const securitySchema = fs.readFileSync(path.join(__dirname, 'config', 'security-incidents-schema.sql'), 'utf8');
        const statements = parseSQLStatements(securitySchema);

        for (const statement of statements) {
          try {
            await db.query(statement);
          } catch (err) {
            // Ignore common non-critical errors
            const errorMsg = err.message.toLowerCase();
            const shouldIgnore = 
              err.message.includes('already exists') ||
              err.message.includes('does not exist') ||
              errorMsg.includes('must be member of role') ||
              errorMsg.includes('cannot change owner') ||
              errorMsg.includes('multiple primary keys') ||
              errorMsg.includes('syntax error at end of input') ||
              errorMsg.includes('unrecognized configuration parameter');
            
            if (!shouldIgnore) {
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

    // Run integrations schema
    const integrationsSchema = fs.readFileSync(path.join(__dirname, 'config', 'integrations-schema.sql'), 'utf8');
    await db.query(integrationsSchema);
    console.log('Integrations schema checked/updated');

    // Start HL7 Listener (Default port 7777)
    // In production, port might be configurable or fetched from DB config
    const hl7Service = require('./services/hl7Service');
    try {
      hl7Service.startServer(process.env.HL7_PORT || 7777, db);
    } catch (hl7Error) {
      console.error('Failed to start HL7 Server:', hl7Error);
    }
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
server.listen(PORT, '0.0.0.0', () => {
  startServer().catch(err => {
    console.error('❌ Server startup failed:', err);
  });
});

module.exports = app;
