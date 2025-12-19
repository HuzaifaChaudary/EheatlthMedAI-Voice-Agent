'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '../../components/Logo'
import { isAuthenticated, clearAuth, sessionManager, tokenManager } from '@/lib/auth'
import { get } from '@/lib/api'

interface Agent {
  id: number
  name: string
  type: string
  description: string
  is_active: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Check if we just logged in (need to wait longer for token to be available)
    const justLoggedIn = typeof window !== 'undefined' && sessionStorage.getItem('just_logged_in') === 'true'
    if (justLoggedIn) {
      sessionStorage.removeItem('just_logged_in') // Clear flag
      console.log('🔐 Just logged in, waiting longer for token to be available...')
    }
    
    // Check authentication - give it more attempts if we just logged in
    let attempts = 0
    const maxAttempts = justLoggedIn ? 10 : 5  // More attempts if just logged in
    let redirectAttempted = false
    const initialDelay = justLoggedIn ? 500 : 100  // Longer delay if just logged in
    
    const checkAuth = () => {
      attempts++
      const isAuth = isAuthenticated()
      
      console.log(`🔍 Auth check attempt ${attempts}/${maxAttempts}:`, isAuth ? '✅ Authenticated' : '❌ Not authenticated')
      
      if (isAuth) {
        console.log('✅ Authentication verified, loading dashboard...')
        // Fetch data in parallel
        Promise.all([
          fetchUser().catch(err => console.error('Error in fetchUser:', err)),
          fetchAgents().catch(err => console.error('Error in fetchAgents:', err))
        ]).finally(() => {
          // Ensure loading stops even if both fail
          setLoading(false)
        })
      } else if (attempts >= maxAttempts) {
        // Only redirect once if we've checked multiple times and still no auth
        if (!redirectAttempted) {
          redirectAttempted = true
          console.warn('❌ Authentication failed after multiple attempts, redirecting to login')
          
          // Double-check token before redirecting
          const token = tokenManager.getToken()
          const session = sessionManager.getSession()
          console.log('🔍 Final check - Token:', token ? 'Present' : 'Missing', 'Session:', session ? 'Present' : 'Missing')
          
          if (!token && !session) {
            // Use window.location for a hard redirect to prevent loops
            window.location.href = '/login?error=session_expired'
          } else {
            // We have token/session but isAuthenticated failed - try one more time
            console.warn('⚠️ Token/session exists but auth check failed, retrying...')
            setTimeout(() => {
              if (isAuthenticated()) {
                fetchUser()
                fetchAgents()
                setLoading(false)
              } else {
                window.location.href = '/login?error=session_expired'
              }
            }, 1000)
          }
        }
      } else {
        // Retry after a delay (longer delay if just logged in)
        const delay = justLoggedIn && attempts < 5 ? 400 : 200
        setTimeout(checkAuth, delay)
      }
    }

    // Initial delay (longer if we just logged in)
    const timer = setTimeout(() => {
      checkAuth()
    }, initialDelay)

