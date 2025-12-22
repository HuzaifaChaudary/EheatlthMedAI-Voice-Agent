const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const router = express.Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        message: 'An account with this email already exists. Please try logging in instead.' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName, 'user', true]
    );

    const user = result.rows[0];

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log registration
    await db.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details) VALUES ($1, $2, $3, $4, $5)',
      [
        user.id,
        'REGISTER',
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ 
        message: 'An account with this email already exists. Please try logging in instead.' 
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const { email, password } = req.body;

    // Find user
    const result = await db.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active, google_id FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Check if user has a password (OAuth users might not)
    if (!user.password_hash) {
      return res.status(401).json({ 
        message: 'This account was created with Google Sign-In. Please use "Sign in with Google" instead.' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log login
    await db.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details) VALUES ($1, $2, $3, $4, $5)',
      [
        user.id,
        'LOGIN',
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token required' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    res.json({ valid: true, user: result.rows[0] });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.id]
    );

    // In production, send email here
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    console.log('Password reset link for', email, ':', resetLink);

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, details) VALUES ($1, $2, $3, $4)',
      [
        user.id,
        'PASSWORD_RESET_REQUEST',
        req.ip || req.connection.remoteAddress,
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    res.json({ 
      message: 'If an account exists with this email, a password reset link has been sent.',
      // Remove this in production - only for development
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    // Find user with valid reset token
    const result = await db.query(
      'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const user = result.rows[0];

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Update password and clear reset token
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    // Log action
    await db.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, details) VALUES ($1, $2, $3, $4)',
      [
        user.id,
        'PASSWORD_RESET',
        req.ip || req.connection.remoteAddress,
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Google OAuth - Get auth URL
router.get('/google', (req, res) => {
  try {
    // Validate Google OAuth configuration
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth: Missing CLIENT_ID or CLIENT_SECRET');
      console.error('CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
      console.error('CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
      return res.status(500).json({ 
        error: 'Google OAuth not configured',
        message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file'
      });
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
    const clientId = process.env.GOOGLE_CLIENT_ID.trim();
    
    console.log('Google OAuth: Generating URL');
    console.log('Redirect URI:', redirectUri);
    console.log('Client ID (first 20 chars):', clientId.substring(0, 20) + '...');
    console.log('\n⚠️  IMPORTANT: Make sure this redirect URI is added to Google Cloud Console:');
    console.log(`   ${redirectUri}`);
    console.log('   Go to: APIs & Services > Credentials > Your OAuth 2.0 Client ID > Authorized redirect URIs\n');
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=openid email profile&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    console.log('Google OAuth URL generated successfully');
    res.json({ 
      url: googleAuthUrl,
      redirectUri: redirectUri // Include in response for debugging
    });
  } catch (error) {
    console.error('Google OAuth URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate Google OAuth URL', details: error.message });
  }
});

// Google OAuth - Callback
router.get('/google/callback', async (req, res) => {
  try {
    console.log('🔵 Google OAuth callback received');
    console.log('Query params:', JSON.stringify(req.query));
    console.log('Redirect URI from env:', process.env.GOOGLE_REDIRECT_URI);
    console.log('Frontend URL from env:', process.env.FRONTEND_URL);
    
    const { code } = req.query;

    if (!code) {
      console.error('❌ Google OAuth callback: Missing authorization code');
      console.error('Full query:', req.query);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed&details=missing_code`);
    }
    
    console.log('✅ Authorization code received');

    // Validate configuration
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth callback: Missing CLIENT_ID or CLIENT_SECRET');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_not_configured`);
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      console.error('Google OAuth callback: Token exchange failed');
      console.error('Token response:', JSON.stringify(tokens, null, 2));
      console.error('Request details:', {
        redirect_uri: redirectUri,
        client_id: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...' : 'NOT SET',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET'
      });
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_token_failed`);
    }
    
    console.log('Google OAuth: Token exchange successful');

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      console.error('Google OAuth: Failed to get user info', userResponse.status, userResponse.statusText);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_user_info_failed`);
    }

    const googleUser = await userResponse.json();
    console.log('Google OAuth: User info retrieved', { email: googleUser.email, id: googleUser.id });

    // Find or create user
    let userResult = await db.query(
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE google_id = $1 OR email = $2',
      [googleUser.id, googleUser.email]
    );

    let user;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      
      // Update Google info if needed
      if (!user.google_id) {
        await db.query(
          'UPDATE users SET google_id = $1, google_email = $2, avatar_url = $3 WHERE id = $4',
          [googleUser.id, googleUser.email, googleUser.picture, user.id]
        );
      }
    } else {
      // Create new user
      const insertResult = await db.query(
        `INSERT INTO users (email, first_name, last_name, google_id, google_email, avatar_url, password_hash) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, email, first_name, last_name, role, is_active`,
        [
          googleUser.email,
          googleUser.given_name || '',
          googleUser.family_name || '',
          googleUser.id,
          googleUser.email,
          googleUser.picture,
          crypto.randomBytes(32).toString('hex') // Random hash for OAuth users
        ]
      );
      user = insertResult.rows[0];
    }

    if (!user.is_active) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=account_deactivated`);
    }

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=server_config_error`);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log login
    await db.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details) VALUES ($1, $2, $3, $4, $5)',
      [
        user.id,
        'GOOGLE_LOGIN',
        req.ip || req.connection.remoteAddress,
        req.get('user-agent'),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const callbackUrl = `${frontendUrl}/auth/callback?token=${token}`;
    console.log('✅ Google OAuth: Success! Redirecting to frontend');
    console.log('Frontend URL:', frontendUrl);
    console.log('Callback URL:', callbackUrl);
    console.log('Token length:', token.length);
    res.redirect(callbackUrl);
  } catch (error) {
    console.error('Google OAuth error:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/login?error=oauth_failed&details=${encodeURIComponent(error.message)}`);
  }
});

// Google OAuth - Test endpoint
router.get('/google/test', (req, res) => {
  res.json({
    configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    clientId: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...' : 'NOT SET',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET (' + process.env.GOOGLE_CLIENT_SECRET.length + ' chars)' : 'NOT SET',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  });
});

module.exports = router;
