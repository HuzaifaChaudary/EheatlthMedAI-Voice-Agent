'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { post, get } from '@/lib/api'
import { sanitizeInput } from '@/lib/security'
import { isAuthenticated } from '@/lib/auth'

interface HL7Connector {
  id: number
  name: string
  endpoint_url: string
  hl7_version: string
  message_types: string[]
  is_active: boolean
  created_at: string
}

export default function HL7ConnectorsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const createFromEHR = searchParams.get('from_ehr') === 'true'

  const [connectors, setConnectors] = useState<HL7Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(createFromEHR || false)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    endpoint_url: '',
    hl7_version: '2.8',
    message_types: [] as string[],
    authentication_type: 'basic',
    username: '',
    password: ''
  })

  const availableMessageTypes = ['ADT', 'ORM', 'ORU', 'MDM', 'SIU', 'DFT']

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchConnectors()
  }, [router])

  const fetchConnectors = async () => {
    try {
      const response = await get('/integrations-ehr/hl7')
      if (response.data?.connectors) {
        setConnectors(response.data.connectors)
      }
    } catch (error) {
      console.error('Error fetching HL7 connectors:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleMessageType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      message_types: prev.message_types.includes(type)
        ? prev.message_types.filter(t => t !== type)
        : [...prev.message_types, type]
    }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)

    if (!formData.name || !formData.endpoint_url) {
      setCreateError('Name and Endpoint URL are required')
      setCreateLoading(false)
      return
    }

    // Validate URL
    try {
      new URL(formData.endpoint_url)
    } catch {
      setCreateError('Invalid Endpoint URL format')
      setCreateLoading(false)
      return
    }

    try {
      const credentials: any = {}
      if (formData.authentication_type === 'basic') {
        credentials.username = formData.username
        credentials.password = formData.password
      }

      const response = await post('/integrations-ehr/hl7', {
        name: sanitizeInput(formData.name),
        endpoint_url: sanitizeInput(formData.endpoint_url),
        hl7_version: formData.hl7_version,
        message_types: formData.message_types,
        authentication_type: formData.authentication_type,
        credentials: credentials
      })

      if (response.error) {
        setCreateError(response.error || response.message || 'Failed to create HL7 connector')
        return
      }

      if (response.data?.connector) {
        await fetchConnectors()
        setFormData({
          name: '',
          endpoint_url: '',
          hl7_version: '2.8',
          message_types: [],
          authentication_type: 'basic',
          username: '',
          password: ''
        })
        setShowCreateModal(false)
        
        if (createFromEHR) {
          router.push(`/architecture/ehr?connector_created=${response.data.connector.id}&type=hl7`)
        }
      } else {
        setCreateError('Failed to create HL7 connector')
      }
    } catch (error: any) {
      console.error('Error creating HL7 connector:', error)
      setCreateError(error.message || 'Error creating HL7 connector')
    } finally {
      setCreateLoading(false)
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
          <h1 className="text-4xl font-bold text-white mb-2">HL7 Connectors</h1>
          <p className="text-slate-300">
            Create and manage HL7 connectors for EHR system integration
          </p>
        </div>

        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <div className="text-slate-300">
            {connectors.length} {connectors.length === 1 ? 'connector' : 'connectors'} configured
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
          >
            + Add HL7 Connector
          </button>
        </div>

        {/* Connectors List */}
        {connectors.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
            <div className="text-slate-300 mb-4">No HL7 connectors configured yet.</div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Create Your First HL7 Connector
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{connector.name}</h3>
                    <p className="text-slate-400 text-sm break-all">{connector.endpoint_url}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${
                    connector.is_active
                      ? 'bg-green-500/20 text-green-300 border border-green-500'
                      : 'bg-red-500/20 text-red-300 border border-red-500'
                  }`}>
                    {connector.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">HL7 Version:</span>
                    <span className="text-white">{connector.hl7_version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Message Types:</span>
                    <span className="text-white">{connector.message_types?.join(', ') || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Created:</span>
                    <span className="text-white text-xs">{new Date(connector.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <Link
                    href={`/architecture/ehr?link_connector=${connector.id}&type=hl7`}
                    className="block w-full text-center px-4 py-2 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 rounded-lg text-sm transition-colors"
                  >
                    Use in EHR System
                  </Link>
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
                <h2 className="text-2xl font-bold text-white">Add HL7 Connector</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Connector Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g., Main HL7 Endpoint"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Endpoint URL *</label>
                  <input
                    type="url"
                    value={formData.endpoint_url}
                    onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="https://hl7.example.com/api"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">HL7 Version *</label>
                  <select
                    value={formData.hl7_version}
                    onChange={(e) => setFormData({ ...formData, hl7_version: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="2.8">2.8</option>
                    <option value="2.7">2.7</option>
                    <option value="2.6">2.6</option>
                    <option value="2.5">2.5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Message Types</label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableMessageTypes.map((type) => (
                      <label key={type} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.message_types.includes(type)}
                          onChange={() => toggleMessageType(type)}
                          className="w-4 h-4 text-teal-600 bg-slate-700 border-white/20 rounded focus:ring-teal-500"
                        />
                        <span className="text-slate-300 text-sm">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Authentication Type *</label>
                  <select
                    value={formData.authentication_type}
                    onChange={(e) => setFormData({ ...formData, authentication_type: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="none">None</option>
                    <option value="basic">Basic Auth</option>
                    <option value="bearer">Bearer Token</option>
                  </select>
                </div>

                {formData.authentication_type === 'basic' && (
                  <>
                    <div>
                      <label className="block text-slate-300 mb-2">Username</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                        placeholder="Username"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-2">Password</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                        placeholder="Password"
                      />
                    </div>
                  </>
                )}

                {createError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createLoading ? 'Creating...' : 'Create Connector'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

