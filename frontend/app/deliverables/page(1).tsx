'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { post, get } from '@/lib/api'
import { sanitizeInput, isValidEmail } from '@/lib/security'
import { isAuthenticated } from '@/lib/auth'

interface Deliverable {
  id: number
  deliverable_id: string
  title: string
  description: string
  category: string
  priority: string
  status: string
  assigned_to_email: string
  due_date: string
  completed_date: string
  milestones: any[]
}

const categories = [
  { value: 'functional_requirements', label: 'Functional Requirements' },
  { value: 'external_interfaces', label: 'External Interfaces' },
  { value: 'nfrs', label: 'Non-Functional Requirements' },
  { value: 'workflows', label: 'Workflows' },
  { value: 'data_models', label: 'Data Models' },
  { value: 'test_plans', label: 'Test Plans' }
]

export default function DeliverablesPage() {
  const router = useRouter()
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [filteredDeliverables, setFilteredDeliverables] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    priority: 'all'
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [formData, setFormData] = useState({
    deliverable_id: '',
    title: '',
    description: '',
    category: 'functional_requirements',
    priority: 'medium',
    status: 'planned',
    due_date: '',
    assigned_to_email: ''
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchDeliverables()
  }, [router])

  useEffect(() => {
    filterDeliverables()
  }, [filters, deliverables])

  const fetchDeliverables = async () => {
    try {
      const response = await get('/deliverables')
      if (response.data?.deliverables) {
        setDeliverables(response.data.deliverables)
        setFilteredDeliverables(response.data.deliverables)
      }
    } catch (error) {
      console.error('Error fetching deliverables:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterDeliverables = () => {
    let filtered = deliverables

    if (filters.category !== 'all') {
      filtered = filtered.filter(d => d.category === filters.category)
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(d => d.status === filters.status)
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(d => d.priority === filters.priority)
    }

    setFilteredDeliverables(filtered)
  }

  const statusColors: Record<string, string> = {
    planned: 'bg-gray-500/50',
    in_progress: 'bg-teal-600/50',
    review: 'bg-yellow-500/50',
    completed: 'bg-green-500/50',
    blocked: 'bg-red-500/50'
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    
    // Validate assigned email if provided
    if (formData.assigned_to_email && !isValidEmail(formData.assigned_to_email)) {
      setCreateError('Please enter a valid email address')
      return
    }

    setCreateLoading(true)

    // Sanitize input
    const sanitizedData: any = {
      deliverable_id: sanitizeInput(formData.deliverable_id),
      title: sanitizeInput(formData.title),
      description: sanitizeInput(formData.description),
      category: formData.category,
      priority: formData.priority,
      status: formData.status,
      due_date: formData.due_date || null
    }

    // Add assigned_to_email if provided (backend will look up user ID)
    if (formData.assigned_to_email) {
      sanitizedData.assigned_to_email = sanitizeInput(formData.assigned_to_email)
    }

    try {
      const response = await post('/deliverables', sanitizedData)
      
      if (response.data?.deliverable) {
        setShowCreateModal(false)
        setCreateError('')
        setFormData({
          deliverable_id: '',
          title: '',
          description: '',
          category: 'functional_requirements',
          priority: 'medium',
          status: 'planned',
          due_date: '',
          assigned_to_email: ''
        })
        fetchDeliverables()
      } else {
        setCreateError(response.error || response.message || 'Failed to create deliverable')
      }
    } catch (error: any) {
      console.error('Error creating deliverable:', error)
      setCreateError(error.message || error.error || 'Failed to create deliverable. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/50',
    medium: 'bg-yellow-500/50',
    low: 'bg-green-500/50'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading deliverables...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-white text-xl font-semibold">Deliverables Tracking</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
            ← Dashboard
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg"
          >
            + New Deliverable
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-white text-sm mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
              >
                <option value="all" className="bg-slate-800">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value} className="bg-slate-800">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
              >
                <option value="all" className="bg-slate-800">All Statuses</option>
                <option value="planned" className="bg-slate-800">Planned</option>
                <option value="in_progress" className="bg-slate-800">In Progress</option>
                <option value="review" className="bg-slate-800">Review</option>
                <option value="completed" className="bg-slate-800">Completed</option>
                <option value="blocked" className="bg-slate-800">Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
              >
                <option value="all" className="bg-slate-800">All Priorities</option>
                <option value="high" className="bg-slate-800">High</option>
                <option value="medium" className="bg-slate-800">Medium</option>
                <option value="low" className="bg-slate-800">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Deliverables List */}
        <div className="space-y-4">
          {filteredDeliverables.map((deliverable) => (
            <div
              key={deliverable.id}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-teal-300 font-mono text-sm">{deliverable.deliverable_id}</span>
                    <span className={`px-3 py-1 rounded text-xs font-semibold ${statusColors[deliverable.status]}`}>
                      {deliverable.status}
                    </span>
                    <span className={`px-3 py-1 rounded text-xs font-semibold ${priorityColors[deliverable.priority]}`}>
                      {deliverable.priority} priority
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-2">{deliverable.title}</h3>
                  <p className="text-slate-300 text-sm mb-2 capitalize">{deliverable.category.replace('_', ' ')}</p>
                  {deliverable.description && (
                    <p className="text-slate-200 mb-3">{deliverable.description}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {deliverable.assigned_to_email && (
                  <div>
                    <div className="text-slate-300">Assigned To</div>
                    <div className="text-white">{deliverable.assigned_to_email}</div>
                  </div>
                )}
                {deliverable.due_date && (
                  <div>
                    <div className="text-slate-300">Due Date</div>
                    <div className="text-white">{new Date(deliverable.due_date).toLocaleDateString()}</div>
                  </div>
                )}
                {deliverable.completed_date && (
                  <div>
                    <div className="text-slate-300">Completed</div>
                    <div className="text-white">{new Date(deliverable.completed_date).toLocaleDateString()}</div>
                  </div>
                )}
                {deliverable.milestones && deliverable.milestones.length > 0 && (
                  <div>
                    <div className="text-slate-300">Milestones</div>
                    <div className="text-white">{deliverable.milestones.length} milestone(s)</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredDeliverables.length === 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <p className="text-white text-lg mb-4">No deliverables found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg"
            >
              Create First Deliverable
            </button>
          </div>
        )}

        {showCreateModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" 
            onClick={() => {
              setShowCreateModal(false)
              setCreateError('')
              setFormData({
                deliverable_id: '',
                title: '',
                description: '',
                category: 'functional_requirements',
                priority: 'medium',
                status: 'planned',
                due_date: '',
                assigned_to_email: ''
              })
            }}
          >
            <div className="bg-slate-900 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-white mb-6">Create Deliverable</h2>
              
              {createError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white mb-2">Deliverable ID</label>
                    <input
                      type="text"
                      required
                      value={formData.deliverable_id}
                      onChange={(e) => setFormData({ ...formData, deliverable_id: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                      placeholder="DEL-001"
                    />
                  </div>
                  <div>
                    <label className="block text-white mb-2">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    >
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value} className="bg-slate-800">{cat.label}</option>
                      ))}
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
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-white mb-2">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    >
                      <option value="high" className="bg-slate-800">High</option>
                      <option value="medium" className="bg-slate-800">Medium</option>
                      <option value="low" className="bg-slate-800">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    >
                      <option value="planned" className="bg-slate-800">Planned</option>
                      <option value="in_progress" className="bg-slate-800">In Progress</option>
                      <option value="review" className="bg-slate-800">Review</option>
                      <option value="completed" className="bg-slate-800">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white mb-2">Due Date</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-white mb-2">Assigned To (Email)</label>
                  <input
                    type="email"
                    value={formData.assigned_to_email}
                    onChange={(e) => setFormData({ ...formData, assigned_to_email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowCreateModal(false)
                      setCreateError('')
                      setFormData({
                        deliverable_id: '',
                        title: '',
                        description: '',
                        category: 'functional_requirements',
                        priority: 'medium',
                        status: 'planned',
                        due_date: '',
                        assigned_to_email: ''
                      })
                    }} 
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                    disabled={createLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={createLoading}
                  >
                    {createLoading ? 'Creating...' : 'Create'}
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

