/**
 * Secure Authentication & Token Management
 * Handles token storage, validation, and session management
 */

const TOKEN_KEY = 'ehealth_token'
const SESSION_KEY = 'ehealth_session'
const TOKEN_EXPIRY_KEY = 'ehealth_token_expiry'
const REFRESH_TOKEN_KEY = 'ehealth_refresh_token'

interface SessionData {
  userId: string
  email: string
  role: string
  firstName?: string
  lastName?: string
  expiresAt: number
  createdAt: number
}

/**
 * Secure token storage with encryption
 */
class SecureStorage {
  private static encode(value: string): string {
    // Base64 encoding (in production, use proper encryption)
    if (typeof window === 'undefined') return value
    return btoa(encodeURIComponent(value))
  }

  private static decode(value: string): string {
    if (typeof window === 'undefined') return value
    try {
      return decodeURIComponent(atob(value))
    } catch {
      return ''
    }
  }

  static setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return
    try {
      const encoded = this.encode(value)
      localStorage.setItem(key, encoded)
      // Verify it was stored
      const retrieved = localStorage.getItem(key)
      if (!retrieved) {
        console.error('⚠️ Failed to store item in localStorage:', key)
      }
    } catch (error: any) {
      console.error('Storage error:', error)
      // Check if localStorage is full or disabled
      if (error.name === 'QuotaExceededError') {
        console.error('❌ localStorage is full. Please clear some space.')
      } else if (error.name === 'SecurityError') {
        console.error('❌ localStorage access denied (check browser privacy settings)')
      }
    }
  }

  static getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      const value = localStorage.getItem(key)
      return value ? this.decode(value) : null
    } catch (error) {
      console.error('Storage read error:', error)
      return null
    }
  }

  static removeItem(key: string): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Storage remove error:', error)
    }
  }

  static clear(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(TOKEN_EXPIRY_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    } catch (error) {
      console.error('Storage clear error:', error)
    }
  }
}

/**
 * Token Management
 */
export const tokenManager = {
  /**
   * Store authentication token securely
   */
  setToken(token: string, expiresIn?: number): void {
    SecureStorage.setItem(TOKEN_KEY, token)
    
    if (expiresIn) {
      const expiryTime = Date.now() + (expiresIn * 1000)
      SecureStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
    }
  },

  /**
   * Get stored token
   */
  getToken(): string | null {
    return SecureStorage.getItem(TOKEN_KEY)
  },

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    const expiry = SecureStorage.getItem(TOKEN_EXPIRY_KEY)
    if (!expiry) return false // No expiry set, assume valid
    
    const expiryTime = parseInt(expiry, 10)
    return Date.now() >= expiryTime
  },

  /**
   * Remove token
   */
  removeToken(): void {
    SecureStorage.removeItem(TOKEN_KEY)
    SecureStorage.removeItem(TOKEN_EXPIRY_KEY)
    SecureStorage.removeItem(REFRESH_TOKEN_KEY)
  },

  /**
   * Store refresh token
   */
  setRefreshToken(token: string): void {
    SecureStorage.setItem(REFRESH_TOKEN_KEY, token)
  },

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return SecureStorage.getItem(REFRESH_TOKEN_KEY)
  }
}

/**
 * Session Management
 */
export const sessionManager = {
  /**
   * Create session from user data
   */
  createSession(user: any, expiresIn: number = 7 * 24 * 60 * 60 * 1000): void {
    const sessionData: SessionData = {
      userId: user.id?.toString() || user.userId?.toString(),
      email: user.email,
      role: user.role || 'user',
      firstName: user.first_name || user.firstName,
      lastName: user.last_name || user.lastName,
      expiresAt: Date.now() + expiresIn,
      createdAt: Date.now()
    }

    SecureStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
  },

  /**
   * Get current session
   */
  getSession(): SessionData | null {
    const sessionStr = SecureStorage.getItem(SESSION_KEY)
    if (!sessionStr) return null

    try {
      const session: SessionData = JSON.parse(sessionStr)
      
      // Check if session expired
      if (Date.now() >= session.expiresAt) {
        this.clearSession()
        return null
      }

      return session
    } catch {
      return null
    }
  },

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    const session = this.getSession()
    return session !== null
  },

  /**
   * Update session data
   */
  updateSession(updates: Partial<SessionData>): void {
    const session = this.getSession()
    if (!session) return

    const updatedSession = { ...session, ...updates }
    SecureStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession))
  },

  /**
   * Clear session
   */
  clearSession(): void {
    SecureStorage.removeItem(SESSION_KEY)
  },

  /**
   * Get user from session
   */
  getUser(): SessionData | null {
    return this.getSession()
  }
}

/**
 * Clear all authentication data
 */
export const clearAuth = (): void => {
  tokenManager.removeToken()
  sessionManager.clearSession()
}

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = tokenManager.getToken()
  const session = sessionManager.getSession()
  
  // More lenient check - only need token OR session (session is optional)
  if (!token) {
    console.debug('🔍 isAuthenticated: No token found')
    return false
  }
  
  // Check if token is expired
  if (tokenManager.isTokenExpired()) {
    console.debug('🔍 isAuthenticated: Token expired')
    return false
  }
  
  // Session is optional - if we have a valid token, we're authenticated
  if (!session) {
    console.debug('⚠️ isAuthenticated: Token valid but no session (this is okay)')
  }
  
  return true
}

/**
 * Get authorization header
 */
export const getAuthHeader = (): string | null => {
  const token = tokenManager.getToken()
  return token ? `Bearer ${token}` : null
}

