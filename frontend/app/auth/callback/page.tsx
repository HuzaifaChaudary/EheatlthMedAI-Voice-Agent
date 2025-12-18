'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { tokenManager } from '@/lib/auth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = () => {
      try {
        const token = searchParams.get('token')
        const error = searchParams.get('error')
        const details = searchParams.get('details')

        if (error) {
          console.error('OAuth callback error:', error, details)
          router.push(`/login?error=${encodeURIComponent(error)}${details ? `&details=${encodeURIComponent(details)}` : ''}`)
          return
        }

        if (token) {
          console.log('✅ Received token from OAuth callback, storing...')
          tokenManager.setToken(token, 7 * 24 * 60 * 60) // 7 days
          
          // Set flag for dashboard to know we just logged in
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('just_logged_in', 'true')
          }
          
          console.log('✅ Token stored, redirecting to dashboard...')
          router.push('/dashboard')
        } else {
          console.error('No token received in callback')
          router.push('/login?error=no_token')
        }
      } catch (error: any) {
        console.error('Callback error:', error)
        router.push(`/login?error=${encodeURIComponent(error.message || 'callback_failed')}`)
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-teal-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}

