const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, param, query, validationResult } = require('express-validator');

// Rate limiting configurations
const isDevelopment = process.env.NODE_ENV !== 'production';

const createRateLimiter = (windowMs, maxRequests, message) => {
  return rateLimit({
    windowMs: windowMs,
    max: maxRequests,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      if (req.path === '/api/health') {
        return true;
      }
      // In development, skip rate limiting for localhost
      if (isDevelopment && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1')) {
        return true;
      }
      return false;
    }
  });
};

// General API rate limiter (much higher in development)
const apiLimiter = createRateLimiter(
  15 * 60 * 1000,
  isDevelopment ? 10000 : 100, // 10,000 in dev, 100 in production
  'Too many requests, please try again later.'
);

// Strict rate limiter for auth endpoints (more lenient in development)
const authLimiter = createRateLimiter(
  15 * 60 * 1000,
  isDevelopment ? 1000 : 5, // 1,000 in dev, 5 in production
  'Too many authentication attempts, please try again later.'
);

// Strict rate limiter for sensitive operations (more lenient in development)
const sensitiveOperationLimiter = createRateLimiter(
  60 * 60 * 1000,
  isDevelopment ? 1000 : 10, // 1,000 in dev, 10 in production
  'Too many sensitive operations, please try again later.'
);

// Helmet configuration for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Input validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// Common validation rules
const validations = {
  id: param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  
  email: body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  organizationId: body('organization_id').optional().isInt({ min: 1 }),
  
  vendorName: body('vendor_name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Vendor name is required and must be less than 255 characters'),
  
  phoneNumber: body('phone_number')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  
  date: body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in ISO 8601 format'),
  
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ]
};

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Recursively sanitize string inputs to prevent XSS
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/[<>]/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

module.exports = {
  apiLimiter,
  authLimiter,
  sensitiveOperationLimiter,
  helmetConfig,
  validateInput,
  validations,
  sanitizeInput
};

