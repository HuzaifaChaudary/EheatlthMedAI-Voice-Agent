'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { sanitizeInput, isValidEmail } from '@/lib/security'
import { post } from '@/lib/api'
import { tokenManager, sessionManager, clearAuth, isAuthenticated } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Clear any old/invalid tokens and show error message (only once on mount)
  useEffect(() => {
    // Only clear auth if we're coming from a redirect (has error param)
    const errorParam = searchParams.get('error')
    if (errorParam) {
      clearAuth() // Clear any existing auth data only if there's an error
      if (errorParam === 'session_invalid') {
        setError('Your session has expired or is invalid. Please login again.')
      } else if (errorParam === 'session_expired') {
        setError('Your session has expired. Please login again.')
      }
    }
    
    // Clear redirect flag when on login page
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_redirect_attempted')
    }
  }, []) // Only run once on mount, not on every searchParams change

  const handleGoogleLogin = async () => {
    try {
      setError('')
      console.log('Initiating Google login...')
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
      console.log('API URL:', apiUrl)
      
      const response = await fetch(`${apiUrl}/auth/google`)
      console.log('Response status:', response.status)
      
      const data = await response.json()
      console.log('Response data:', data)
      
      if (data.error) {
        console.error('Google OAuth error:', data)
        setError(data.message || data.error || 'Google OAuth is not configured. Please check server configuration.')
        return
      }
      
      if (data.url) {
        console.log('Redirecting to Google OAuth URL:', data.url)
        window.location.href = data.url
      } else {
        console.error('No URL in response:', data)
        setError('Failed to get Google OAuth URL')
      }
    } catch (err) {
      console.error('Google login error:', err)
      setError('Failed to initiate Google login. Please check your connection and try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validate email
    if (!isValidEmail(formData.email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    // Sanitize input
    const sanitizedData = {
      email: sanitizeInput(formData.email),
      password: formData.password // Don't sanitize password
    }

    try {
      const response = await post('/auth/login', sanitizedData, { skipAuth: true })

      if (response.error) {
        setError(response.error)
        setLoading(false)
        return
      }

      if (response.data?.token) {
        console.log('📝 Login successful, storing authentication...')
        
        // Store token securely
        tokenManager.setToken(response.data.token, 7 * 24 * 60 * 60) // 7 days
        
        // Verify token was stored
        const storedToken = tokenManager.getToken()
        if (!storedToken) {
          console.error('❌ Failed to store token')
          setError('Failed to save authentication. Please try again.')
          setLoading(false)
          return
        }
        console.log('✅ Token stored')
        
        // Create session
        if (response.data.user) {
          sessionManager.createSession(response.data.user)
          // Verify session was created
          const session = sessionManager.getSession()
          if (!session) {
            console.error('❌ Failed to create session')
            setError('Failed to create session. Please try again.')
            setLoading(false)
            return
          }
          console.log('✅ Session created for user:', session.email)
        } else {
          console.warn('⚠️ No user data in response')
        }

        // Verify token is stored (session is optional)
        const tokenCheck = tokenManager.getToken()
        if (!tokenCheck) {
          console.error('❌ Token not found after storing')
          setError('Failed to save authentication token. Please try again.')
          setLoading(false)
          return
        }
        
        console.log('✅ Token verified, ready to redirect')

        console.log('✅ Authentication verified, redirecting to dashboard...')
        
        // Store a flag that we just logged in (to help dashboard know to wait)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('just_logged_in', 'true')
        }
        
        // Use router for smoother transition (preserves React state)
        router.push('/dashboard')
        
        // Fallback: if router doesn't work, use window.location after delay
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location.pathname === '/login') {
            console.warn('⚠️ Router push failed, using window.location fallback')
            window.location.href = '/dashboard'
          }
        }, 1000)
      } else {
        console.error('❌ No token in response:', response.data)
        setError('Invalid response from server')
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-teal-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Welcome Back
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Sign in to your EHealth Med AI account
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              required
              autoComplete="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              required
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link
              href="/forgot-password"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-gray-600 text-sm">
            Don't have an account?{' '}
            <Link
              href="/signup"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Sign up
            </Link>
          </p>
          <Link
            href="/"
            className="text-teal-600 hover:text-teal-700 text-sm font-medium block"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

