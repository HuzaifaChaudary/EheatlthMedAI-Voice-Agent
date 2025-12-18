/**
 * Authentication Middleware Component
 * Protects routes that require authentication
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '../lib/auth'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = '/login' }: AuthGuardProps) {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push(redirectTo)
    }
  }, [router, redirectTo])

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Checking authentication...</div>
      </div>
    )
  }

  return <>{children}</>
}

