'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { get, post } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface SMSMessage {
  id: number
  to_number: string
  from_number: string
  message_body: string
  direction: string
  status: string
  created_at: string
}

interface PhoneNumber {
  id: number
  phone_number: string
  is_active: boolean
}

export default function SMSPage() {
  const router = useRouter()
  const [smsMessages, setSmsMessages] = useState<SMSMessage[]>([])
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [showSendSmsModal, setShowSendSmsModal] = useState(false)
  const [sendSmsForm, setSendSmsForm] = useState({
    to: '',
    from: '',
    message: ''
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchData()
  }, [router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [smsResponse, numbersResponse] = await Promise.all([
        get('/telephony/sms?limit=100'),
        get('/telephony/phone-numbers')
      ])
      
      if (smsResponse.data?.messages) {
        setSmsMessages(smsResponse.data.messages)
      }
      if (numbersResponse.data?.phone_numbers) {
        setPhoneNumbers(numbersResponse.data.phone_numbers)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await post('/telephony/sms/send', sendSmsForm)
      if (response.error) {
        alert(`Error: ${response.error}`)
        return
      }
      alert('SMS sent successfully!')
      setShowSendSmsModal(false)
      setSendSmsForm({ to: '', from: '', message: '' })
      fetchData()
    } catch (error: any) {
      alert(`Error sending SMS: ${error.message}`)
    }
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-white text-xl font-semibold">SMS Messages</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/architecture" className="text-white hover:text-slate-300 text-sm">
            ← Architecture
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div className="text-slate-300">
            {smsMessages.length} {smsMessages.length === 1 ? 'message' : 'messages'}
          </div>
          <button
            onClick={() => setShowSendSmsModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
          >
            + Send SMS
          </button>
        </div>

        {smsMessages.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
            <div className="text-slate-300 mb-4">No SMS messages yet.</div>
            <button
              onClick={() => setShowSendSmsModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Send Your First SMS
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {smsMessages.map((sms) => (
              <div
                key={sms.id}
                className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors ${
                  sms.direction === 'inbound' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-green-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        sms.direction === 'inbound'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500'
                          : 'bg-green-500/20 text-green-300 border border-green-500'
                      }`}>
                        {sms.direction}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        sms.status === 'sent' || sms.status === 'received'
                          ? 'bg-green-500/20 text-green-300 border border-green-500'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500'
                      }`}>
                        {sms.status}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm mb-1">
                      <span className="font-semibold">From:</span> {sms.from_number}
                    </p>
                    <p className="text-slate-300 text-sm mb-2">
                      <span className="font-semibold">To:</span> {sms.to_number}
                    </p>
                    <p className="text-white mb-2">{sms.message_body}</p>
                    <p className="text-slate-400 text-xs">{formatDate(sms.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Send SMS Modal */}
        {showSendSmsModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Send SMS</h2>
                <button
                  onClick={() => setShowSendSmsModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendSMS} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">From (Phone Number)</label>
                  <select
                    value={sendSmsForm.from}
                    onChange={(e) => setSendSmsForm({ ...sendSmsForm, from: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Use default</option>
                    {phoneNumbers.filter(n => n.is_active).map((num) => (
                      <option key={num.id} value={num.phone_number}>{num.phone_number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">To (Phone Number) *</label>
                  <input
                    type="tel"
                    value={sendSmsForm.to}
                    onChange={(e) => setSendSmsForm({ ...sendSmsForm, to: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    placeholder="+1234567890"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Message *</label>
                  <textarea
                    value={sendSmsForm.message}
                    onChange={(e) => setSendSmsForm({ ...sendSmsForm, message: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    rows={4}
                    placeholder="Enter your message..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSendSmsModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  >
                    Send SMS
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

