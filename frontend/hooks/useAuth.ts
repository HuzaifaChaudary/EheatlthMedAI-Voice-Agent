/**
 * Authentication Hook
 * Provides authentication state and methods
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { tokenManager, sessionManager, isAuthenticated, clearAuth } from '../lib/auth'
import { post, get } from '../lib/api'

interface User {
  id: string
  email: string
  role: string
  firstName?: string
  lastName?: string
}

interface UseAuthReturn {
  user: User | null
  loading: boolean
  isAuth: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuth, setIsAuth] = useState(false)

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = useCallback(async () => {
    console.log('Checking authentication...')

    try {
      if (!isAuthenticated()) {
        console.log('User is not authenticated')
        setUser(null)
        setIsAuth(false)
        setLoading(false)
        return
      }

      // Get user from session or fetch from API
      const session = sessionManager.getUser()
      if (session) {
        console.log('Session found:', session)
        setUser({
          id: session.userId,
          email: session.email,
          role: session.role,
          firstName: session.firstName,
          lastName: session.lastName
        })
        setIsAuth(true)
        setLoading(false)
        return
      }

      console.log('Session not found, fetching from API...')
      // Fetch user from API
      const response = await get('/users/me')
      console.log('API response:', response)

      if (response.data?.user) {
        const userData = response.data.user
        setUser({
          id: userData.id?.toString() || userData.userId?.toString(),
          email: userData.email,
          role: userData.role,
          firstName: userData.first_name || userData.firstName,
          lastName: userData.last_name || userData.lastName
        })
        sessionManager.createSession(userData)
        setIsAuth(true)
      } else {
        console.log('No user data found, clearing auth...')
        clearAuth()
        setIsAuth(false)
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check error:', error)
      clearAuth()
      setIsAuth(false)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.log('Logging in with email:', email)

    try {
      const response = await post('/auth/login', { email, password }, { skipAuth: true })
      console.log('Login API response:', response)

      if (response.error) {
        console.error('Login error:', response.error)
        return { success: false, error: response.error }
      }

      if (response.data?.token) {
        console.log('Login successful, setting token...')
        tokenManager.setToken(response.data.token, 7 * 24 * 60 * 60) // 7 days
        if (response.data.user) {
          sessionManager.createSession(response.data.user)
          setUser({
            id: response.data.user.id?.toString() || response.data.user.userId?.toString(),
            email: response.data.user.email,
            role: response.data.user.role,
            firstName: response.data.user.first_name || response.data.user.firstName,
            lastName: response.data.user.last_name || response.data.user.lastName
          })
        }
        setIsAuth(true)
        return { success: true }
      }

      console.error('Invalid response from server')
      return { success: false, error: 'Invalid response from server' }
    } catch (error: any) {
      console.error('Login failed:', error)
      return { success: false, error: error.message || 'Login failed' }
    }
  }, [])

  const logout = useCallback(() => {
    console.log('Logging out...')
    clearAuth()
    setUser(null)
    setIsAuth(false)
    router.push('/')
  }, [router])

  const refreshUser = useCallback(async () => {
    console.log('Refreshing user session...')
    await checkAuth()
  }, [checkAuth])

  return {
    user,
    loading,
    isAuth,
    login,
    logout,
    refreshUser
  }
}
