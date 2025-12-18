'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { get, post, put, del } from '@/lib/api'
import { sanitizeInput } from '@/lib/security'
import { isAuthenticated } from '@/lib/auth'

interface Portal {
  id: number
  name: string
  type: string
  url: string | null
  config: any
  created_at: string
}

export default function PortalsPage() {
  const router = useRouter()
  const [portals, setPortals] = useState<Portal[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [selectedPortal, setSelectedPortal] = useState<Portal | null>(null)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'web',
    url: '',
    config: {}
  })
  const [settingsFormData, setSettingsFormData] = useState({
    url: '',
    config: {}
  })

  const portalTypes = [
    { value: 'web', label: 'Web Portal' },
    { value: 'mobile', label: 'Mobile App' },
    { value: 'embedded', label: 'Embedded Widget' }
  ]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchPortals()
  }, [router])

  const fetchPortals = async () => {
    try {
      const response = await get('/presentation/portals')
      if (response.data?.portals) {
        setPortals(response.data.portals)
      }
    } catch (error) {
      console.error('Error fetching portals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePortal = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)

    if (!formData.name || !formData.type) {
      setCreateError('Name and type are required')
      setCreateLoading(false)
      return
    }

    try {
      const response = await post('/presentation/portals', {
        name: sanitizeInput(formData.name),
        type: formData.type,
        url: formData.url ? sanitizeInput(formData.url) : null,
        config: formData.config
      })

      if (response.error) {
        setCreateError(response.error || response.message || 'Failed to create portal')
        return
      }

      if (response.data?.portal) {
        await fetchPortals()
        setFormData({
          name: '',
          type: 'web',
          url: '',
          config: {}
        })
        setShowCreateModal(false)
      } else {
        setCreateError('Failed to create portal')
      }
    } catch (error: any) {
      console.error('Error creating portal:', error)
      setCreateError(error.message || 'Error creating portal')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleUpdatePortal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPortal) return

    setCreateError('')
    setCreateLoading(true)

    try {
      const response = await put(`/presentation/portals/${selectedPortal.id}`, {
        url: settingsFormData.url ? sanitizeInput(settingsFormData.url) : null,
        config: settingsFormData.config
      })

      if (response.error) {
        setCreateError(response.error || response.message || 'Failed to update portal')
        return
      }

      if (response.data?.portal) {
        await fetchPortals()
        setShowSettingsModal(false)
        setSelectedPortal(null)
      } else {
        setCreateError('Failed to update portal')
      }
    } catch (error: any) {
      console.error('Error updating portal:', error)
      setCreateError(error.message || 'Error updating portal')
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
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="text-white text-xl font-semibold">Client Portals</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/architecture" className="text-white hover:text-slate-300 text-sm">
            ← Architecture
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Create Portal
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Client Self-Service Portals</h1>
          <p className="text-slate-300">
            Manage client portals for self-service access to analytics, reports, and configurations
          </p>
        </div>

        {portals.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
            <div className="text-slate-300 mb-4">No portals configured yet.</div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Create Your First Portal
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {portals.map((portal) => (
              <div
                key={portal.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{portal.name}</h3>
                      <span className="px-3 py-1 text-sm rounded-full bg-teal-500/20 text-teal-300 border border-teal-500 capitalize">
                        {portal.type}
                      </span>
                      <span className="px-3 py-1 text-sm rounded-full bg-green-500/20 text-green-300 border border-green-500">
                        Active
                      </span>
                    </div>
                    {portal.url && (
                      <div className="mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <a
                          href={portal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:text-teal-300 text-sm break-all underline"
                        >
                          {portal.url}
                        </a>
                      </div>
                    )}
                    <div className="text-slate-400 text-sm mb-4">
                      Created: {new Date(portal.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                </div>

                {/* Portal Features/Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Link
                    href={`/analytics?portal=${portal.id}`}
                    className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <div>
                        <div className="text-white font-semibold">Analytics</div>
                        <div className="text-slate-400 text-xs">View portal analytics</div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    href={`/architecture/reports?portal=${portal.id}`}
                    className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <div className="text-white font-semibold">Reports</div>
                        <div className="text-slate-400 text-xs">Access reports</div>
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={() => {
                      setSelectedPortal(portal)
                      setSettingsFormData({
                        url: portal.url || '',
                        config: portal.config || {}
                      })
                      setShowSettingsModal(true)
                    }}
                    className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors cursor-pointer text-left w-full"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <div className="text-white font-semibold">Settings</div>
                        <div className="text-slate-400 text-xs">Configure portal</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Portal Configuration Preview */}
                {portal.config && Object.keys(portal.config).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-slate-300 text-sm font-semibold mb-2">Configuration</div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <pre className="text-xs text-slate-400 overflow-x-auto">
                        {JSON.stringify(portal.config, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                  {portal.url && (
                    <a
                      href={portal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open Portal
                    </a>
                  )}
                  <button
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      if (portal.url) {
                        navigator.clipboard.writeText(portal.url)
                        alert('Portal URL copied to clipboard!')
                      } else {
                        alert('No URL configured for this portal. Please add a URL in Settings.')
                      }
                    }}
                    title={portal.url ? 'Copy portal URL to clipboard' : 'No URL configured'}
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Portal Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Create Client Portal</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePortal} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Portal Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g., Client Portal - Acme Healthcare"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Portal Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    required
                  >
                    {portalTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Portal URL (Optional)</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="https://portal.example.com"
                  />
                </div>

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
                    {createLoading ? 'Creating...' : 'Create Portal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettingsModal && selectedPortal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Configure Portal: {selectedPortal.name}</h2>
                <button
                  onClick={() => {
                    setShowSettingsModal(false)
                    setSelectedPortal(null)
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdatePortal} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Portal URL</label>
                  <input
                    type="url"
                    value={settingsFormData.url}
                    onChange={(e) => setSettingsFormData({ ...settingsFormData, url: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="https://portal.example.com"
                  />
                  <p className="text-slate-400 text-xs mt-1">The URL where clients can access this portal</p>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Configuration (JSON)</label>
                  <textarea
                    value={JSON.stringify(settingsFormData.config, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        setSettingsFormData({ ...settingsFormData, config: parsed })
                      } catch {
                        // Invalid JSON, but allow typing
                      }
                    }}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 font-mono text-sm"
                    rows={8}
                    placeholder='{\n  "theme": "dark",\n  "features": ["analytics", "reports"]\n}'
                  />
                  <p className="text-slate-400 text-xs mt-1">Portal-specific configuration in JSON format</p>
                </div>

                {createError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(false)
                      setSelectedPortal(null)
                    }}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createLoading ? 'Saving...' : 'Save Changes'}
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

