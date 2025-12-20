'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { get, post } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface PhoneNumber {
  id: number
  phone_number: string
  provider: string
  is_active: boolean
  capabilities: any
}

interface CallLog {
  id: number
  caller_phone: string
  direction: string
  status: string
  duration_seconds: number
  started_at: string
  agent_name: string
  agent_type: string
  recording_url: string
  transcription_text: string
}

interface SMSMessage {
  id: number
  to_number: string
  from_number: string
  message_body: string
  direction: string
  status: string
  created_at: string
}

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

export default function TelephonyPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'calls' | 'sms' | 'voicemail' | 'numbers'>('calls')
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [smsMessages, setSmsMessages] = useState<SMSMessage[]>([])
  const [voicemails, setVoicemails] = useState<Voicemail[]>([])
  const [loading, setLoading] = useState(true)
  const [showMakeCallModal, setShowMakeCallModal] = useState(false)
  const [showSendSmsModal, setShowSendSmsModal] = useState(false)
  const [makeCallForm, setMakeCallForm] = useState({
    phone_number_id: '',
    to: '',
    agent_id: ''
  })
  const [sendSmsForm, setSendSmsForm] = useState({
    to: '',
    from: '',
    message: ''
  })
  const [agents, setAgents] = useState<any[]>([])
  const [showAddPhoneModal, setShowAddPhoneModal] = useState(false)
  const [addPhoneForm, setAddPhoneForm] = useState({
    phone_number: '',
    provider: 'twilio',
    provider_sid: '',
    capabilities: { voice: true, sms: true, mms: false },
    monthly_cost: ''
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchData()
    fetchAgents()
    fetchPhoneNumbers()
  }, [router, activeTab])

  const fetchData = async () => {
    try {
      setLoading(true)
      if (activeTab === 'calls') {
        const response = await get('/telephony/calls?limit=50')
        if (response.data?.calls) {
          setCallLogs(response.data.calls)
        }
      } else if (activeTab === 'sms') {
        const response = await get('/telephony/sms?limit=50')
        if (response.data?.messages) {
          setSmsMessages(response.data.messages)
        }
      } else if (activeTab === 'voicemail') {
        const response = await get('/telephony/voicemails?limit=50')
        if (response.data?.voicemails) {
          setVoicemails(response.data.voicemails)
        }
      } else if (activeTab === 'numbers') {
        const response = await get('/telephony/phone-numbers')
        if (response.data?.phone_numbers) {
          setPhoneNumbers(response.data.phone_numbers)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await get('/agents')
      if (response.data?.agents) {
        setAgents(response.data.agents)
      }
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const fetchPhoneNumbers = async () => {
    try {
      const response = await get('/telephony/phone-numbers')
      if (response.data?.phone_numbers) {
        setPhoneNumbers(response.data.phone_numbers)
      }
    } catch (error) {
      console.error('Error fetching phone numbers:', error)
    }
  }

  const handleMakeCall = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await post('/telephony/calls/make', makeCallForm)
      if (response.error) {
        alert(`Error: ${response.error}`)
        return
      }
      alert('Call initiated successfully!')
      setShowMakeCallModal(false)
      setMakeCallForm({ phone_number_id: '', to: '', agent_id: '' })
      fetchData()
    } catch (error: any) {
      alert(`Error making call: ${error.message}`)
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

  const handleAddPhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await post('/telephony/phone-numbers', {
        ...addPhoneForm,
        monthly_cost: addPhoneForm.monthly_cost ? parseFloat(addPhoneForm.monthly_cost) : null
      })
      if (response.error) {
        alert(`Error: ${response.error}`)
        return
      }
      alert('Phone number added successfully!')
      setShowAddPhoneModal(false)
      setAddPhoneForm({
        phone_number: '',
        provider: 'twilio',
        provider_sid: '',
        capabilities: { voice: true, sms: true, mms: false },
        monthly_cost: ''
      })
      fetchPhoneNumbers()
      fetchData()
    } catch (error: any) {
      alert(`Error adding phone number: ${error.message}`)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span className="text-white text-xl font-semibold">Telephony Management</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="mb-6 flex space-x-4 border-b border-white/20">
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'calls'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Call Logs ({callLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'sms'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SMS ({smsMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('voicemail')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'voicemail'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Voicemail ({voicemails.length})
          </button>
          <button
            onClick={() => setActiveTab('numbers')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'numbers'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Phone Numbers ({phoneNumbers.length})
          </button>
        </div>

        {/* Call Logs Tab */}
        {activeTab === 'calls' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div className="text-slate-300">
                {callLogs.length} {callLogs.length === 1 ? 'call' : 'calls'} logged
              </div>
              <button
                onClick={() => setShowMakeCallModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
              >
                + Make Call
              </button>
            </div>

            {callLogs.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
                <div className="text-slate-300 mb-4">No call logs available yet.</div>
                <button
                  onClick={() => setShowMakeCallModal(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Make Your First Call
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {callLogs.map((call) => (
                  <div
                    key={call.id}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">
                            {call.caller_phone || 'Unknown'}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded ${
                            call.direction === 'inbound'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500'
                              : 'bg-green-500/20 text-green-300 border border-green-500'
                          }`}>
                            {call.direction}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded ${
                            call.status === 'completed'
                              ? 'bg-green-500/20 text-green-300 border border-green-500'
                              : call.status === 'failed'
                              ? 'bg-red-500/20 text-red-300 border border-red-500'
                              : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500'
                          }`}>
                            {call.status}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm mb-2">
                          Agent: {call.agent_name || 'N/A'} ({call.agent_type || 'N/A'})
                        </p>
                        <p className="text-slate-400 text-xs">
                          {formatDate(call.started_at)} • Duration: {formatDuration(call.duration_seconds || 0)}
                        </p>
                        {call.transcription_text && (
                          <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                            <p className="text-slate-300 text-sm font-semibold mb-1">Transcription:</p>
                            <p className="text-slate-400 text-sm">{call.transcription_text.substring(0, 200)}...</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {call.recording_url && (
                          <a
                            href={call.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                          >
                            Play Recording
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SMS Tab */}
        {activeTab === 'sms' && (
          <div>
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
          </div>
        )}

        {/* Voicemail Tab */}
        {activeTab === 'voicemail' && (
          <div>
            <div className="mb-6">
              <div className="text-slate-300">
                {voicemails.length} {voicemails.length === 1 ? 'voicemail' : 'voicemails'}
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
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
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
                            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                          >
                            Play
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phone Numbers Tab */}
        {activeTab === 'numbers' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div className="text-slate-300">
                {phoneNumbers.length} {phoneNumbers.length === 1 ? 'phone number' : 'phone numbers'} configured
              </div>
              <button
                onClick={() => setShowAddPhoneModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
              >
                + Add Phone Number
              </button>
            </div>

            {phoneNumbers.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
                <div className="text-slate-300 mb-4">No phone numbers configured yet.</div>
                <p className="text-slate-400 text-sm mb-4">
                  Add phone numbers from your Twilio account to enable calls and SMS.
                </p>
                <button
                  onClick={() => setShowAddPhoneModal(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Add Your First Phone Number
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {phoneNumbers.map((number) => (
                  <div
                    key={number.id}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{number.phone_number}</h3>
                        <p className="text-slate-400 text-sm">{number.provider || 'N/A'}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        number.is_active
                          ? 'bg-green-500/20 text-green-300 border border-green-500'
                          : 'bg-red-500/20 text-red-300 border border-red-500'
                      }`}>
                        {number.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {number.capabilities && (
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(number.capabilities).map((cap) => (
                          <span key={cap} className="px-2 py-1 text-xs rounded bg-slate-700/50 text-slate-300">
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Make Call Modal */}
        {showMakeCallModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Make Call</h2>
                <button
                  onClick={() => setShowMakeCallModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleMakeCall} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Phone Number *</label>
                  <select
                    value={makeCallForm.phone_number_id}
                    onChange={(e) => setMakeCallForm({ ...makeCallForm, phone_number_id: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    required
                  >
                    <option value="">Select phone number</option>
                    {phoneNumbers.filter(n => n.is_active).map((num) => (
                      <option key={num.id} value={num.id}>{num.phone_number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">To (Phone Number) *</label>
                  <input
                    type="tel"
                    value={makeCallForm.to}
                    onChange={(e) => setMakeCallForm({ ...makeCallForm, to: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    placeholder="+1234567890"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Agent *</label>
                  <select
                    value={makeCallForm.agent_id}
                    onChange={(e) => setMakeCallForm({ ...makeCallForm, agent_id: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    required
                  >
                    <option value="">Select agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name} ({agent.type})</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowMakeCallModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  >
                    Make Call
                  </button>
                </div>
              </form>
            </div>
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

        {/* Add Phone Number Modal */}
        {showAddPhoneModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Add Phone Number</h2>
                <button
                  onClick={() => setShowAddPhoneModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddPhoneNumber} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    value={addPhoneForm.phone_number}
                    onChange={(e) => setAddPhoneForm({ ...addPhoneForm, phone_number: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    placeholder="+1234567890"
                    required
                  />
                  <p className="text-slate-400 text-xs mt-1">Enter in E.164 format (e.g., +1234567890)</p>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Provider *</label>
                  <select
                    value={addPhoneForm.provider}
                    onChange={(e) => setAddPhoneForm({ ...addPhoneForm, provider: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    required
                  >
                    <option value="twilio">Twilio</option>
                    <option value="vonage">Vonage</option>
                    <option value="bandwidth">Bandwidth</option>
                    <option value="plivo">Plivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Provider SID (Optional)</label>
                  <input
                    type="text"
                    value={addPhoneForm.provider_sid}
                    onChange={(e) => setAddPhoneForm({ ...addPhoneForm, provider_sid: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    placeholder="PN..."
                  />
                  <p className="text-slate-400 text-xs mt-1">The phone number SID from your provider</p>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Capabilities</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-slate-300">
                      <input
                        type="checkbox"
                        checked={addPhoneForm.capabilities.voice}
                        onChange={(e) => setAddPhoneForm({
                          ...addPhoneForm,
                          capabilities: { ...addPhoneForm.capabilities, voice: e.target.checked }
                        })}
                        className="rounded bg-slate-700 border-white/20"
                      />
                      Voice
                    </label>
                    <label className="flex items-center gap-2 text-slate-300">
                      <input
                        type="checkbox"
                        checked={addPhoneForm.capabilities.sms}
                        onChange={(e) => setAddPhoneForm({
                          ...addPhoneForm,
                          capabilities: { ...addPhoneForm.capabilities, sms: e.target.checked }
                        })}
                        className="rounded bg-slate-700 border-white/20"
                      />
                      SMS
                    </label>
                    <label className="flex items-center gap-2 text-slate-300">
                      <input
                        type="checkbox"
                        checked={addPhoneForm.capabilities.mms}
                        onChange={(e) => setAddPhoneForm({
                          ...addPhoneForm,
                          capabilities: { ...addPhoneForm.capabilities, mms: e.target.checked }
                        })}
                        className="rounded bg-slate-700 border-white/20"
                      />
                      MMS
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Monthly Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={addPhoneForm.monthly_cost}
                    onChange={(e) => setAddPhoneForm({ ...addPhoneForm, monthly_cost: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                    placeholder="1.00"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddPhoneModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  >
                    Add Number
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