    return () => clearTimeout(timer)
  }, [router])

  const fetchUser = async () => {
    try {
      // Try to get user from session first (faster UX)
      const sessionUser = sessionManager.getUser()
      if (sessionUser) {
        setUser({
          id: sessionUser.userId,
          email: sessionUser.email,
          role: sessionUser.role,
          first_name: sessionUser.firstName,
          last_name: sessionUser.lastName
        })
        // Don't wait for API - show user immediately from session
      }

      // Fetch fresh user data from API (don't block on this)
      try {
        const response = await get('/users/me')
        
        if (response.error) {
          console.error('❌ Error fetching user:', response.error)
          // Only redirect if it's an auth error, otherwise use session data
          if (response.error.includes('expired') || response.error.includes('invalid') || response.error.includes('Authentication')) {
            clearAuth()
            // Use window.location to prevent redirect loops
            window.location.href = '/login?error=session_expired'
            return
          }
          // For other errors, just log and continue (use session data)
          console.warn('⚠️ Using session data due to API error')
          return
        }

        if (response.data?.user) {
          setUser(response.data.user)
          // Update session
          sessionManager.createSession(response.data.user)
        }
      } catch (apiError: any) {
        console.error('❌ API error fetching user:', apiError)
        // Continue with session data
      }
    } catch (error: any) {
      console.error('❌ Error in fetchUser:', error)
      // Use session data if available
      const sessionUser = sessionManager.getUser()
      if (!sessionUser) {
        console.warn('⚠️ No session data available')
      }
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await get('/agents')
      
      if (response.error) {
        console.error('❌ Error fetching agents:', response.error)
        // Don't redirect on agent fetch errors - just show empty list
        if (response.error.includes('expired') || response.error.includes('invalid') || response.error.includes('Authentication')) {
          // This is an auth error, but we already checked auth, so just log it
          console.warn('⚠️ Auth error fetching agents, but user is authenticated')
        }
        setAgents([])
      } else if (response.data?.agents) {
        setAgents(response.data.agents)
      } else {
        setAgents([])
      }
    } catch (error) {
      console.error('❌ Error fetching agents:', error)
      setAgents([])
    } finally {
      // Always stop loading
      setLoading(false)
    }
  }

  // Safety timeout - ensure loading state doesn't last forever
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ Loading timeout reached, stopping loading state')
        setLoading(false)
      }
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [loading])

  const handleLogout = () => {
    clearAuth()
    router.push('/')
  }

  // Check if user is admin and show admin link
  const isAdmin = user?.role === 'admin'

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading dashboard...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    )
  }

  // Safety check - if we somehow don't have a user after loading, show a message
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Unable to load user data</div>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center">
          <Logo size="md" showText={true} />
        </Link>
        <div className="flex items-center space-x-6">
          {user && (
            <span className="text-white text-sm">
              {user.first_name} {user.last_name}
            </span>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Admin Panel
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-300">
            Manage your AI Voice Agents and monitor activity
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link
            href="/architecture"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">System Architecture</h3>
                <p className="text-slate-300 text-sm">Manage system layers</p>
              </div>
            </div>
          </Link>
          <Link
            href="/glossary"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">Terminology & Glossary</h3>
                <p className="text-slate-300 text-sm">Browse definitions and acronyms</p>
              </div>
            </div>
          </Link>
          <Link
            href="/references"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">Reference Standards</h3>
                <p className="text-slate-300 text-sm">HIPAA, HL7, FHIR, TCPA, and more</p>
              </div>
            </div>
          </Link>
          <Link
            href="/guidance"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">Reading Guidance</h3>
                <p className="text-slate-300 text-sm">Role-specific documentation</p>
              </div>
            </div>
          </Link>
          <Link
            href="/requirements"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">Requirements</h3>
                <p className="text-slate-300 text-sm">RFC 2119 requirements</p>
              </div>
            </div>
          </Link>
          <Link
            href="/assumptions-constraints"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">Assumptions & Constraints</h3>
                <p className="text-slate-300 text-sm">Operational assumptions and constraints</p>
              </div>
            </div>
          </Link>
          <Link
            href="/srs"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">SRS Documents</h3>
                <p className="text-slate-300 text-sm">Software Requirements Specification</p>
              </div>
            </div>
          </Link>
          <Link
            href="/deliverables"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">Deliverables</h3>
                <p className="text-slate-300 text-sm">Track next deliverables</p>
              </div>
            </div>
          </Link>
          <Link
            href="/change-control"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">Change Control</h3>
                <p className="text-slate-300 text-sm">Version change log</p>
              </div>
            </div>
          </Link>
          <Link
            href="/webchat"
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div>
                <h3 className="text-white font-semibold">Web Chat</h3>
                <p className="text-slate-300 text-sm">Interact with AI agents via web chat</p>
              </div>
            </div>
          </Link>
        <Link
          href="/appointments"
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <h3 className="text-white font-semibold">Appointments</h3>
              <p className="text-slate-300 text-sm">Manage patient appointments</p>
            </div>
          </div>
        </Link>

        <Link
          href="/billing"
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <h3 className="text-white font-semibold">Billing</h3>
              <p className="text-slate-300 text-sm">Manage statements, payments, and receipts</p>
            </div>
          </div>
        </Link>

        <Link
          href="/collections"
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-white font-semibold">Collections</h3>
              <p className="text-slate-300 text-sm">Manage payment plans, reminders, and compliance</p>
            </div>
          </div>
        </Link>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-white">{agent.name}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    agent.is_active
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-500 text-white'
                  }`}
                >
                  {agent.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-slate-200 mb-4">{agent.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-teal-300 text-sm font-medium">
                  {agent.type}
                </span>
                <Link
                  href={`/architecture/voice-ai?agent=${agent.id}`}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors inline-block"
                >
                  Configure
                </Link>
              </div>
            </div>
          ))}
        </div>

        {agents.length === 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center">
            <p className="text-white text-lg">No agents found</p>
          </div>
        )}
      </main>
    </div>
  )
}

