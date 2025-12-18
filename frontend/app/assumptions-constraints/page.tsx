'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { get, post } from '@/lib/api'
import { sanitizeInput } from '@/lib/security'
import { isAuthenticated } from '@/lib/auth'

interface Assumption {
  id: number
  assumption_id: string
  category: string
  title: string
  description: string
  impact_level: string
}

interface Constraint {
  id: number
  constraint_id: string
  category: string
  title: string
  description: string
  constraint_type: string
  enforcement_level: string
}

export default function AssumptionsConstraintsPage() {
  const router = useRouter()
  const [assumptions, setAssumptions] = useState<Assumption[]>([])
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [activeTab, setActiveTab] = useState<'assumptions' | 'constraints'>('assumptions')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    category: 'all',
    search: '',
    enforcement_level: 'all' // for constraints
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    assumption_id: '',
    constraint_id: '',
    category: 'baa',
    title: '',
    description: '',
    impact_level: 'medium',
    constraint_type: 'technical',
    enforcement_level: 'mandatory'
  })


  const fetchData = async (overrideFilters?: typeof filters) => {
    try {
      setLoading(true)
      setError(null)
      const activeFilters = overrideFilters || filters
      const params = new URLSearchParams()
      if (activeFilters.category !== 'all') params.append('category', activeFilters.category)
      if (activeFilters.search) params.append('search', activeFilters.search)
      if (activeTab === 'constraints' && activeFilters.enforcement_level !== 'all') {
        params.append('enforcement_level', activeFilters.enforcement_level)
      }

      const [assumptionsResponse, constraintsResponse] = await Promise.all([
        get(`/assumptions-constraints/assumptions?${params}`),
        get(`/assumptions-constraints/constraints?${params}`)
      ])

      if (assumptionsResponse.error) {
        console.error('Error fetching assumptions:', assumptionsResponse.error)
        setAssumptions([])
      } else {
        setAssumptions(assumptionsResponse.data?.assumptions || [])
      }

      if (constraintsResponse.error) {
        console.error('Error fetching constraints:', constraintsResponse.error)
        setConstraints([])
      } else {
        setConstraints(constraintsResponse.data?.constraints || [])
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      setError(error?.message || 'Failed to load data')
      setAssumptions([])
      setConstraints([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, filters.category, filters.search, filters.enforcement_level, activeTab])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      if (activeTab === 'assumptions') {
        if (!formData.assumption_id.trim()) {
          setCreateError('Assumption ID is required')
          setCreating(false)
          return
        }
        if (!formData.title.trim()) {
          setCreateError('Title is required')
          setCreating(false)
          return
        }
        if (!formData.description.trim()) {
          setCreateError('Description is required')
          setCreating(false)
          return
        }

        const sanitizedData = {
          assumption_id: sanitizeInput(formData.assumption_id.trim()),
          category: sanitizeInput(formData.category),
          title: sanitizeInput(formData.title.trim()),
          description: sanitizeInput(formData.description.trim()),
          impact_level: formData.impact_level
        }

        const response = await post('/assumptions-constraints/assumptions', sanitizedData)
        
        if (response.error) {
          setCreateError(response.error || 'Failed to create assumption. Please try again.')
          setCreating(false)
          return
        }
      } else {
        if (!formData.constraint_id.trim()) {
          setCreateError('Constraint ID is required')
          setCreating(false)
          return
        }
        if (!formData.title.trim()) {
          setCreateError('Title is required')
          setCreating(false)
          return
        }
        if (!formData.description.trim()) {
          setCreateError('Description is required')
          setCreating(false)
          return
        }

        const sanitizedData = {
          constraint_id: sanitizeInput(formData.constraint_id.trim()),
          category: sanitizeInput(formData.category),
          title: sanitizeInput(formData.title.trim()),
          description: sanitizeInput(formData.description.trim()),
          constraint_type: formData.constraint_type,
          enforcement_level: formData.enforcement_level
        }

        const response = await post('/assumptions-constraints/constraints', sanitizedData)
        
        if (response.error) {
          setCreateError(response.error || 'Failed to create constraint. Please try again.')
          setCreating(false)
          return
        }
      }

      setShowCreateModal(false)
      setFormData({
        assumption_id: '',
        constraint_id: '',
        category: 'baa',
        title: '',
        description: '',
        impact_level: 'medium',
        constraint_type: 'technical',
        enforcement_level: 'mandatory'
      })
      setCreateError(null)
      
      // Fetch all data (without filters) to ensure the new item appears
      await fetchData({
        category: 'all',
        search: '',
        enforcement_level: 'all'
      })
      
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error: any) {
      console.error('Error creating:', error)
      setCreateError(error?.message || `Failed to create ${activeTab === 'assumptions' ? 'assumption' : 'constraint'}. Please try again.`)
    } finally {
      setCreating(false)
    }
  }

  const impactColors: Record<string, string> = {
    high: 'bg-red-500/50 border-red-400',
    medium: 'bg-yellow-500/50 border-yellow-400',
    low: 'bg-green-500/50 border-green-400'
  }

  const enforcementColors: Record<string, string> = {
    mandatory: 'bg-red-500/50 border-red-400',
    recommended: 'bg-yellow-500/50 border-yellow-400',
    optional: 'bg-green-500/50 border-green-400'
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-white text-xl font-semibold">Assumptions & Constraints</span>
        </div>
        <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
          ← Dashboard
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('assumptions')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'assumptions'
                ? 'bg-teal-600 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            Operational Assumptions
          </button>
          <button
            onClick={() => setActiveTab('constraints')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'constraints'
                ? 'bg-teal-600 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            Constraints
          </button>
        </div>

        {/* Filters and Create Button */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-white text-sm mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="all" className="bg-slate-800 text-white">All Categories</option>
                  <option value="baa" className="bg-slate-800 text-white">BAA</option>
                  <option value="ehr" className="bg-slate-800 text-white">EHR</option>
                  <option value="telephony" className="bg-slate-800 text-white">Telephony</option>
                  <option value="infrastructure" className="bg-slate-800 text-white">Infrastructure</option>
                  <option value="compliance" className="bg-slate-800 text-white">Compliance</option>
                  <option value="hipaa" className="bg-slate-800 text-white">HIPAA</option>
                  <option value="security" className="bg-slate-800 text-white">Security</option>
                  <option value="encryption" className="bg-slate-800 text-white">Encryption</option>
                  <option value="rbac" className="bg-slate-800 text-white">RBAC</option>
                  <option value="consent" className="bg-slate-800 text-white">Consent</option>
                </select>
              </div>
              {activeTab === 'constraints' && (
                <div>
                  <label className="block text-white text-sm mb-2">Enforcement Level</label>
                  <select
                    value={filters.enforcement_level}
                    onChange={(e) => setFilters({ ...filters, enforcement_level: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="all" className="bg-slate-800 text-white">All Levels</option>
                    <option value="mandatory" className="bg-slate-800 text-white">Mandatory</option>
                    <option value="recommended" className="bg-slate-800 text-white">Recommended</option>
                    <option value="optional" className="bg-slate-800 text-white">Optional</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-white text-sm mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-blue-200"
                />
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg whitespace-nowrap"
            >
              + New {activeTab === 'assumptions' ? 'Assumption' : 'Constraint'}
            </button>
          </div>
        </div>

        {/* Assumptions */}
        {activeTab === 'assumptions' && (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Operational Assumptions</h2>
              <p className="text-slate-300">
                These are assumptions about the operational environment and dependencies that the platform relies on.
              </p>
            </div>

            {assumptions.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                <p className="text-white text-lg">No assumptions found</p>
              </div>
            ) : (
              assumptions.map((assumption) => (
              <div
                key={assumption.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 border-white/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-teal-300 font-mono text-sm">{assumption.assumption_id}</span>
                      <span className={`px-3 py-1 rounded text-xs font-semibold border-2 ${impactColors[assumption.impact_level]}`}>
                        {assumption.impact_level} impact
                      </span>
                      <span className="px-3 py-1 rounded text-xs font-semibold bg-teal-600/50 text-white">
                        {assumption.category}
                      </span>
                    </div>
                    <h3 className="text-white font-bold text-lg">{assumption.title}</h3>
                  </div>
                </div>
                <p className="text-slate-200">{assumption.description}</p>
              </div>
              ))
            )}
          </div>
        )}

        {/* Constraints */}
        {activeTab === 'constraints' && (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Constraints</h2>
              <p className="text-slate-300">
                Technical, legal, operational, and regulatory constraints that must be enforced.
              </p>
            </div>

            {constraints.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                <p className="text-white text-lg">No constraints found</p>
              </div>
            ) : (
              constraints.map((constraint) => (
              <div
                key={constraint.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 border-white/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-teal-300 font-mono text-sm">{constraint.constraint_id}</span>
                      <span className={`px-3 py-1 rounded text-xs font-semibold border-2 ${enforcementColors[constraint.enforcement_level]}`}>
                        {constraint.enforcement_level}
                      </span>
                      <span className="px-3 py-1 rounded text-xs font-semibold bg-teal-600/50 text-white">
                        {constraint.category}
                      </span>
                      <span className="px-3 py-1 rounded text-xs font-semibold bg-purple-500/50 text-white">
                        {constraint.constraint_type}
                      </span>
                    </div>
                    <h3 className="text-white font-bold text-lg">{constraint.title}</h3>
                  </div>
                </div>
                <p className="text-slate-200">{constraint.description}</p>
              </div>
              ))
            )}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => {
            if (!creating) {
              setShowCreateModal(false)
              setCreateError(null)
            }
          }}>
            <div className="bg-slate-900 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-white mb-6">
                Create {activeTab === 'assumptions' ? 'Assumption' : 'Constraint'}
              </h2>
              {createError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                  {createError}
                </div>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-white mb-2">
                    {activeTab === 'assumptions' ? 'Assumption ID' : 'Constraint ID'}
                  </label>
                  <input
                    type="text"
                    required
                    value={activeTab === 'assumptions' ? formData.assumption_id : formData.constraint_id}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      [activeTab === 'assumptions' ? 'assumption_id' : 'constraint_id']: e.target.value 
                    })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    placeholder={activeTab === 'assumptions' ? 'ASM-001' : 'CON-001'}
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="baa" className="bg-slate-800 text-white">BAA</option>
                    <option value="ehr" className="bg-slate-800 text-white">EHR</option>
                    <option value="telephony" className="bg-slate-800 text-white">Telephony</option>
                    <option value="infrastructure" className="bg-slate-800 text-white">Infrastructure</option>
                    <option value="compliance" className="bg-slate-800 text-white">Compliance</option>
                    <option value="hipaa" className="bg-slate-800 text-white">HIPAA</option>
                    <option value="security" className="bg-slate-800 text-white">Security</option>
                    <option value="encryption" className="bg-slate-800 text-white">Encryption</option>
                    <option value="rbac" className="bg-slate-800 text-white">RBAC</option>
                    <option value="consent" className="bg-slate-800 text-white">Consent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Description</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                {activeTab === 'assumptions' ? (
                  <div>
                    <label className="block text-white mb-2">Impact Level</label>
                    <select
                      value={formData.impact_level}
                      onChange={(e) => setFormData({ ...formData, impact_level: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="high" className="bg-slate-800 text-white">High</option>
                      <option value="medium" className="bg-slate-800 text-white">Medium</option>
                      <option value="low" className="bg-slate-800 text-white">Low</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-white mb-2">Constraint Type</label>
                      <select
                        value={formData.constraint_type}
                        onChange={(e) => setFormData({ ...formData, constraint_type: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="technical" className="bg-slate-800 text-white">Technical</option>
                        <option value="legal" className="bg-slate-800 text-white">Legal</option>
                        <option value="operational" className="bg-slate-800 text-white">Operational</option>
                        <option value="regulatory" className="bg-slate-800 text-white">Regulatory</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white mb-2">Enforcement Level</label>
                      <select
                        value={formData.enforcement_level}
                        onChange={(e) => setFormData({ ...formData, enforcement_level: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value="mandatory" className="bg-slate-800 text-white">Mandatory</option>
                        <option value="recommended" className="bg-slate-800 text-white">Recommended</option>
                        <option value="optional" className="bg-slate-800 text-white">Optional</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="flex gap-4">
                  <button 
                    type="submit" 
                    disabled={creating}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 disabled:cursor-not-allowed text-white py-2 rounded-lg"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowCreateModal(false)
                      setCreateError(null)
                    }}
                    disabled={creating}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-500/50 disabled:cursor-not-allowed text-white py-2 rounded-lg"
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

