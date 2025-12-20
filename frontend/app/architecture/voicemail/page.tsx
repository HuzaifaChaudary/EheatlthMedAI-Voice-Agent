'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { get, patch, del } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface Voicemail {
  id: number
  caller_phone: string
  called_number: string
  recording_url: string
  duration_seconds: number
  transcription_text: string
  status: string
  created_at: string
}

export default function VoicemailPage() {
  const router = useRouter()
  const [voicemails, setVoicemails] = useState<Voicemail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchVoicemails()
  }, [router])

  const fetchVoicemails = async () => {
    try {
      setLoading(true)
      const response = await get('/telephony/voicemails?limit=100')
      if (response.data?.voicemails) {
        setVoicemails(response.data.voicemails)
      }
    } catch (error) {
      console.error('Error fetching voicemails:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: number) => {
    try {
      const response = await patch(`/telephony/voicemails/${id}/read`, {})
      if (response.error) {
        alert(`Error: ${response.error}`)
        return
      }
      fetchVoicemails()
    } catch (error: any) {
      alert(`Error marking as read: ${error.message}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this voicemail?')) {
      return
    }
    try {
      const response = await del(`/telephony/voicemails/${id}`)
      if (response.error) {
        alert(`Error: ${response.error}`)
        return
      }
      fetchVoicemails()
    } catch (error: any) {
      alert(`Error deleting voicemail: ${error.message}`)
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  const unreadCount = voicemails.filter(vm => vm.status === 'received').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
          </svg>
          <span className="text-white text-xl font-semibold">Voicemails</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/architecture" className="text-white hover:text-slate-300 text-sm">
            ← Architecture
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="text-slate-300">
            {voicemails.length} {voicemails.length === 1 ? 'voicemail' : 'voicemails'} 
            {unreadCount > 0 && ` • ${unreadCount} unread`}
          </div>
        </div>

        {voicemails.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
            <div className="text-slate-300 mb-4">No voicemails received yet.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {voicemails.map((vm) => (
              <div
                key={vm.id}
                className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors ${
                  vm.status === 'received' ? 'border-l-4 border-l-yellow-500' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{vm.caller_phone}</h3>
                      <span className={`px-2 py-1 text-xs rounded ${
                        vm.status === 'read'
                          ? 'bg-green-500/20 text-green-300 border border-green-500'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500'
                      }`}>
                        {vm.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-2">
                      Called: {vm.called_number} • Duration: {formatDuration(vm.duration_seconds || 0)}
                    </p>
                    {vm.transcription_text && (
                      <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                        <p className="text-slate-300 text-sm font-semibold mb-1">Transcription:</p>
                        <p className="text-slate-400 text-sm">{vm.transcription_text}</p>
                      </div>
                    )}
                    <p className="text-slate-400 text-xs mt-2">{formatDate(vm.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    {vm.recording_url && (
                      <a
                        href={vm.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Play
                      </a>
                    )}
                    {vm.status === 'received' && (
                      <button
                        onClick={() => handleMarkAsRead(vm.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Mark Read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(vm.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

