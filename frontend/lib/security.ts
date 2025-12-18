/**
 * Security Utilities
 * Input sanitization, XSS prevention, and security helpers
 */

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj

  if (Array.isArray(obj)) {
    return obj.map(item => 
      typeof item === 'string' ? sanitizeInput(item) : sanitizeObject(item)
    ) as unknown as T
  }

  const sanitized = { ...obj }
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeInput(sanitized[key]) as T[Extract<keyof T, string>]
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]) as T[Extract<keyof T, string>]
    }
  }

  return sanitized
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

/**
 * Generate secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  if (typeof window === 'undefined' || !window.crypto) {
    // Fallback for environments without crypto
    return Math.random().toString(36).substring(2, length + 2)
  }

  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash string (simple hash, not for passwords)
 */
export function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}

/**
 * Check if payload size is acceptable
 */
export function validatePayloadSize(payload: any, maxSizeKB: number = 100): boolean {
  const jsonString = JSON.stringify(payload)
  const sizeKB = new Blob([jsonString]).size / 1024
  return sizeKB <= maxSizeKB
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []

    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < this.windowMs)

    if (recentRequests.length >= this.maxRequests) {
      return false
    }

    recentRequests.push(now)
    this.requests.set(identifier, recentRequests)
    return true
  }

  reset(identifier: string): void {
    this.requests.delete(identifier)
  }
}

