'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { post, get, put } from '@/lib/api'
import { sanitizeInput } from '@/lib/security'
import { isAuthenticated } from '@/lib/auth'

interface EHRSystem {
  id: number
  name: string
  vendor: string
  ehr_type: string
  connection_type: string
  connector_id: number | null
  connector_type: string | null
  connector_name: string | null
  is_active: boolean
  sync_enabled: boolean
  sync_frequency: string | null
  last_sync_at: string | null
  created_at: string
}

interface HL7Connector {
  id: number
  name: string
  hl7_version: string
  message_types: string[]
  endpoint_url: string
  is_active: boolean
}

interface FHIRConnector {
  id: number
  name: string
  fhir_version: string
  base_url: string
  resource_types: string[]
  is_active: boolean
}

export default function EHRSystemsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [ehrSystems, setEhrSystems] = useState<EHRSystem[]>([])
  const [hl7Connectors, setHl7Connectors] = useState<HL7Connector[]>([])
  const [fhirConnectors, setFhirConnectors] = useState<FHIRConnector[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState<EHRSystem | null>(null)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState<number | null>(null)
  const [syncingSystem, setSyncingSystem] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ systemId: number; success: boolean; message: string } | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    vendor: '',
    ehr_type: '',
    connection_type: 'fhir',
    connector_id: '',
    connector_type: 'fhir',
    sync_enabled: false,
    sync_frequency: 'daily'
  })

  const vendors = [
    'Epic',
    'Cerner',
    'Allscripts',
    'Athenahealth',
    'eClinicalWorks',
    'NextGen',
    'Greenway Health',
    'Other'
  ]

  const connectionTypes = [
    { value: 'fhir', label: 'FHIR' },
    { value: 'hl7', label: 'HL7' },
    { value: 'api', label: 'Custom API' }
  ]

  const syncFrequencies = [
    { value: 'real-time', label: 'Real-time' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' }
  ]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchEHRSystems()
    fetchConnectors()

    // Check for connector_created or link_connector query params
    const connectorCreated = searchParams.get('connector_created')
    const linkConnector = searchParams.get('link_connector')
    const connectorType = searchParams.get('type')

    if (linkConnector && connectorType) {
      // Find the EHR system to link
      const systemToLink = ehrSystems.find(s => !s.connector_id || (s.connection_type === connectorType && !s.connector_id))
      if (systemToLink) {
        setSelectedSystem(systemToLink)
        setShowLinkModal(true)
        // Clean URL
        router.replace('/architecture/ehr')
      }
    } else if (connectorCreated) {
      // Show success message and suggest linking
      alert(`Connector created successfully! Now link it to an EHR system.`)
      router.replace('/architecture/ehr')
    }
  }, [router, searchParams, ehrSystems])

  const fetchEHRSystems = async () => {
    try {
      const response = await get('/integrations-ehr/ehr')
      if (response.data?.ehr_systems) {
        setEhrSystems(response.data.ehr_systems)
      }
    } catch (error) {
      console.error('Error fetching EHR systems:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConnectors = async () => {
    try {
      const [hl7Response, fhirResponse] = await Promise.all([
        get('/integrations-ehr/hl7'),
        get('/integrations-ehr/fhir')
      ])

      if (hl7Response.data?.connectors) {
        setHl7Connectors(hl7Response.data.connectors.filter((c: HL7Connector) => c.is_active))
      }
      if (fhirResponse.data?.connectors) {
        setFhirConnectors(fhirResponse.data.connectors.filter((c: FHIRConnector) => c.is_active))
      }
    } catch (error) {
      console.error('Error fetching connectors:', error)
    }
  }

  const handleCreateEHR = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)

    if (!formData.name || !formData.vendor) {
      setCreateError('Name and vendor are required')
      setCreateLoading(false)
      return
    }

    try {
      const payload: any = {
        name: sanitizeInput(formData.name),
        vendor: sanitizeInput(formData.vendor),
        ehr_type: sanitizeInput(formData.ehr_type || formData.vendor),
        connection_type: formData.connection_type,
        connector_type: formData.connector_type,
        sync_enabled: formData.sync_enabled,
        sync_frequency: formData.sync_frequency
      }

      if (formData.connector_id) {
        payload.connector_id = parseInt(formData.connector_id)
      }

      const response = await post('/integrations-ehr/ehr', payload)

      if (response.error) {
        setCreateError(response.error || response.message || 'Failed to create EHR system')
        return
      }

      if (response.data?.ehr_system) {
        setEhrSystems([response.data.ehr_system, ...ehrSystems])
        setFormData({
          name: '',
          vendor: '',
          ehr_type: '',
          connection_type: 'fhir',
          connector_id: '',
          connector_type: 'fhir',
          sync_enabled: false,
          sync_frequency: 'daily'
        })
        setShowCreateModal(false)
      } else {
        setCreateError('Failed to create EHR system')
      }
    } catch (error: any) {
      console.error('Error creating EHR system:', error)
      setCreateError(error.message || 'Error creating EHR system')
    } finally {
      setCreateLoading(false)
    }
  }

  const getStatusBadge = (system: EHRSystem) => {
    if (!system.is_active) {
      return <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300">Inactive</span>
    }
    if (system.last_sync_at) {
      return <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-300">Connected</span>
    }
    return <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-300">Pending</span>
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  const handleTestConnection = async (systemId: number) => {
    setTestingConnection(systemId)
    setTestResult(null)
    
    try {
      const response = await get(`/integrations-ehr/ehr/${systemId}/test-connection`)
      
      if (response.data?.success) {
        setTestResult({
          systemId,
          success: true,
          message: response.data.message || 'Connection test successful.'
        })
      } else {
        setTestResult({
          systemId,
          success: false,
          message: response.data?.message || response.error || 'Connection test failed.'
        })
      }
    } catch (error: any) {
      setTestResult({
        systemId,
        success: false,
        message: error.error || error.message || 'Connection test failed. Please check your connector configuration.'
      })
    } finally {
      setTestingConnection(null)
      // Clear test result after 5 seconds
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  const handleSyncNow = async (systemId: number) => {
    setSyncingSystem(systemId)
    
    try {
      // Pull appointments as a sync operation - this will update last_sync_at
      const response = await get(`/integrations-ehr/ehr/${systemId}/pull/appointments`)
      
      if (response.ok && response.data) {
        // Success - refresh to show updated last_sync_at
        await fetchEHRSystems()
        setTestResult({
          systemId,
          success: true,
          message: `Sync completed successfully. Found ${response.data.total || 0} appointments.`
        })
        setTimeout(() => setTestResult(null), 5000)
      } else {
        setTestResult({
          systemId,
          success: false,
          message: response.error || 'Sync completed but no data was returned.'
        })
        setTimeout(() => setTestResult(null), 5000)
      }
    } catch (error: any) {
      console.error('Sync error:', error)
      setTestResult({
        systemId,
        success: false,
        message: error.error || error.message || 'Sync failed. Please check your connector configuration and try again.'
      })
      setTimeout(() => setTestResult(null), 5000)
    } finally {
      setSyncingSystem(null)
    }
  }

  const availableConnectors = formData.connector_type === 'hl7' 
    ? hl7Connectors 
    : formData.connector_type === 'fhir'
    ? fhirConnectors
    : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/architecture" 
            className="text-slate-400 hover:text-white mb-4 inline-block transition-colors"
          >
            ← Back to Architecture
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">EHR Systems</h1>
          <p className="text-slate-300">
            Manage Electronic Health Record system integrations. Connect to Epic, Cerner, and other EHR platforms via HL7 or FHIR.
          </p>
        </div>

        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <div className="text-slate-300">
            {ehrSystems.length} {ehrSystems.length === 1 ? 'system' : 'systems'} configured
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
          >
            + Add EHR System
          </button>
        </div>

        {/* EHR Systems List */}
        {loading ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
            <div className="text-slate-300">Loading EHR systems...</div>
          </div>
        ) : ehrSystems.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
            <div className="text-slate-300 mb-4">No EHR systems configured yet.</div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Create Your First EHR System
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ehrSystems.map((system) => (
              <div
                key={system.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{system.name}</h3>
                    <p className="text-slate-400 text-sm">{system.vendor}</p>
                  </div>
                  {getStatusBadge(system)}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-white">{system.ehr_type || system.connection_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Connection:</span>
                    <span className="text-white uppercase">{system.connection_type || 'N/A'}</span>
                  </div>
                  {system.connector_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Connector:</span>
                      <span className="text-white">{system.connector_name}</span>
                    </div>
                  )}
                  {system.sync_enabled && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sync:</span>
                      <span className="text-white">{system.sync_frequency || 'Manual'}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Sync:</span>
                    <span className="text-white text-xs">{formatDate(system.last_sync_at)}</span>
                  </div>
                </div>

                {testResult && testResult.systemId === system.id && (
                  <div className={`mt-4 p-3 rounded-lg text-sm ${
                    testResult.success 
                      ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                      : 'bg-red-500/20 border border-red-500/50 text-red-300'
                  }`}>
                    {testResult.message}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestConnection(system.id)}
                      disabled={testingConnection === system.id}
                      className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-3 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingConnection === system.id ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                      onClick={() => handleSyncNow(system.id)}
                      disabled={syncingSystem === system.id}
                      className="flex-1 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 px-3 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {syncingSystem === system.id ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Add EHR System</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateEHR} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">System Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g., Main Hospital EHR"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Vendor *</label>
                  <select
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value, ehr_type: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    required
                  >
                    <option value="">Select vendor...</option>
                    {vendors.map((vendor) => (
                      <option key={vendor} value={vendor.toLowerCase()}>
                        {vendor}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Connection Type *</label>
                  <select
                    value={formData.connection_type}
                    onChange={(e) => setFormData({ ...formData, connection_type: e.target.value, connector_type: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    required
                  >
                    {connectionTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {(formData.connection_type === 'fhir' || formData.connection_type === 'hl7') && (
                  <div>
                    <label className="block text-slate-300 mb-2">
                      {formData.connection_type.toUpperCase()} Connector (Optional)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formData.connector_id}
                        onChange={(e) => setFormData({ ...formData, connector_id: e.target.value })}
                        className="flex-1 bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                      >
                        <option value="">Skip - Link connector later</option>
                        {availableConnectors.map((connector) => (
                          <option key={connector.id} value={connector.id}>
                            {connector.name} ({formData.connection_type === 'fhir' ? (connector as FHIRConnector).fhir_version : (connector as HL7Connector).hl7_version})
                          </option>
                        ))}
                      </select>
                      <Link
                        href={`/architecture/${formData.connection_type}?from_ehr=true`}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm transition-colors whitespace-nowrap"
                        title={`Create new ${formData.connection_type.toUpperCase()} connector`}
                      >
                        + Create New
                      </Link>
                    </div>
                    {availableConnectors.length === 0 && (
                      <div className="mt-2 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                        <p className="text-blue-300 text-sm mb-1">
                          <strong>Tip:</strong> You can create the EHR system now and link a connector later, or create a connector first.
                        </p>
                        <p className="text-blue-200 text-xs">
                          Click "Create New" to go to the connectors page, or skip this step and link a connector after creating the EHR system.
                        </p>
                      </div>
                    )}
                    {formData.connector_id === '' && availableConnectors.length > 0 && (
                      <p className="mt-2 text-slate-400 text-xs">
                        You can link a connector after creating the EHR system by editing it.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sync_enabled"
                    checked={formData.sync_enabled}
                    onChange={(e) => setFormData({ ...formData, sync_enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-700/50 border-white/20 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="sync_enabled" className="text-slate-300">
                    Enable automatic synchronization
                  </label>
                </div>

                {formData.sync_enabled && (
                  <div>
                    <label className="block text-slate-300 mb-2">Sync Frequency</label>
                    <select
                      value={formData.sync_frequency}
                      onChange={(e) => setFormData({ ...formData, sync_frequency: e.target.value })}
                      className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    >
                      {syncFrequencies.map((freq) => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {createError && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createLoading ? 'Creating...' : 'Create EHR System'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Link Connector Modal */}
        {showLinkModal && selectedSystem && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Link Connector to {selectedSystem.name}</h2>
                <button
                  onClick={() => {
                    setShowLinkModal(false)
                    setSelectedSystem(null)
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Select {selectedSystem.connection_type?.toUpperCase()} Connector</label>
                  <select
                    id="link-connector-select"
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">Select a connector...</option>
                    {(selectedSystem.connection_type === 'fhir' ? fhirConnectors : hl7Connectors).map((connector) => (
                      <option key={connector.id} value={connector.id}>
                        {connector.name} ({selectedSystem.connection_type === 'fhir' ? (connector as FHIRConnector).fhir_version : (connector as HL7Connector).hl7_version})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLinkModal(false)
                      setSelectedSystem(null)
                    }}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const select = document.getElementById('link-connector-select') as HTMLSelectElement
                      const connectorId = select?.value
                      if (!connectorId) {
                        alert('Please select a connector')
                        return
                      }

                      try {
                        const response = await put(`/integrations-ehr/ehr/${selectedSystem.id}`, {
                          connector_id: parseInt(connectorId),
                          connector_type: selectedSystem.connection_type
                        })

                        if (response.error) {
                          alert(response.error || 'Failed to link connector')
                          return
                        }

                        alert('Connector linked successfully!')
                        setShowLinkModal(false)
                        setSelectedSystem(null)
                        await fetchEHRSystems()
                        await fetchConnectors()
                      } catch (error: any) {
                        console.error('Error linking connector:', error)
                        alert(error.message || 'Error linking connector')
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  >
                    Link Connector
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

