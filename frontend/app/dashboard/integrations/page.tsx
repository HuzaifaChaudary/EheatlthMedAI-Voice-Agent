'use client'

import { useEffect, useState } from 'react'
import { Calendar, Briefcase, Webhook, Plus, CheckCircle, XCircle, RefreshCw, Settings, TestTube, AlertCircle, Clock, Activity } from 'lucide-react'
import { get, post, put } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface Integration {
  id: number
  name: string
  type: string
  provider: string
  is_active: boolean
  last_sync_at: string | null
  created_at: string
}

interface TestResult {
  integrationId: number
  success: boolean
  message: string
  details?: any
}

export default function IntegrationsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'calendar' | 'crm' | 'webhooks'>('calendar')
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [testingIntegration, setTestingIntegration] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [errorMessages, setErrorMessages] = useState<Record<number | string, string>>({})
  const [formData, setFormData] = useState({
    name: '',
    type: 'scheduling',
    provider: 'google_calendar',
    access_token: '',
    refresh_token: '',
    client_id: '',
    client_secret: '',
    calendar_id: 'primary',
    // CRM fields
    api_key: '',
    subdomain: '',
    instance_url: '',
    email: ''
  })

  const calendarProviders = [
    { value: 'google_calendar', label: 'Google Calendar' },
    { value: 'gohighlevel', label: 'GoHighLevel' },
    { value: 'calendly', label: 'Calendly' },
    { value: 'zocdoc', label: 'Zocdoc' }
  ]

  const crmProviders = [
    { value: 'salesforce', label: 'Salesforce' },
    { value: 'hubspot', label: 'HubSpot' },
    { value: 'zendesk', label: 'Zendesk' },
    { value: 'freshdesk', label: 'Freshdesk' }
  ]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    // Reset state when tab changes
    setLoading(true)
    setErrorMessages({})
    fetchIntegrations()
  }, [router, activeTab])

  // Safety timeout - ensure loading doesn't hang forever
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Loading timeout - forcing loading to false')
        setLoading(false)
      }, 10000) // 10 second timeout
      return () => clearTimeout(timeout)
    }
  }, [loading])

  const fetchIntegrations = async () => {
    setLoading(true)
    // Clear previous error messages except for individual integration errors
    setErrorMessages(prev => {
      const newErrors: Record<number | string, string> = {}
      // Keep only numeric keys (integration-specific errors)
      Object.keys(prev).forEach(key => {
        if (typeof key === 'number' || !isNaN(Number(key))) {
          newErrors[key] = prev[key]
        }
      })
      return newErrors
    })
    
    try {
      console.log('🔄 Fetching integrations from /integrations...')
      const response = await get('/integrations')
      console.log('📦 API Response received:', { 
        hasData: !!response.data, 
        hasError: !!response.error,
        ok: response.ok,
        responseKeys: Object.keys(response)
      })
      
      // API wrapper returns { ok: true, data: { integrations: [...] } }
      // Backend returns { integrations: [...] }
      // Handle both formats
      let integrationsList: Integration[] = []
      
      if (response.error) {
        console.error('❌ API Error:', response.error)
        throw new Error(response.error)
      }
      
      if (response.data) {
        // Response wrapped by API client
        const data = response.data as any
        console.log('📊 Response data structure:', { 
          hasIntegrations: !!data.integrations,
          isArray: Array.isArray(data),
          dataKeys: Object.keys(data)
        })
        integrationsList = data.integrations || (Array.isArray(data) ? data : [])
      } else if (Array.isArray(response)) {
        // Response is array directly
        console.log('📊 Response is array directly')
        integrationsList = response
      } else {
        console.warn('⚠️ Unexpected response format:', response)
      }
      
      if (!Array.isArray(integrationsList)) {
        console.warn('⚠️ integrationsList is not an array:', typeof integrationsList, integrationsList)
        integrationsList = []
      }
      
      console.log('✅ Parsed integrations:', integrationsList.length)
      
      setIntegrations(integrationsList)
      
      // Check for common issues and show helpful messages
      const activeCount = integrationsList.filter((i: Integration) => i.is_active).length
      const calendarCount = integrationsList.filter((i: Integration) => i.type === 'scheduling').length
      const crmCount = integrationsList.filter((i: Integration) => i.type === 'crm').length
      
      // Clear previous issue messages
      setErrorMessages(prev => {
        const newErrors = { ...prev }
        delete newErrors['no-integrations']
        delete newErrors['inactive-integrations']
        delete newErrors['fetch-error']
        return newErrors
      })
      
      if (activeTab === 'calendar') {
        if (calendarCount === 0) {
          // Issue 1: No calendar integrations
          setErrorMessages(prev => ({ 
            ...prev, 
            'no-integrations': 'No calendar integrations found. Click "Add Integration" to create one.' 
          }))
        } else if (calendarCount > 0 && activeCount === 0) {
          // Issue 3: Integrations exist but inactive
          setErrorMessages(prev => ({ 
            ...prev, 
            'inactive-integrations': 'You have integrations but they are inactive. Enable them to start syncing.' 
          }))
        }
      } else if (activeTab === 'crm') {
        if (crmCount === 0) {
          setErrorMessages(prev => ({ 
            ...prev, 
            'no-integrations': 'No CRM integrations found. Click "Add Integration" to create one.' 
          }))
        } else if (crmCount > 0 && activeCount === 0) {
          setErrorMessages(prev => ({ 
            ...prev, 
            'inactive-integrations': 'You have CRM integrations but they are inactive. Enable them to start syncing.' 
          }))
        }
      }
    } catch (error: any) {
      console.error('Error fetching integrations:', error)
      setIntegrations([])
      setErrorMessages(prev => ({ 
        ...prev, 
        'fetch-error': error?.message || 'Failed to load integrations. Please check your connection and try again.' 
      }))
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)

    try {
      let credentials: any = {}

      if (formData.type === 'scheduling') {
        if (formData.provider === 'google_calendar') {
          credentials = {
            access_token: formData.access_token,
            refresh_token: formData.refresh_token,
            client_id: formData.client_id,
            client_secret: formData.client_secret,
            calendar_id: formData.calendar_id || 'primary'
          }
        } else if (formData.provider === 'calendly') {
          credentials = {
            api_key: formData.api_key
          }
        } else if (formData.provider === 'zocdoc') {
          credentials = {
            api_key: formData.api_key,
            practice_id: formData.subdomain // Reusing subdomain field
          }
        } else if (formData.provider === 'gohighlevel') {
          credentials = {
            api_key: formData.api_key,
            location_id: formData.subdomain // Reusing subdomain field
          }
        }
      } else if (formData.type === 'crm') {
        if (formData.provider === 'salesforce') {
          credentials = {
            access_token: formData.access_token,
            instance_url: formData.instance_url,
            refresh_token: formData.refresh_token
          }
        } else if (formData.provider === 'hubspot') {
          credentials = {
            access_token: formData.api_key // Reusing api_key field
          }
        } else if (formData.provider === 'zendesk') {
          credentials = {
            subdomain: formData.subdomain,
            email: formData.email,
            api_token: formData.api_key
          }
        } else if (formData.provider === 'freshdesk') {
          credentials = {
            domain: formData.subdomain,
            api_key: formData.api_key
          }
        }
      }

      const payload = {
        name: formData.name || `${formData.provider} Integration`,
        type: formData.type,
        provider: formData.provider,
        credentials
      }

      const response = await post('/integrations', payload)

      if (response.error) {
        setCreateError(response.error || response.message || 'Failed to create integration')
        return
      }

      if (response.data?.integration) {
        setIntegrations([response.data.integration, ...integrations])
        setShowCreateModal(false)
        setFormData({
          name: '',
          type: 'scheduling',
          provider: 'google_calendar',
          access_token: '',
          refresh_token: '',
          client_id: '',
          client_secret: '',
          calendar_id: 'primary',
          api_key: '',
          subdomain: '',
          instance_url: '',
          email: ''
        })
      }
    } catch (error: any) {
      console.error('Error creating integration:', error)
      setCreateError(error.message || 'Error creating integration')
    } finally {
      setCreateLoading(false)
    }
  }

  const toggleIntegration = async (id: number, currentStatus: boolean) => {
    try {
      const response = await put(`/integrations/${id}`, {
        is_active: !currentStatus
      })

      if (response.error) {
        setErrorMessages(prev => ({ ...prev, [id]: response.error || 'Failed to update integration' }))
        setTimeout(() => {
          setErrorMessages(prev => {
            const newErrors = { ...prev }
            delete newErrors[id]
            return newErrors
          })
        }, 5000)
        return
      }

      await fetchIntegrations()
      setErrorMessages(prev => {
        const newErrors = { ...prev }
        delete newErrors[id]
        return newErrors
      })
    } catch (error: any) {
      setErrorMessages(prev => ({ ...prev, [id]: error.message || 'Error toggling integration' }))
      setTimeout(() => {
        setErrorMessages(prev => {
          const newErrors = { ...prev }
          delete newErrors[id]
          return newErrors
        })
      }, 5000)
    }
  }

  const testConnection = async (integration: Integration) => {
    setTestingIntegration(integration.id)
    setErrorMessages(prev => {
      const newErrors = { ...prev }
      delete newErrors[integration.id]
      return newErrors
    })

    try {
      let endpoint = ''
      let payload: any = { integration_id: integration.id }

      if (integration.type === 'scheduling') {
        if (integration.provider === 'google_calendar') {
          endpoint = '/integrations/test/scheduling/google-calendar'
        } else {
          // For other calendar providers, use generic test
          endpoint = '/integrations/test/scheduling/google-calendar'
          payload = { integration_id: integration.id }
        }
      } else if (integration.type === 'crm') {
        endpoint = '/integrations/test/crm/connection'
      }

      if (!endpoint) {
        setErrorMessages(prev => ({ ...prev, [integration.id]: 'Test endpoint not available for this provider' }))
        setTestingIntegration(null)
        return
      }

      const response = await post(endpoint, payload)

      if (response.error || !response.data?.success) {
        const errorMsg = response.data?.error || response.data?.message || response.error || 'Connection test failed'
        setErrorMessages(prev => ({ ...prev, [integration.id]: errorMsg }))
        setTestResults(prev => [...prev.filter(r => r.integrationId !== integration.id), {
          integrationId: integration.id,
          success: false,
          message: errorMsg,
          details: response.data
        }])
      } else {
        setTestResults(prev => [...prev.filter(r => r.integrationId !== integration.id), {
          integrationId: integration.id,
          success: true,
          message: response.data?.message || 'Connection test successful',
          details: response.data
        }])
        // Refresh integrations to update last_sync_at
        await fetchIntegrations()
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Error testing connection'
      setErrorMessages(prev => ({ ...prev, [integration.id]: errorMsg }))
      setTestResults(prev => [...prev.filter(r => r.integrationId !== integration.id), {
        integrationId: integration.id,
        success: false,
        message: errorMsg
      }])
    } finally {
      setTestingIntegration(null)
    }
  }

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never'
    const date = new Date(lastSync)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const filteredIntegrations = integrations.filter(integration => {
    if (activeTab === 'calendar') {
      return integration.type === 'scheduling'
    } else if (activeTab === 'crm') {
      return integration.type === 'crm'
    }
    return false
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Integrations</h1>
          <p className="text-slate-400">Manage calendar, CRM, and webhook integrations</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-8 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'calendar'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="inline mr-2" size={18} />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('crm')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'crm'
                ? 'border-teal-500 text-teal-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="inline mr-2" size={18} />
            CRM
          </button>
          <button
            onClick={() => router.push('/integrations')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 border-transparent text-slate-400 hover:text-white`}
          >
            <Webhook className="inline mr-2" size={18} />
            Webhooks
          </button>
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {activeTab === 'calendar' ? 'Calendar Integrations' : 'CRM Integrations'}
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={18} />
              Add Integration
            </button>
          </div>

          {/* Status Dashboard Summary */}
          {filteredIntegrations.length > 0 && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={18} className="text-teal-400" />
                  <span className="text-sm text-slate-400">Total</span>
                </div>
                <p className="text-2xl font-bold text-white">{filteredIntegrations.length}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-green-400" />
                  <span className="text-sm text-slate-400">Active</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {filteredIntegrations.filter(i => i.is_active).length}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={18} className="text-blue-400" />
                  <span className="text-sm text-slate-400">Last Sync</span>
                </div>
                <p className="text-sm text-white">
                  {filteredIntegrations
                    .filter(i => i.last_sync_at)
                    .sort((a, b) => new Date(b.last_sync_at!).getTime() - new Date(a.last_sync_at!).getTime())[0]
                    ? formatLastSync(filteredIntegrations
                        .filter(i => i.last_sync_at)
                        .sort((a, b) => new Date(b.last_sync_at!).getTime() - new Date(a.last_sync_at!).getTime())[0]
                        .last_sync_at)
                    : 'Never'}
                </p>
              </div>
            </div>
          )}

          {/* Common Issues Help Messages */}
          {errorMessages['no-integrations'] && (
            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-300 mb-1">No {activeTab} integrations found</h4>
                  <p className="text-sm text-blue-200/80 mb-3">{errorMessages['no-integrations']}</p>
                  <button
                    onClick={() => {
                      setShowCreateModal(true)
                      setErrorMessages(prev => {
                        const newErrors = { ...prev }
                        delete newErrors['no-integrations']
                        return newErrors
                      })
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Create Integration Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMessages['inactive-integrations'] && (
            <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-yellow-300 mb-1">Integrations are inactive</h4>
                  <p className="text-sm text-yellow-200/80 mb-3">{errorMessages['inactive-integrations']}</p>
                  <div className="flex gap-2">
                    {filteredIntegrations.filter(i => !i.is_active).map(integration => (
                      <button
                        key={integration.id}
                        onClick={() => toggleIntegration(integration.id, false)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Enable {integration.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {errorMessages['fetch-error'] && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-300 mb-1">Error loading integrations</h4>
                  <p className="text-sm text-red-200/80 mb-3">{errorMessages['fetch-error']}</p>
                  <button
                    onClick={() => {
                      setLoading(true)
                      fetchIntegrations()
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredIntegrations.length === 0 ? (
            <div className="text-center py-12">
              <Calendar size={48} className="text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No {activeTab} integrations configured</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg"
              >
                Add Your First Integration
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredIntegrations.map((integration) => {
                const testResult = testResults.find(r => r.integrationId === integration.id)
                const errorMessage = errorMessages[integration.id]
                const isTesting = testingIntegration === integration.id

                return (
                  <div
                    key={integration.id}
                    className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{integration.name}</h3>
                          <p className="text-sm text-slate-400 capitalize">
                            {integration.provider.replace('_', ' ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {integration.is_active ? (
                            <span className="flex items-center gap-1 text-green-400 text-sm">
                              <CheckCircle size={16} />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400 text-sm">
                              <XCircle size={16} />
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {integration.last_sync_at && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={12} />
                            {formatLastSync(integration.last_sync_at)}
                          </span>
                        )}
                        <button
                          onClick={() => testConnection(integration)}
                          disabled={isTesting || !integration.is_active}
                          className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
                            isTesting
                              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                              : integration.is_active
                              ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          }`}
                          title={!integration.is_active ? 'Enable integration to test' : 'Test connection'}
                        >
                          {isTesting ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <TestTube size={14} />
                              Test
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => toggleIntegration(integration.id, integration.is_active)}
                          className={`px-3 py-1 rounded text-sm transition-colors ${
                            integration.is_active
                              ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                              : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                          }`}
                        >
                          {integration.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>

                    {/* Test Result */}
                    {testResult && (
                      <div className={`mt-3 p-3 rounded-lg border ${
                        testResult.success
                          ? 'bg-green-500/10 border-green-500/30 text-green-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-300'
                      }`}>
                        <div className="flex items-start gap-2">
                          {testResult.success ? (
                            <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{testResult.message}</p>
                            {testResult.details && testResult.details.calendars && (
                              <p className="text-xs mt-1 opacity-75">
                                Found {testResult.details.calendars.length} calendar(s)
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error Message with Detailed Troubleshooting */}
                    {errorMessage && (
                      <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-red-300 font-medium mb-1">{errorMessage}</p>
                            <div className="text-xs text-red-400/70 mt-1 space-y-1">
                              {/* Issue-specific troubleshooting */}
                              {integration.type === 'scheduling' && integration.provider === 'google_calendar' && (
                                <>
                                  <p>• Check if access token is valid or needs refresh</p>
                                  <p>• Verify Google Calendar API is enabled in Google Cloud Console</p>
                                  <p>• Ensure OAuth consent screen is published</p>
                                  <p>• Check if refresh token is still valid</p>
                                </>
                              )}
                              {integration.type === 'crm' && (
                                <>
                                  <p>• Verify API credentials and permissions</p>
                                  <p>• Check if API keys are not expired</p>
                                  <p>• Ensure required scopes/permissions are granted</p>
                                  <p>• Verify subdomain/instance URL is correct</p>
                                </>
                              )}
                              {errorMessage.includes('not found') && (
                                <>
                                  <p>• Integration may belong to a different organization</p>
                                  <p>• Contact admin to check organization_id assignment</p>
                                  <p>• Verify you're logged in with the correct account</p>
                                </>
                              )}
                              {errorMessage.includes('inactive') && (
                                <>
                                  <p>• Click "Enable" button above to activate this integration</p>
                                  <p>• Inactive integrations won't sync appointments or data</p>
                                </>
                              )}
                              {errorMessage.includes('connection') && (
                                <>
                                  <p>• Network connectivity issue - check internet connection</p>
                                  <p>• API endpoint may be temporarily unavailable</p>
                                  <p>• Try testing again in a few moments</p>
                                </>
                              )}
                              {!integration.type && (
                                <p>• Check integration configuration and credentials</p>
                              )}
                            </div>
                            {/* Quick fix buttons */}
                            <div className="flex gap-2 mt-3">
                              {!integration.is_active && (
                                <button
                                  onClick={() => toggleIntegration(integration.id, false)}
                                  className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-xs transition-colors"
                                >
                                  Enable Integration
                                </button>
                              )}
                              <button
                                onClick={() => testConnection(integration)}
                                disabled={testingIntegration === integration.id || !integration.is_active}
                                className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Test Again
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-slate-900 rounded-xl p-8 max-w-2xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Add {activeTab === 'calendar' ? 'Calendar' : 'CRM'} Integration
            </h2>

            {createError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Integration Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Google Calendar"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Provider</label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                >
                  {(activeTab === 'calendar' ? calendarProviders : crmProviders).map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Google Calendar Fields */}
              {formData.type === 'scheduling' && formData.provider === 'google_calendar' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Access Token</label>
                    <input
                      type="text"
                      value={formData.access_token}
                      onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                      placeholder="ya29..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Refresh Token</label>
                    <input
                      type="text"
                      value={formData.refresh_token}
                      onChange={(e) => setFormData({ ...formData, refresh_token: e.target.value })}
                      placeholder="1//04..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Client ID</label>
                    <input
                      type="text"
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      placeholder="407408718192.apps.googleusercontent.com"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Client Secret</label>
                    <input
                      type="password"
                      value={formData.client_secret}
                      onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                      placeholder="Optional"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Calendar ID</label>
                    <input
                      type="text"
                      value={formData.calendar_id}
                      onChange={(e) => setFormData({ ...formData, calendar_id: e.target.value })}
                      placeholder="primary"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </>
              )}

              {/* Other Calendar Providers */}
              {formData.type === 'scheduling' && formData.provider !== 'google_calendar' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
                  <input
                    type="text"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder="Enter API key"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              )}

              {/* CRM Fields */}
              {formData.type === 'crm' && (
                <>
                  {formData.provider === 'salesforce' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Access Token</label>
                        <input
                          type="text"
                          value={formData.access_token}
                          onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Instance URL</label>
                        <input
                          type="text"
                          value={formData.instance_url}
                          onChange={(e) => setFormData({ ...formData, instance_url: e.target.value })}
                          placeholder="https://yourorg.salesforce.com"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    </>
                  )}
                  {(formData.provider === 'zendesk' || formData.provider === 'freshdesk') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          {formData.provider === 'zendesk' ? 'Subdomain' : 'Domain'}
                        </label>
                        <input
                          type="text"
                          value={formData.subdomain}
                          onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                          placeholder={formData.provider === 'zendesk' ? 'yourcompany' : 'yourcompany.freshdesk.com'}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
                        <input
                          type="text"
                          value={formData.api_key}
                          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      {formData.provider === 'zendesk' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      )}
                    </>
                  )}
                  {formData.provider === 'hubspot' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Access Token</label>
                      <input
                        type="text"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        placeholder="Private app access token"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading ? 'Creating...' : 'Create Integration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

