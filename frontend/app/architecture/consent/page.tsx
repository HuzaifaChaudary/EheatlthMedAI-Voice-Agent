'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { get, post } from '@/lib/api'

interface Consent {
  id: number
  phone_number: string
  consent_type: string
  consent_method: string
  consent_status: string
  recorded_at: string
  expires_at: string
}

export default function ConsentPage() {
  const router = useRouter()
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    phone_number: '',
    consent_type: 'automated_calls',
    consent_method: 'verbal',
    consent_status: 'granted',
    expires_at: ''
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchConsents()
  }, [router])

  const fetchConsents = async () => {
    try {
      const response = await get('/voice-ai/consent')
      
      if (response.error) {
        console.error('Error fetching consents:', response.error)
        setConsents([])
        return
      }

      if (response.data?.consents) {
        setConsents(response.data.consents)
      }
    } catch (error) {
      console.error('Error fetching consents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await post('/voice-ai/consent', formData)
      
      if (response.error) {
        console.error('Error creating consent:', response.error)
        return
      }

      if (response.data) {
        setShowCreateModal(false)
        setFormData({
          phone_number: '',
          consent_type: 'automated_calls',
          consent_method: 'verbal',
          consent_status: 'granted',
          expires_at: ''
        })
        fetchConsents()
      }
    } catch (error) {
      console.error('Error creating consent:', error)
    }
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
          <span className="text-white text-xl font-semibold">Consent Management</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/architecture" className="text-white hover:text-slate-300 text-sm">
            Architecture
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            + Record Consent
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">TCPA Compliance</h2>
          <p className="text-slate-200">
            All consent records are stored with timestamps, method, and verifiable evidence to ensure TCPA compliance.
            Consent must be obtained before automated calls containing PHI.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-white">
            <thead>
              <tr>
                <th className="text-left py-3 px-4">Phone Number</th>
                <th className="text-left py-3 px-4">Consent Type</th>
                <th className="text-left py-3 px-4">Method</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Recorded</th>
                <th className="text-left py-3 px-4">Expires</th>
              </tr>
            </thead>
            <tbody>
              {consents.map((consent) => (
                <tr key={consent.id} className="border-b border-white/10">
                  <td className="py-3 px-4">{consent.phone_number}</td>
                  <td className="py-3 px-4 capitalize">{consent.consent_type.replace('_', ' ')}</td>
                  <td className="py-3 px-4 capitalize">{consent.consent_method}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        consent.consent_status === 'granted' ? 'bg-green-500' : 'bg-red-500'
                      } text-white`}
                    >
                      {consent.consent_status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {consent.recorded_at ? new Date(consent.recorded_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {consent.expires_at ? new Date(consent.expires_at).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {consents.length === 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <p className="text-white text-lg mb-4">No consent records found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg"
            >
              Record First Consent
            </button>
          </div>
        )}

        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <div className="bg-slate-900 rounded-xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-white mb-6">Record Consent</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-white mb-2">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Consent Type</label>
                  <select
                    value={formData.consent_type}
                    onChange={(e) => setFormData({ ...formData, consent_type: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  >
                    <option value="automated_calls" className="bg-slate-800">Automated Calls</option>
                    <option value="recording" className="bg-slate-800">Recording</option>
                    <option value="data_sharing" className="bg-slate-800">Data Sharing</option>
                    <option value="marketing" className="bg-slate-800">Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white mb-2">Consent Method</label>
                  <select
                    value={formData.consent_method}
                    onChange={(e) => setFormData({ ...formData, consent_method: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  >
                    <option value="verbal" className="bg-slate-800">Verbal</option>
                    <option value="written" className="bg-slate-800">Written</option>
                    <option value="digital" className="bg-slate-800">Digital</option>
                    <option value="ivr" className="bg-slate-800">IVR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white mb-2">Expires At (Optional)</label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg"
                  >
                    Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
