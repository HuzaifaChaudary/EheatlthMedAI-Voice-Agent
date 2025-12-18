'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { post, get } from '@/lib/api'
import { sanitizeInput, isValidEmail } from '@/lib/security'
import { isAuthenticated } from '@/lib/auth'

interface Webhook {
  id: number
  name: string
  url: string
  events: string[]
  is_active: boolean
  last_triggered_at: string | null
  created_at: string
}

interface WebhookEvent {
  id: number
  webhook_id: number
  event_type: string
  payload: any
  status: string
  response_code: number | null
  response_body: string | null
  attempted_at: string
  created_at: string
}

export default function WebhooksPage() {
  const router = useRouter()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[]
  })
  const [secretKey, setSecretKey] = useState<string | null>(null)

  const availableEvents = [
    'conversation.started',
    'conversation.ended',
    'call.answered',
    'call.ended',
    'agent.response',
    'error.occurred',
    'compliance.violation',
    'recording.completed'
  ]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchWebhooks()
    fetchWebhookEvents()
  }, [router])

  const fetchWebhooks = async () => {
    try {
      const response = await get('/integrations/webhooks')
      if (response.data?.webhooks) {
        setWebhooks(response.data.webhooks)
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWebhookEvents = async (webhookId?: number) => {
    try {
      const params = webhookId ? `?webhook_id=${webhookId}` : ''
      const response = await get(`/integrations-ehr/webhooks/events${params}`)
      if (response.data?.events) {
        setWebhookEvents(response.data.events)
      }
    } catch (error) {
      console.error('Error fetching webhook events:', error)
    }
  }

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)

    if (!formData.name || !formData.url) {
      setCreateError('Name and URL are required')
      setCreateLoading(false)
      return
    }

    // Validate URL
    try {
      new URL(formData.url)
    } catch {
      setCreateError('Invalid URL format')
      setCreateLoading(false)
      return
    }

    if (formData.events.length === 0) {
      setCreateError('At least one event type must be selected')
      setCreateLoading(false)
      return
    }

    try {
      const response = await post('/integrations/webhooks', {
        name: sanitizeInput(formData.name),
        url: sanitizeInput(formData.url),
        events: formData.events
      })

      if (response.error) {
        setCreateError(response.error || response.message || 'Failed to create webhook')
        return
      }

      if (response.data?.webhook) {
        setSecretKey(response.data.secret_key)
        setWebhooks([...webhooks, response.data.webhook])
        setFormData({ name: '', url: '', events: [] })
        setShowCreateModal(false)
        // Show secret key in alert
        if (response.data.secret_key) {
          alert(`Webhook created! Secret Key: ${response.data.secret_key}\n\nIMPORTANT: Save this key now. You won't be able to see it again.`)
        }
      } else {
        setCreateError('Failed to create webhook')
      }
    } catch (error: any) {
      console.error('Error creating webhook:', error)
      setCreateError(error.message || 'Error creating webhook')
    } finally {
      setCreateLoading(false)
    }
  }

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }))
  }

  const handleWebhookClick = (webhookId: number) => {
    setSelectedWebhook(selectedWebhook === webhookId ? null : webhookId)
    if (selectedWebhook !== webhookId) {
      fetchWebhookEvents(webhookId)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-white text-xl font-semibold">Webhooks</span>
        </div>
        <Link href="/architecture" className="text-white hover:text-slate-300 text-sm">
          ← Architecture
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Webhook Management</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
          >
            Create Webhook
          </button>
        </div>

        {loading ? (
          <div className="text-white text-center py-12">Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
            <p className="text-white mb-4">No webhooks configured yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            >
              Create Your First Webhook
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map(webhook => (
              <div
                key={webhook.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 cursor-pointer hover:bg-white/15 transition-colors"
                onClick={() => handleWebhookClick(webhook.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-white font-semibold text-lg">{webhook.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        webhook.is_active
                          ? 'bg-green-500/20 text-green-200 border border-green-500'
                          : 'bg-red-500/20 text-red-200 border border-red-500'
                      }`}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm mb-2">{webhook.url}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {webhook.events.map((event, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-slate-700/50 text-slate-200 rounded text-xs"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                    {webhook.last_triggered_at && (
                      <p className="text-slate-400 text-xs">
                        Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {selectedWebhook === webhook.id && (
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <h4 className="text-white font-semibold mb-3">Recent Events</h4>
                    {webhookEvents.filter(e => e.webhook_id === webhook.id).length === 0 ? (
                      <p className="text-slate-400 text-sm">No events yet</p>
                    ) : (
                      <div className="space-y-2">
                        {webhookEvents
                          .filter(e => e.webhook_id === webhook.id)
                          .slice(0, 5)
                          .map(event => (
                            <div
                              key={event.id}
                              className="bg-slate-800/50 rounded p-3 text-sm"
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-white font-medium">{event.event_type}</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  event.status === 'success'
                                    ? 'bg-green-500/20 text-green-200'
                                    : event.status === 'failed'
                                    ? 'bg-red-500/20 text-red-200'
                                    : 'bg-yellow-500/20 text-yellow-200'
                                }`}>
                                  {event.status}
                                </span>
                              </div>
                              <p className="text-slate-400 text-xs">
                                {new Date(event.attempted_at).toLocaleString()}
                                {event.response_code && ` • Status: ${event.response_code}`}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Webhook Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Create Webhook</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError('')
                    setFormData({ name: '', url: '', events: [] })
                  }}
                  className="text-white hover:text-slate-300"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateWebhook}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-white mb-2">Webhook Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                      placeholder="My Webhook"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white mb-2">Webhook URL</label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                      placeholder="https://example.com/webhook"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white mb-2">Event Types</label>
                    <div className="grid grid-cols-2 gap-2">
                      {availableEvents.map(event => (
                        <label
                          key={event}
                          className="flex items-center space-x-2 p-2 bg-white/10 rounded cursor-pointer hover:bg-white/20"
                        >
                          <input
                            type="checkbox"
                            checked={formData.events.includes(event)}
                            onChange={() => toggleEvent(event)}
                            className="rounded"
                          />
                          <span className="text-white text-sm">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex space-x-3">
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createLoading ? 'Creating...' : 'Create Webhook'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setCreateError('')
                      setFormData({ name: '', url: '', events: [] })
                    }}
                    className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-2 rounded-lg"
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

