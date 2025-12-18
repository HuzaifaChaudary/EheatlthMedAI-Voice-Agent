'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { post, get } from '@/lib/api'
import { sanitizeInput } from '@/lib/security'
import { isAuthenticated } from '@/lib/auth'

interface Requirement {
  id: number
  requirement_id: string
  category: string
  subcategory: string
  title: string
  description: string
  requirement_type: 'MUST' | 'SHOULD' | 'MAY'
  priority: string
  status: string
}

export default function RequirementsPage() {
  const router = useRouter()
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [filteredRequirements, setFilteredRequirements] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    category: 'all',
    requirement_type: 'all',
    status: 'all',
    search: ''
  })
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [createdRequirementId, setCreatedRequirementId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    requirement_id: '',
    category: 'platform',
    subcategory: '',
    title: '',
    description: '',
    requirement_type: 'MUST' as 'MUST' | 'SHOULD' | 'MAY',
    priority: 'high',
    status: 'draft'
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchRequirements()
  }, [router])

  useEffect(() => {
    filterRequirements()
  }, [filters, requirements])

  const fetchRequirements = async (overrideFilters?: typeof filters) => {
    try {
      setLoading(true)
      setError(null)
      const activeFilters = overrideFilters || filters
      const params = new URLSearchParams()
      if (activeFilters.category !== 'all') params.append('category', activeFilters.category)
      if (activeFilters.requirement_type !== 'all') params.append('requirement_type', activeFilters.requirement_type)
      if (activeFilters.status !== 'all') params.append('status', activeFilters.status)
      if (activeFilters.search) params.append('search', activeFilters.search)

      const response = await get(`/requirements?${params.toString()}`)
      
      if (response.error) {
        console.error('Error fetching requirements:', response.error)
        setError(response.error)
        setRequirements([])
        setFilteredRequirements([])
        return
      }
      
      const requirementsData = response.data?.requirements || []
      setRequirements(requirementsData)
      // Note: filteredRequirements will be updated by the filterRequirements useEffect
    } catch (error: any) {
      console.error('Error fetching requirements:', error)
      setError(error.message || 'Failed to load requirements')
      setRequirements([])
      setFilteredRequirements([])
    } finally {
      setLoading(false)
    }
  }

  const filterRequirements = () => {
    let filtered = requirements

    if (filters.category !== 'all') {
      filtered = filtered.filter(r => r.category === filters.category)
    }

    if (filters.requirement_type !== 'all') {
      filtered = filtered.filter(r => r.requirement_type === filters.requirement_type)
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(r => r.status === filters.status)
    }

    if (filters.search) {
      const query = filters.search.toLowerCase()
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.requirement_id.toLowerCase().includes(query)
      )
    }

    setFilteredRequirements(filtered)
  }

  // Group requirements by category and subcategory
  const groupRequirementsBySection = (reqs: Requirement[]) => {
    const grouped: Record<string, Record<string, Requirement[]>> = {}
    
    reqs.forEach(req => {
      const category = req.category || 'other'
      const subcategory = req.subcategory || 'general'
      
      if (!grouped[category]) {
        grouped[category] = {}
      }
      if (!grouped[category][subcategory]) {
        grouped[category][subcategory] = []
      }
      grouped[category][subcategory].push(req)
    })
    
    return grouped
  }

  const groupedRequirements = groupRequirementsBySection(filteredRequirements)

  const typeColors: Record<string, string> = {
    MUST: 'bg-red-500/50 border-red-400',
    SHOULD: 'bg-yellow-500/50 border-yellow-400',
    MAY: 'bg-green-500/50 border-green-400'
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateSuccess(false)

    try {
      // Validate required fields
      if (!formData.requirement_id.trim()) {
        setCreateError('Requirement ID is required')
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

      // Sanitize inputs
      const sanitizedData = {
        requirement_id: sanitizeInput(formData.requirement_id.trim()),
        category: sanitizeInput(formData.category),
        subcategory: formData.subcategory ? sanitizeInput(formData.subcategory.trim()) : null,
        title: sanitizeInput(formData.title.trim()),
        description: sanitizeInput(formData.description.trim()),
        requirement_type: formData.requirement_type,
        priority: formData.priority,
        status: formData.status
      }

      const response = await post('/requirements', sanitizedData)
      
      if (response.error) {
        setCreateError(response.error || 'Failed to create requirement. Please try again.')
        setCreating(false)
        return
      }
      
      setCreateSuccess(true)
      setShowCreateModal(false)
      setFormData({ 
        requirement_id: '', 
        category: 'platform', 
        subcategory: '', 
        title: '', 
        description: '', 
        requirement_type: 'MUST', 
        priority: 'high', 
        status: 'draft' 
      })
      setCreateError(null)
      
      // Store the created requirement ID to highlight it
      if (response.data?.requirement?.requirement_id) {
        setCreatedRequirementId(response.data.requirement.requirement_id)
        // Clear the highlight after 5 seconds
        setTimeout(() => setCreatedRequirementId(null), 5000)
      }
      
      // Reset success message after delay
      setTimeout(() => setCreateSuccess(false), 3000)
      
      // Fetch all requirements (without filters) to ensure the new one appears
      await fetchRequirements({
        category: 'all',
        requirement_type: 'all',
        status: 'all',
        search: ''
      })
      
      // Scroll to top to show the new requirement in its section
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error: any) {
      console.error('Error creating requirement:', error)
      setCreateError(error?.message || 'Failed to create requirement. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/50',
    approved: 'bg-teal-600/50',
    implemented: 'bg-green-500/50',
    verified: 'bg-purple-500/50',
    deprecated: 'bg-red-500/50'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading requirements...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-white text-xl font-semibold">Requirements Management</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
            ← Dashboard
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg"
          >
            + New Requirement
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-4 mb-6 border border-red-500/50">
            <div className="text-red-200 font-semibold mb-1">Error Loading Requirements</div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-white text-sm mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              >
                <option value="all" className="bg-slate-800 text-white">All Categories</option>
                <option value="platform" className="bg-slate-800 text-white">Platform</option>
                <option value="agent" className="bg-slate-800 text-white">Agent</option>
                <option value="integration" className="bg-slate-800 text-white">Integration</option>
                <option value="compliance" className="bg-slate-800 text-white">Compliance</option>
              </select>
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Type (RFC 2119)</label>
              <select
                value={filters.requirement_type}
                onChange={(e) => setFilters({ ...filters, requirement_type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              >
                <option value="all" className="bg-slate-800 text-white">All Types</option>
                <option value="MUST" className="bg-slate-800 text-white">MUST</option>
                <option value="SHOULD" className="bg-slate-800 text-white">SHOULD</option>
                <option value="MAY" className="bg-slate-800 text-white">MAY</option>
              </select>
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              >
                <option value="all" className="bg-slate-800 text-white">All Statuses</option>
                <option value="draft" className="bg-slate-800 text-white">Draft</option>
                <option value="approved" className="bg-slate-800 text-white">Approved</option>
                <option value="implemented" className="bg-slate-800 text-white">Implemented</option>
                <option value="verified" className="bg-slate-800 text-white">Verified</option>
              </select>
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Search</label>
              <input
                type="text"
                placeholder="Search requirements..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-blue-200"
              />
            </div>
          </div>
        </div>

        {/* Requirements List - Organized by Sections */}
        <div className="space-y-8">
          {!loading && Object.keys(groupedRequirements).length === 0 && requirements.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
              <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-white text-lg mb-2">No requirements found</p>
              <p className="text-slate-300 text-sm mb-6">Start creating RFC 2119 requirements for your project</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Create First Requirement
              </button>
            </div>
          ) : !loading && Object.keys(groupedRequirements).length === 0 && requirements.length > 0 ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
              <p className="text-white text-lg mb-4">No requirements match your filters</p>
              <button
                onClick={() => setFilters({ category: 'all', requirement_type: 'all', status: 'all', search: '' })}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            Object.entries(groupedRequirements).map(([category, subcategories]) => (
              <div key={category} className="space-y-6">
                {/* Category Header */}
                <div className="border-b border-white/20 pb-2">
                  <h2 className="text-2xl font-bold text-white capitalize">{category}</h2>
                  <p className="text-slate-300 text-sm mt-1">
                    {Object.values(subcategories).flat().length} requirement{Object.values(subcategories).flat().length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Subcategories */}
                {Object.entries(subcategories).map(([subcategory, reqs]) => (
                  <div key={`${category}-${subcategory}`} className="space-y-4">
                    {/* Subcategory Header (only if subcategory exists) */}
                    {subcategory !== 'general' && (
                      <div className="ml-4 border-l-2 border-teal-500/50 pl-4">
                        <h3 className="text-xl font-semibold text-teal-300 capitalize">{subcategory}</h3>
                        <p className="text-slate-400 text-sm">{reqs.length} requirement{reqs.length !== 1 ? 's' : ''}</p>
                      </div>
                    )}

                    {/* Requirements in this subcategory */}
                    <div className={subcategory !== 'general' ? 'ml-8 space-y-4' : 'space-y-4'}>
                      {reqs.map((req) => (
                        <div
                          key={req.id}
                          onClick={() => setSelectedRequirement(req)}
                          className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 cursor-pointer transition-all hover:bg-white/20 ${
                            selectedRequirement?.id === req.id ? 'ring-2 ring-teal-400' : 'border-white/20'
                          } ${
                            createdRequirementId === req.requirement_id ? 'ring-2 ring-green-400 bg-green-500/10 animate-pulse' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="text-teal-300 font-mono text-sm">{req.requirement_id}</span>
                                <span className={`px-3 py-1 rounded text-xs font-semibold border-2 ${typeColors[req.requirement_type]}`}>
                                  {req.requirement_type}
                                </span>
                                <span className={`px-3 py-1 rounded text-xs font-semibold text-white capitalize ${statusColors[req.status] || 'bg-gray-500/50'}`}>
                                  {req.status?.replace('_', ' ') || 'draft'}
                                </span>
                              </div>
                              <h3 className="text-white font-bold text-lg mb-1">{req.title}</h3>
                              <div className="flex items-center gap-3 text-sm text-slate-300">
                                <span className="capitalize">{req.priority} priority</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-slate-200 line-clamp-2">{req.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>


        {/* Requirement Detail Modal */}
        {selectedRequirement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedRequirement(null)}>
            <div className="bg-slate-900 rounded-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedRequirement.title}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-teal-300 font-mono">{selectedRequirement.requirement_id}</span>
                    <span className={`px-3 py-1 rounded text-sm font-semibold border-2 ${typeColors[selectedRequirement.requirement_type]}`}>
                      {selectedRequirement.requirement_type}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedRequirement(null)} className="text-white hover:text-slate-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold mb-2">Description</h3>
                  <p className="text-slate-200">{selectedRequirement.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-white font-semibold mb-2">Category</h3>
                    <p className="text-slate-200 capitalize">{selectedRequirement.category}</p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Status</h3>
                    <p className="text-slate-200 capitalize">{selectedRequirement.status}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2">RFC 2119 Requirement Type</h3>
                  <p className="text-slate-200">
                    <strong>{selectedRequirement.requirement_type}</strong> - {
                      selectedRequirement.requirement_type === 'MUST' ? 'This is an absolute requirement of the specification.' :
                      selectedRequirement.requirement_type === 'SHOULD' ? 'This is recommended but not required.' :
                      'This is optional and may be implemented as needed.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => {
            if (!creating) {
              setShowCreateModal(false)
              setCreateError(null)
            }
          }}>
            <div className="bg-slate-900 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-white mb-6">Create Requirement</h2>
              
              {createError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                  {createError}
                </div>
              )}
              
              {createSuccess && (
                <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
                  Requirement created successfully!
                </div>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white mb-2">Requirement ID</label>
                    <input
                      type="text"
                      required
                      value={formData.requirement_id}
                      onChange={(e) => setFormData({ ...formData, requirement_id: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                      placeholder="PLAT-SEC-001"
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
                      <option value="platform" className="bg-slate-800 text-white">Platform</option>
                      <option value="agent" className="bg-slate-800 text-white">Agent</option>
                      <option value="integration" className="bg-slate-800 text-white">Integration</option>
                      <option value="compliance" className="bg-slate-800 text-white">Compliance</option>
                    </select>
                  </div>
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
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-white mb-2">Type (RFC 2119)</label>
                    <select
                      value={formData.requirement_type}
                      onChange={(e) => setFormData({ ...formData, requirement_type: e.target.value as 'MUST' | 'SHOULD' | 'MAY' })}
                      className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="MUST" className="bg-slate-800 text-white">MUST</option>
                      <option value="SHOULD" className="bg-slate-800 text-white">SHOULD</option>
                      <option value="MAY" className="bg-slate-800 text-white">MAY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white mb-2">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="high" className="bg-slate-800 text-white">High</option>
                      <option value="medium" className="bg-slate-800 text-white">Medium</option>
                      <option value="low" className="bg-slate-800 text-white">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="draft" className="bg-slate-800 text-white">Draft</option>
                      <option value="approved" className="bg-slate-800 text-white">Approved</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-white mb-2">Subcategory (Optional)</label>
                  <input
                    type="text"
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
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
                      setCreateSuccess(false)
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

