'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Play, Square, Settings, Calendar, Database, MessageSquare, Monitor, X, FileText, Phone } from 'lucide-react'
import { get, put, post } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useSocket } from '@/components/providers/SocketProvider'
import ChatInterface from '@/components/ChatInterface'

interface Agent {
  id: number
  name: string
  type: string
  description: string
  is_active: boolean
  configuration: any
  voice_model: string
  system_prompt: string
  temperature: number
  phone_number_id: number | null
  updated_at: string
}

interface PhoneNumber {
  id: number
  phone_number: string
  provider: string
  is_active: boolean
}

interface Integration {
  id: number
  name: string
  type: string
  provider: string
  is_active: boolean
  last_sync_at: string | null
}

interface CallLog {
  id: number
  caller_phone: string
  direction: string
  status: string
  duration_seconds: number
  started_at: string
  transcription_text: string
}

export default function AgentConfigurationPage() {
  const params = useParams()
  const router = useRouter()
  const { socket } = useSocket()

  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  // Integration state
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(true)
  
  // Call logs state
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [showLogsModal, setShowLogsModal] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  
  // Simulate call modal
  const [showSimulateModal, setShowSimulateModal] = useState(false)

  // Phone numbers state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(true)

  // Form state
  const [prompt, setPrompt] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [voiceModel, setVoiceModel] = useState('openai')
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string | number>('')
  const [selectedCalendarProvider, setSelectedCalendarProvider] = useState('off')
  const [selectedEhrProvider, setSelectedEhrProvider] = useState('off')

  useEffect(() => {
    fetchAgent()
    fetchIntegrations()
    fetchPhoneNumbers()
  }, [params.agentId])

  const fetchPhoneNumbers = async () => {
    try {
      setLoadingPhoneNumbers(true)
      const response = await get('/telephony/phone-numbers')
      if (response.data?.phone_numbers) {
        setPhoneNumbers(response.data.phone_numbers.filter((pn: PhoneNumber) => pn.is_active))
      }
    } catch (error) {
      console.error('Error fetching phone numbers:', error)
    } finally {
      setLoadingPhoneNumbers(false)
    }
  }

  const fetchAgent = async () => {
    try {
      const response = await get(`/agents/${params.agentId}`)
      if (response.data?.agent) {
        const data = response.data.agent
        setAgent(data)
        setPrompt(data.system_prompt || '')
        setIsActive(data.is_active)
        setVoiceModel(data.voice_model || 'openai')
        setSelectedPhoneNumberId(data.phone_number_id || '')
      } else {
        setError('Agent not found')
      }
    } catch (err) {
      setError('Failed to load agent configuration')
    } finally {
      setLoading(false)
    }
  }

  const fetchIntegrations = async () => {
    try {
      setIntegrationsLoading(true)
      const response = await get('/integrations/test/list')
      if (response.data?.integrations) {
        setIntegrations(response.data.integrations)
        
        // Set selected providers based on active integrations
        const schedulingInt = response.data.integrations.find((i: Integration) => 
          i.type === 'scheduling' && i.is_active
        )
        const ehrInt = response.data.integrations.find((i: Integration) => 
          i.type === 'ehr' && i.is_active
        )
        
        if (schedulingInt) setSelectedCalendarProvider(schedulingInt.provider)
        if (ehrInt) setSelectedEhrProvider(ehrInt.provider)
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err)
    } finally {
      setIntegrationsLoading(false)
    }
  }

  const fetchCallLogs = async () => {
    try {
      setLogsLoading(true)
      const response = await get(`/telephony/calls?agent_id=${params.agentId}&limit=20`)
      if (response.data?.calls) {
        setCallLogs(response.data.calls)
      }
    } catch (err) {
      console.error('Failed to fetch call logs:', err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleViewLogs = () => {
    fetchCallLogs()
    setShowLogsModal(true)
  }

  const getIntegrationStatus = (type: string) => {
    const integration = integrations.find(i => i.type === type && i.is_active)
    if (!integration) {
      return { status: 'not_configured', label: 'Not Configured', color: 'bg-slate-500/20 text-slate-400' }
    }
    if (integration.last_sync_at) {
      return { status: 'connected', label: 'Connected', color: 'bg-green-500/20 text-green-400' }
    }
    return { status: 'configured', label: 'Configured', color: 'bg-blue-500/20 text-blue-400' }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await put(`/agents/${params.agentId}`, {
        system_prompt: prompt,
        is_active: isActive,
        voice_model: voiceModel,
        phone_number_id: selectedPhoneNumberId || null
      })

      if (response.error) {
        throw new Error(response.error)
      }

      setMessage('Configuration saved successfully')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const toggleAgentStatus = async () => {
    const newStatus = !isActive
    setIsActive(newStatus)
    // Optimistic update, actual save happens on Save button or we could save immediately
    // For better UX, let's save immediately for toggle
    try {
      await put(`/agents/${params.agentId}`, { is_active: newStatus })
      setMessage(newStatus ? 'Agent activated' : 'Agent deactivated')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      // Revert if failed
      setIsActive(!newStatus)
      setError('Failed to update status')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center text-white">
        Loading configuration...
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex flex-col items-center justify-center text-white p-6">
        <h2 className="text-2xl font-bold mb-4">{error || 'Agent not found'}</h2>
        <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <div>
              <h1 className="text-xl font-bold">{agent.name}</h1>
              <p className="text-xs text-slate-400 uppercase tracking-wider">{agent.type} Agent</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleAgentStatus}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-2 ${isActive
                ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                }`}
            >
              {isActive ? <Play size={16} /> : <Square size={16} />}
              <span>{isActive ? 'Active' : 'Inactive'}</span>
            </button>
            <Button
              onClick={handleSave}
              loading={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Save size={18} className="mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {message && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg mb-6 flex items-center animate-fade-in">
            <span className="mr-2">✓</span> {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Configuration Config */}
          <div className="lg:col-span-2 space-y-6">

            {/* System Prompt Editor */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <MessageSquare className="mr-2 text-teal-400" size={20} />
                    System Instructions
                  </h3>
                  <span className="text-xs text-slate-400">Core behavior & personality</span>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  Define how the {agent.name} should behave, interacts with patients, and handles capabilities.
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-96 bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm font-mono text-slate-200 focus:outline-none focus:border-teal-500 resize-none"
                  placeholder="You are a helpful medical assistant..."
                />
              </div>
            </Card>

            {/* Integration Settings */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Database className="mr-2 text-purple-400" size={20} />
                    Integrations & Tools
                  </h3>
                  {integrationsLoading && (
                    <span className="text-xs text-slate-400">Loading...</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Calendar/Scheduling Integration */}
                  {(() => {
                    const calendarStatus = getIntegrationStatus('scheduling')
                    const schedulingIntegrations = integrations.filter(i => i.type === 'scheduling')
                    return (
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <Calendar size={18} className="text-blue-400 mr-2" />
                            <span className="font-medium">Calendar</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${calendarStatus.color}`}>
                            {calendarStatus.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">
                          {schedulingIntegrations.length > 0 
                            ? `${schedulingIntegrations.length} provider(s) configured`
                            : 'No scheduling integrations configured'
                          }
                        </p>
                        <select 
                          value={selectedCalendarProvider}
                          onChange={(e) => setSelectedCalendarProvider(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs"
                        >
                          <option value="off">Off</option>
                          {schedulingIntegrations.map(int => (
                            <option key={int.id} value={int.provider}>
                              {int.name} ({int.provider})
                            </option>
                          ))}
                          {schedulingIntegrations.length === 0 && (
                            <option disabled>Configure in Settings → Integrations</option>
                          )}
                        </select>
                      </div>
                    )
                  })()}

                  {/* EMR/EHR Integration */}
                  {(() => {
                    const ehrStatus = getIntegrationStatus('ehr')
                    const ehrIntegrations = integrations.filter(i => i.type === 'ehr' || i.type === 'emr')
                    const billingIntegrations = integrations.filter(i => i.type === 'billing')
                    const hasAnyEhr = ehrIntegrations.length > 0 || billingIntegrations.length > 0
                    
                    return (
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <ActivityIcon size={18} className="text-red-400 mr-2" />
                            <span className="font-medium">EMR/EHR</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            hasAnyEhr 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {hasAnyEhr ? 'Available' : 'Not Configured'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">
                          {billingIntegrations.length > 0 
                            ? `${billingIntegrations.length} billing system(s) + HL7 Listener`
                            : 'HL7 v2.x TCP Listener (Port 7777)'
                          }
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input 
                              type="checkbox" 
                              checked={true} 
                              readOnly 
                              className="rounded border-slate-700 bg-slate-800" 
                            />
                            <span className="text-xs">Receive ADT Messages</span>
                          </div>
                          {billingIntegrations.length > 0 && (
                            <div className="text-xs text-teal-400">
                              ✓ {billingIntegrations.map(b => b.provider).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  {/* CRM Integration */}
                  {(() => {
                    const crmIntegrations = integrations.filter(i => i.type === 'crm')
                    const hasCrm = crmIntegrations.some(i => i.is_active)
                    
                    return (
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <MessageSquare size={18} className="text-purple-400 mr-2" />
                            <span className="font-medium">CRM/Ticketing</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            hasCrm 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {hasCrm ? 'Connected' : 'Not Configured'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">
                          {crmIntegrations.length > 0 
                            ? `${crmIntegrations.map(c => c.provider).join(', ')}`
                            : 'Salesforce, HubSpot, Zendesk'
                          }
                        </p>
                        <Link 
                          href="/dashboard?tab=integrations"
                          className="text-xs text-teal-400 hover:text-teal-300"
                        >
                          {crmIntegrations.length > 0 ? 'Manage CRM →' : 'Configure CRM →'}
                        </Link>
                      </div>
                    )
                  })()}

                  {/* Voice AI Status */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Phone size={18} className="text-teal-400 mr-2" />
                        <span className="font-medium">Voice AI</span>
                      </div>
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                        Ready
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      {voiceModel === 'openai' ? 'OpenAI Realtime' : 
                       voiceModel === 'elevenlabs' ? 'ElevenLabs TTS' :
                       voiceModel === 'deepgram' ? 'Deepgram STT' : voiceModel}
                    </p>
                    <div className="text-xs text-green-400">
                      ✓ NLU + TTS configured
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            {/* Model Settings */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold flex items-center mb-6">
                  <Settings className="mr-2 text-slate-400" size={20} />
                  Voice Configuration
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Voice Model Provider</label>
                    <select
                      value={voiceModel}
                      onChange={(e) => setVoiceModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                    >
                      <option value="openai">OpenAI (Realtime)</option>
                      <option value="elliza">Elliza.ai</option>
                      <option value="deepgram">Deepgram</option>
                      <option value="elevenlabs">ElevenLabs</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2 flex items-center">
                      <Phone className="mr-2 text-teal-400" size={16} />
                      Linked Phone Number
                    </label>
                    <select
                      value={selectedPhoneNumberId}
                      onChange={(e) => setSelectedPhoneNumberId(e.target.value || '')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                    >
                      <option value="">No phone number (unlink)</option>
                      {loadingPhoneNumbers ? (
                        <option disabled>Loading phone numbers...</option>
                      ) : phoneNumbers.length === 0 ? (
                        <option disabled>No phone numbers available. Add one in Telephony page.</option>
                      ) : (
                        phoneNumbers.map((pn) => (
                          <option key={pn.id} value={pn.id}>
                            {pn.phone_number} ({pn.provider})
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-xs text-slate-400 mt-2">
                      When calls come to this number, this agent will automatically answer.
                    </p>
                    {phoneNumbers.length === 0 && (
                      <Link href="/telephony" className="text-xs text-teal-400 hover:text-teal-300 mt-1 block">
                        Add phone number →
                      </Link>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Responsiveness</label>
                    <input type="range" className="w-full accent-teal-500" min="0" max="100" />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Slow</span>
                      <span>Instant</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            {/* Quick Actions */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold flex items-center mb-4">
                  <Monitor className="mr-2 text-slate-400" size={20} />
                  Test & Monitor
                </h3>
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left"
                    onClick={() => setShowSimulateModal(true)}
                  >
                    <Play size={16} className="mr-2" />
                    Simulate Call
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left"
                    onClick={handleViewLogs}
                  >
                    <FileText size={16} className="mr-2" />
                    View Conversation Logs
                  </Button>
                  <Link href="/telephony">
                    <Button variant="outline" className="w-full justify-start text-left">
                      <Phone size={16} className="mr-2" />
                      Telephony Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

          </div>
        </div>
      </main>

      {/* Simulate Call Modal */}
      {showSimulateModal && agent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Simulate Call</h3>
                <p className="text-xs text-slate-400">Chat with {agent.name} to test responses</p>
              </div>
              <button 
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <ChatInterface agentId={agent.id} />
            </div>
          </div>
        </div>
      )}

      {/* Conversation Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Conversation Logs</h3>
                <p className="text-xs text-slate-400">Recent calls and conversations for {agent?.name}</p>
              </div>
              <button 
                onClick={() => setShowLogsModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                </div>
              ) : callLogs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400">No conversation logs yet</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Logs will appear here after calls are made with this agent
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {callLogs.map((log) => (
                    <div 
                      key={log.id}
                      className="bg-slate-800/50 border border-white/5 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className={`w-2 h-2 rounded-full ${
                            log.status === 'completed' ? 'bg-green-500' : 
                            log.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                          }`} />
                          <span className="font-medium text-white">{log.caller_phone || 'Web Chat'}</span>
                          <span className="text-xs text-slate-400 capitalize">{log.direction}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(log.started_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-400">
                        <span>Duration: {Math.floor(log.duration_seconds / 60)}m {log.duration_seconds % 60}s</span>
                        <span>Status: {log.status}</span>
                      </div>
                      {log.transcription_text && (
                        <div className="mt-3 p-3 bg-slate-950 rounded text-xs text-slate-300 max-h-32 overflow-auto">
                          {log.transcription_text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 text-center">
                <Link href="/telephony" className="text-teal-400 hover:text-teal-300 text-sm">
                  View all calls in Telephony Dashboard →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityIcon({ size, className }: { size?: number, className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}
