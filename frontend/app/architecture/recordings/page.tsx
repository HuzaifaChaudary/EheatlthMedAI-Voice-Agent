'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { get } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface CallRecording {
  id: number
  call_log_id: number
  recording_url: string
  recording_sid: string
  duration_seconds: number
  file_size_bytes: number
  status: string
  created_at: string
  caller_phone: string
  direction: string
  agent_name: string
  agent_type: string
}

export default function RecordingsPage() {
  const router = useRouter()
  const [recordings, setRecordings] = useState<CallRecording[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchRecordings()
  }, [router])

  const fetchRecordings = async () => {
    try {
      setLoading(true)
      const response = await get('/telephony/recordings?limit=100')
      if (response.data?.recordings) {
        setRecordings(response.data.recordings)
      }
    } catch (error) {
      console.error('Error fetching recordings:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B'
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    const kb = bytes / 1024
    return `${kb.toFixed(2)} KB`
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-white text-xl font-semibold">Call Recordings</span>
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
            {recordings.length} {recordings.length === 1 ? 'recording' : 'recordings'} available
          </div>
        </div>

        {recordings.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
            <div className="text-slate-300 mb-4">No call recordings available yet.</div>
            <Link
              href="/architecture/telephony"
              className="inline-block bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Make a Call
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">
                        {recording.caller_phone || 'Unknown'}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded ${
                        recording.direction === 'inbound'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500'
                          : 'bg-green-500/20 text-green-300 border border-green-500'
                      }`}>
                        {recording.direction}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        recording.status === 'completed'
                          ? 'bg-green-500/20 text-green-300 border border-green-500'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500'
                      }`}>
                        {recording.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-2">
                      Agent: {recording.agent_name || 'N/A'} ({recording.agent_type || 'N/A'})
                    </p>
                    <div className="flex gap-4 text-slate-400 text-sm mb-2">
                      <span>Duration: {formatDuration(recording.duration_seconds || 0)}</span>
                      <span>Size: {formatFileSize(recording.file_size_bytes || 0)}</span>
                    </div>
                    <p className="text-slate-400 text-xs">{formatDate(recording.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    {recording.recording_url && (
                      <a
                        href={recording.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Play Recording
                      </a>
                    )}
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

