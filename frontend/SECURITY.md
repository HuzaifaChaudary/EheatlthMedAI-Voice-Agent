# Frontend Security Implementation

## Overview
This document describes the comprehensive security measures implemented in the EHealth Med AI frontend.

## Security Features

### 1. Token Management (`lib/auth.ts`)
- **Secure Storage**: Tokens are base64 encoded before storage
- **Token Expiration**: Automatic expiration checking
- **Session Management**: User sessions with expiry tracking
- **Secure Clear**: Complete cleanup of all auth data

**Usage:**
```typescript
import { tokenManager, sessionManager, isAuthenticated } from '@/lib/auth'

// Store token
tokenManager.setToken(token, expiresIn)

// Check authentication
if (isAuthenticated()) {
  // User is authenticated
}
```

### 2. Secure API Client (`lib/api.ts`)
- **Automatic Token Injection**: Tokens added to all authenticated requests
- **CSRF Protection**: CSRF tokens in all requests
- **Token Refresh**: Automatic token refresh on expiration
- **Error Handling**: Graceful handling of auth errors
- **Request Interceptors**: Automatic retry on 401 errors

**Usage:**
```typescript
import { get, post, put, del } from '@/lib/api'

// GET request
const response = await get('/users/me')

// POST request
const response = await post('/agents', { name: 'Agent 1' })
```

### 3. Input Sanitization (`lib/security.ts`)
- **XSS Prevention**: Sanitizes all user inputs
- **Email Validation**: Validates email format
- **Password Strength**: Validates password requirements
- **HTML Escaping**: Escapes HTML in user content
- **Payload Size Validation**: Prevents oversized payloads
- **Rate Limiting**: Rate limiting utilities

**Usage:**
```typescript
import { sanitizeInput, isValidEmail, validatePassword } from '@/lib/security'

// Sanitize input
const safe = sanitizeInput(userInput)

// Validate email
if (isValidEmail(email)) {
  // Valid email
}
```

### 4. Authentication Hook (`hooks/useAuth.ts`)
- **State Management**: Centralized auth state
- **Auto-refresh**: Automatic user data refresh
- **Login/Logout**: Secure login and logout methods

**Usage:**
```typescript
import { useAuth } from '@/hooks/useAuth'

const { user, isAuth, login, logout } = useAuth()
```

### 5. Security Headers (Next.js Config)
- **HSTS**: Strict Transport Security
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: XSS protection
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

## Security Best Practices

### Token Storage
- Tokens are encoded before storage
- Expiration times are tracked
- Tokens are cleared on logout

### API Requests
- All requests include CSRF tokens
- Authorization headers are automatically added
- Failed auth requests trigger token refresh
- Request/response interceptors handle errors

### Input Validation
- All user inputs are sanitized
- Email format is validated
- Password strength is enforced
- Payload sizes are limited

### Session Management
- Sessions expire automatically
- Session data is encrypted
- User data is cached for performance

## Migration Guide

### Old Code:
```typescript
const token = localStorage.getItem('token')
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
})
```

### New Secure Code:
```typescript
import { get } from '@/lib/api'
const response = await get('/endpoint')
```

## Security Checklist

- ✅ Secure token storage with encoding
- ✅ Automatic token expiration checking
- ✅ CSRF protection on all requests
- ✅ Input sanitization and validation
- ✅ XSS prevention
- ✅ Secure headers configuration
- ✅ Session management
- ✅ Automatic token refresh
- ✅ Error handling and logging
- ✅ Rate limiting utilities

## Notes

- In production, consider using httpOnly cookies instead of localStorage
- Implement proper encryption for sensitive data
- Add Content Security Policy (CSP) headers
- Implement request signing for critical operations
- Add audit logging for security events

