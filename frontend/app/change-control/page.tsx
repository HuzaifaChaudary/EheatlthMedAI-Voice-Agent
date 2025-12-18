'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {  isAuthenticated  } from '@/lib/auth'
import { get, post } from '@/lib/api'

interface ChangeControl {
  id: number
  change_id: string
  change_type: string
  title: string
  description: string
  reason: string
  impact_assessment: string
  status: string
  proposed_by_email: string
  reviewed_by_email: string
  approved_by_email: string
  created_at: string
}

export default function ChangeControlPage() {
  const router = useRouter()
  const [changes, setChanges] = useState<ChangeControl[]>([])
  const [filteredChanges, setFilteredChanges] = useState<ChangeControl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    status: 'all',
    change_type: 'all'
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)
  const [formData, setFormData] = useState({
    change_id: '',
    change_type: 'requirement_change',
    title: '',
    description: '',
    reason: '',
    impact_assessment: '',
    affected_documents: [] as string[],
    affected_requirements: [] as string[]
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchChanges()
  }, [router])

  useEffect(() => {
    filterChanges()
  }, [filters, changes])

  const fetchChanges = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await get('/change-control')
      
      if (response.error) {
        console.error('Error fetching changes:', response.error)
        setError(response.error)
        setChanges([])
        setFilteredChanges([])
        return
      }

      if (response.data?.changes) {
        setChanges(response.data.changes)
        setFilteredChanges(response.data.changes)
      } else {
        setChanges([])
        setFilteredChanges([])
      }
    } catch (error: any) {
      console.error('Error fetching changes:', error)
      setError(error.message || 'Failed to load change control log')
      setChanges([])
      setFilteredChanges([])
    } finally {
      setLoading(false)
    }
  }

  const filterChanges = () => {
    let filtered = changes

    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status)
    }

    if (filters.change_type !== 'all') {
      filtered = filtered.filter(c => c.change_type === filters.change_type)
    }

    setFilteredChanges(filtered)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess(false)
    setCreateLoading(true)
    
    try {
      const response = await post('/change-control', formData)
      
      if (response.error) {
        setCreateError(response.error || 'Failed to create change request')
        console.error('Error creating change request:', response.error)
        return
      }
      
      if (response.data?.change) {
        setCreateSuccess(true)
        setShowCreateModal(false)
        setFormData({ 
          change_id: '', 
          change_type: 'requirement_change', 
          title: '', 
          description: '', 
          reason: '', 
          impact_assessment: '', 
          affected_documents: [], 
          affected_requirements: [] 
        })
        // Refresh the list
        await fetchChanges()
        // Reset success message after a delay
        setTimeout(() => setCreateSuccess(false), 3000)
      } else {
        setCreateError('Invalid response from server')
      }
    } catch (error: any) {
      setCreateError(error.message || 'Error creating change request')
      console.error('Error creating change request:', error)
    } finally {
      setCreateLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    proposed: 'bg-gray-500/50',
    under_review: 'bg-yellow-500/50',
    approved: 'bg-green-500/50',
    rejected: 'bg-red-500/50',
    implemented: 'bg-teal-600/50'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading change control log...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-white text-xl font-semibold">Change Control Log</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
            ← Dashboard
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg"
          >
            + New Change Request
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-4 mb-6 border border-red-500/50">
            <div className="text-red-200 font-semibold mb-1">Error Loading Change Control Log</div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white text-sm mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
              >
                <option value="all" className="bg-slate-800">All Statuses</option>
                <option value="proposed" className="bg-slate-800">Proposed</option>
                <option value="under_review" className="bg-slate-800">Under Review</option>
                <option value="approved" className="bg-slate-800">Approved</option>
                <option value="rejected" className="bg-slate-800">Rejected</option>
                <option value="implemented" className="bg-slate-800">Implemented</option>
              </select>
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Change Type</label>
              <select
                value={filters.change_type}
                onChange={(e) => setFilters({ ...filters, change_type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
              >
                <option value="all" className="bg-slate-800">All Types</option>
                <option value="requirement_change" className="bg-slate-800">Requirement Change</option>
                <option value="constraint_change" className="bg-slate-800">Constraint Change</option>
                <option value="assumption_change" className="bg-slate-800">Assumption Change</option>
                <option value="new_feature" className="bg-slate-800">New Feature</option>
                <option value="bug_fix" className="bg-slate-800">Bug Fix</option>
              </select>
            </div>
          </div>
        </div>

        {/* Changes List */}
        <div className="space-y-4">
          {filteredChanges.map((change) => (
            <div
              key={change.id}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-teal-300 font-mono text-sm">{change.change_id}</span>
                    <span className={`px-3 py-1 rounded text-xs font-semibold text-white capitalize ${statusColors[change.status] || 'bg-gray-500/50'}`}>
                      {change.status?.replace('_', ' ') || 'proposed'}
                    </span>
                    <span className="px-3 py-1 rounded text-xs font-semibold bg-purple-500/50 text-white capitalize">
                      {change.change_type?.replace('_', ' ') || 'N/A'}
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-2">{change.title}</h3>
                  <p className="text-slate-200 mb-3">{change.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {change.reason && (
                  <div>
                    <div className="text-slate-300 font-semibold mb-1">Reason</div>
                    <div className="text-slate-200">{change.reason}</div>
                  </div>
                )}
                {change.impact_assessment && (
                  <div>
                    <div className="text-slate-300 font-semibold mb-1">Impact Assessment</div>
                    <div className="text-slate-200">{change.impact_assessment}</div>
                  </div>
                )}
                {change.proposed_by_email && (
                  <div>
                    <div className="text-slate-300">Proposed By</div>
                    <div className="text-white">{change.proposed_by_email}</div>
                  </div>
                )}
                <div>
                  <div className="text-slate-300">Created</div>
                  <div className="text-white">{change.created_at ? new Date(change.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</div>
                </div>
                {change.reviewed_by_email && (
                  <div>
                    <div className="text-slate-300">Reviewed By</div>
                    <div className="text-white">{change.reviewed_by_email}</div>
                  </div>
                )}
                {change.approved_by_email && (
                  <div>
                    <div className="text-slate-300">Approved By</div>
                    <div className="text-white">{change.approved_by_email}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {!loading && filteredChanges.length === 0 && changes.length === 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="text-white text-lg mb-2">No change requests found</p>
            <p className="text-slate-300 text-sm mb-6">Start tracking changes to your requirements and specifications</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Create First Change Request
            </button>
          </div>
        )}

        {!loading && filteredChanges.length === 0 && changes.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <p className="text-white text-lg mb-4">No change requests match your filters</p>
            <button
              onClick={() => setFilters({ status: 'all', change_type: 'all' })}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
            <div className="bg-slate-900 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-white mb-6">Create Change Request</h2>
              
              {createError && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-4">
                  {createError}
                </div>
              )}
              
              {createSuccess && (
                <div className="bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg mb-4">
                  Change request created successfully!
                </div>
              )}
              
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white mb-2">Change ID</label>
                    <input
                      type="text"
                      required
                      value={formData.change_id}
                      onChange={(e) => setFormData({ ...formData, change_id: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                      placeholder="CHG-001"
                    />
                  </div>
                  <div>
                    <label className="block text-white mb-2">Change Type</label>
                    <select
                      value={formData.change_type}
                      onChange={(e) => setFormData({ ...formData, change_type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    >
                      <option value="requirement_change" className="bg-slate-800">Requirement Change</option>
                      <option value="constraint_change" className="bg-slate-800">Constraint Change</option>
                      <option value="assumption_change" className="bg-slate-800">Assumption Change</option>
                      <option value="new_feature" className="bg-slate-800">New Feature</option>
                      <option value="bug_fix" className="bg-slate-800">Bug Fix</option>
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
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Reason</label>
                  <textarea
                    required
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Impact Assessment</label>
                  <textarea
                    required
                    value={formData.impact_assessment}
                    onChange={(e) => setFormData({ ...formData, impact_assessment: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    type="submit" 
                    disabled={createLoading}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg"
                  >
                    {createLoading ? 'Creating...' : 'Create'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowCreateModal(false)
                      setCreateError('')
                      setCreateSuccess(false)
                    }} 
                    disabled={createLoading}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white py-2 rounded-lg"
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

