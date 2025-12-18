/**
 * Secure API Client
 * Handles all API requests with security best practices
 */

import { tokenManager, sessionManager, clearAuth, getAuthHeader } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://ehealthmedai-backend.onrender.com/api'
    : 'http://localhost:5000/api'
)

// Track if we've already attempted redirect to prevent loops
const REDIRECT_KEY = 'auth_redirect_attempted'

interface RequestOptions extends RequestInit {
  requireAuth?: boolean
  skipAuth?: boolean
}

interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  ok?: boolean // Add for backwards compatibility
}

/**
 * Generate CSRF token
 */
const generateCSRFToken = (): string => {
  if (typeof window === 'undefined') return ''
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Get or create CSRF token
 */
const getCSRFToken = (): string => {
  if (typeof window === 'undefined') return ''
  
  let token = sessionStorage.getItem('csrf_token')
  if (!token) {
    token = generateCSRFToken()
    sessionStorage.setItem('csrf_token', token)
  }
  return token
}

/**
 * Secure API request
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    requireAuth = true,
    skipAuth = false,
    headers = {},
    body,
    ...restOptions
  } = options

  // Check authentication
  if (requireAuth && !skipAuth) {
    const token = tokenManager.getToken()
    if (!token || tokenManager.isTokenExpired()) {
      // Return error instead of redirecting - let pages handle it
      return { ok: false, error: 'Authentication required' }
    }
  }

  // Build headers
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-Token': getCSRFToken(),
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }

  // Add authorization header to base headers object first
  if (requireAuth && !skipAuth) {
    const authHeader = getAuthHeader()
    if (authHeader) {
      baseHeaders['Authorization'] = authHeader
      console.log('🔐 Auth header added:', authHeader.substring(0, 20) + '...')
    } else {
      console.warn('⚠️ No auth token found for authenticated request to:', endpoint)
    }
  }

  // Add custom headers
  if (headers) {
    Object.assign(baseHeaders, headers)
  }

  const requestHeaders = new Headers(baseHeaders)

  // Sanitize body
  let requestBody: string | undefined
  if (body) {
    if (typeof body === 'string') {
      requestBody = body
    } else {
      requestBody = JSON.stringify(body)
    }
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...restOptions,
      headers: requestHeaders,
      body: requestBody,
      credentials: 'include', // Include cookies for CSRF protection
      cache: 'no-store' // Disable caching to always get fresh data
    })

    // Parse response first to check error type
    const contentType = response.headers.get('content-type')
    let data: any

    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    // Only redirect on actual authentication errors (401/403 with auth-related messages)
    if (response.status === 401 || response.status === 403) {
      const errorMessage = data?.message || data?.error || ''
      const isAuthError = errorMessage.toLowerCase().includes('token') || 
                         errorMessage.toLowerCase().includes('authentication') ||
                         errorMessage.toLowerCase().includes('unauthorized') ||
                         errorMessage.toLowerCase().includes('forbidden')
      
      if (isAuthError) {
        console.warn('🔓 Invalid/expired token detected, clearing auth...')
        clearAuth()
        
        // Only redirect once per session to prevent loops
        if (typeof window !== 'undefined') {
          const lastRedirect = sessionStorage.getItem(REDIRECT_KEY)
          const now = Date.now()
          
          // Only redirect if:
          // 1. Not already on login page
          // 2. Haven't redirected in the last 5 seconds (prevents loops)
          if (!window.location.pathname.includes('/login') && 
              (!lastRedirect || (now - parseInt(lastRedirect)) > 5000)) {
            sessionStorage.setItem(REDIRECT_KEY, now.toString())
            window.location.href = '/login?error=session_invalid'
          }
        }
        return { ok: false, error: 'Session expired. Please login again.' }
      }
      
      // For non-auth 401/403 errors, just return the error without redirecting
      return {
        ok: false,
        error: errorMessage || `Request failed: ${response.statusText}`,
        data: data
      }
    }

    // If we already parsed data above, use it; otherwise parse now
    if (!data) {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        error: data?.message || data?.error || `Request failed: ${response.statusText}`,
        data: data
      }
    }

    return { ok: true, data }
  } catch (error: any) {
    console.error('API request error:', error)
    return {
      ok: false,
      error: error.message || 'Network error. Please check your connection.'
    }
  }
}

/**
 * Refresh authentication token
 */
async function refreshToken(): Promise<boolean> {
  const refreshToken = tokenManager.getRefreshToken()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`
      },
      credentials: 'include'
    })

    if (response.ok) {
      const data = await response.json()
      if (data.token) {
        tokenManager.setToken(data.token, data.expiresIn)
        if (data.user) {
          sessionManager.createSession(data.user, data.expiresIn * 1000)
        }
        return true
      }
    }
  } catch (error) {
    console.error('Token refresh error:', error)
  }

  return false
}

/**
 * GET request
 */
export async function get<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' })
}

/**
 * POST request
 */
export async function post<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'POST', body })
}

/**
 * PUT request
 */
export async function put<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'PUT', body })
}

/**
 * PATCH request
 */
export async function patch<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'PATCH', body })
}

/**
 * DELETE request
 */
export async function del<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' })
}

/**
 * Upload file securely
 */
export async function uploadFile<T = any>(
  endpoint: string,
  file: File,
  additionalData?: Record<string, any>
): Promise<ApiResponse<T>> {
  const formData = new FormData()
  formData.append('file', file)
  
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value))
      }
    })
  }

  const authHeader = getAuthHeader()
  const headers: Record<string, string> = {
    'X-CSRF-Token': getCSRFToken(),
    'X-Requested-With': 'XMLHttpRequest'
  }

  if (authHeader) {
    headers['Authorization'] = authHeader
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include'
    })

    // Parse response to check error type
    let uploadData: any
    try {
      uploadData = await response.json()
    } catch {
      uploadData = { error: response.statusText }
    }

    // Only redirect on actual authentication errors
    if (response.status === 401 || response.status === 403) {
      const errorMessage = uploadData?.message || uploadData?.error || ''
      const isAuthError = errorMessage.toLowerCase().includes('token') || 
                         errorMessage.toLowerCase().includes('authentication') ||
                         errorMessage.toLowerCase().includes('unauthorized') ||
                         errorMessage.toLowerCase().includes('forbidden')
      
      if (isAuthError) {
        console.warn('🔓 Invalid/expired token detected during upload, clearing auth...')
        clearAuth()
        
        // Only redirect once per session to prevent loops
        if (typeof window !== 'undefined') {
          const lastRedirect = sessionStorage.getItem(REDIRECT_KEY)
          const now = Date.now()
          
          if (!window.location.pathname.includes('/login') && 
              (!lastRedirect || (now - parseInt(lastRedirect)) > 5000)) {
            sessionStorage.setItem(REDIRECT_KEY, now.toString())
            window.location.href = '/login?error=session_invalid'
          }
        }
        return { ok: false, error: 'Session expired. Please login again.' }
      }
      
      // For non-auth errors, return error without redirecting
      return {
        ok: false,
        error: errorMessage || `Upload failed: ${response.statusText}`,
        data: uploadData
      }
    }

    const data = await response.json()

    if (!response.ok) {
      return {
        ok: false,
        error: data.message || data.error || `Upload failed: ${response.statusText}`,
        data: data
      }
    }

    return { ok: true, data }
  } catch (error: any) {
    console.error('File upload error:', error)
    return {
      ok: false,
      error: error.message || 'Upload failed. Please try again.'
    }
  }
}
