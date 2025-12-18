'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {  isAuthenticated  } from '@/lib/auth'
import { get, post } from '@/lib/api'

interface SRSDocument {
  id: number
  document_id: string
  title: string
  section: string
  subsection: string
  version: string
  status: string
  content: string
}

const sections = [
  { value: 'overview', label: 'Overview' },
  { value: 'functional_requirements', label: 'Functional Requirements' },
  { value: 'external_interfaces', label: 'External Interfaces' },
  { value: 'nfrs', label: 'Non-Functional Requirements' },
  { value: 'data_models', label: 'Data Models' },
  { value: 'use_cases', label: 'Use Cases' },
  { value: 'acceptance_criteria', label: 'Acceptance Criteria' },
  { value: 'deployment_ops', label: 'Deployment & Operations' },
  { value: 'appendices', label: 'Appendices' }
]

export default function SRSPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<SRSDocument[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<SRSDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [selectedDoc, setSelectedDoc] = useState<SRSDocument | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)
  const [formData, setFormData] = useState({
    document_id: '',
    title: '',
    section: 'overview',
    subsection: '',
    content: '',
    version: '1.0'
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchDocuments()
  }, [router])

  useEffect(() => {
    filterDocuments()
  }, [selectedSection, documents])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await get('/srs/documents')
      
      if (response.error) {
        console.error('Error fetching documents:', response.error)
        setError(response.error)
        setDocuments([])
        setFilteredDocuments([])
        return
      }

      if (response.data?.documents) {
        setDocuments(response.data.documents)
        setFilteredDocuments(response.data.documents)
      } else {
        setDocuments([])
        setFilteredDocuments([])
      }
    } catch (error: any) {
      console.error('Error fetching documents:', error)
      setError(error.message || 'Failed to load SRS documents')
      setDocuments([])
      setFilteredDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const filterDocuments = () => {
    if (selectedSection === 'all') {
      setFilteredDocuments(documents)
    } else {
      setFilteredDocuments(documents.filter(d => d.section === selectedSection))
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess(false)
    setCreateLoading(true)
    
    try {
      const response = await post('/srs/documents', formData)
      
      if (response.error) {
        setCreateError(response.error || 'Failed to create document')
        console.error('Error creating document:', response.error)
        return
      }
      
      if (response.data?.document) {
        setCreateSuccess(true)
        setShowCreateModal(false)
        setFormData({ 
          document_id: '', 
          title: '', 
          section: 'overview', 
          subsection: '', 
          content: '', 
          version: '1.0' 
        })
        // Refresh the list
        await fetchDocuments()
        // Reset success message after a delay
        setTimeout(() => setCreateSuccess(false), 3000)
      } else {
        setCreateError('Invalid response from server')
      }
    } catch (error: any) {
      setCreateError(error.message || 'Error creating document')
      console.error('Error creating document:', error)
    } finally {
      setCreateLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/50',
    in_review: 'bg-yellow-500/50',
    approved: 'bg-green-500/50',
    published: 'bg-teal-600/50',
    deprecated: 'bg-red-500/50'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading SRS documents...</div>
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
          <span className="text-white text-xl font-semibold">SRS Documents</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
            ← Dashboard
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg"
          >
            + New Document
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-4 mb-6 border border-red-500/50">
            <div className="text-red-200 font-semibold mb-1">Error Loading SRS Documents</div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        )}

        {/* Section Filter */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <label className="block text-white font-semibold mb-3">Filter by Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full md:w-64 px-4 py-2 rounded-lg bg-slate-800/80 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            <option value="all" className="bg-slate-800 text-white">All Sections</option>
            {sections.map(section => (
              <option key={section.value} value={section.value} className="bg-slate-800 text-white">
                {section.label}
              </option>
            ))}
          </select>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 cursor-pointer transition-all hover:bg-white/20 ${
                selectedDoc?.id === doc.id ? 'ring-2 ring-blue-400' : 'border-white/20'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-teal-300 font-mono text-sm">{doc.document_id}</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold text-white capitalize ${statusColors[doc.status] || 'bg-gray-500/50'}`}>
                      {doc.status?.replace('_', ' ') || 'draft'}
                    </span>
                </div>
                <span className="text-slate-300 text-xs">v{doc.version}</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">{doc.title}</h3>
              <p className="text-slate-300 text-sm mb-2 capitalize">{doc.section}</p>
              <p className="text-slate-200 text-sm line-clamp-3">
                {doc.content && doc.content.length > 150 ? doc.content.substring(0, 150) + '...' : doc.content || 'No content'}
              </p>
            </div>
          ))}
        </div>

        {!loading && filteredDocuments.length === 0 && documents.length === 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-white text-lg mb-2">No SRS documents found</p>
            <p className="text-slate-300 text-sm mb-6">Start creating your Software Requirements Specification documents</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Create First Document
            </button>
          </div>
        )}

        {!loading && filteredDocuments.length === 0 && documents.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <p className="text-white text-lg mb-4">No documents found in this section</p>
            <button
              onClick={() => setSelectedSection('all')}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Show All Documents
            </button>
          </div>
        )}

        {/* Document Detail Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedDoc(null)}>
            <div className="bg-slate-900 rounded-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedDoc.title}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-teal-300 font-mono">{selectedDoc.document_id}</span>
                    <span className={`px-3 py-1 rounded text-sm font-semibold text-white capitalize ${statusColors[selectedDoc.status] || 'bg-gray-500/50'}`}>
                      {selectedDoc.status?.replace('_', ' ') || 'draft'}
                    </span>
                    <span className="text-slate-300">v{selectedDoc.version}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedDoc(null)} className="text-white hover:text-slate-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold mb-2">Section</h3>
                  <p className="text-slate-200 capitalize">{selectedDoc.section}</p>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-2">Content</h3>
                  <div className="text-slate-200 whitespace-pre-wrap bg-slate-950/50 p-4 rounded-lg">
                    {selectedDoc.content}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
            <div className="bg-slate-900 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-white mb-6">Create SRS Document</h2>
              
              {createError && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-4">
                  {createError}
                </div>
              )}
              
              {createSuccess && (
                <div className="bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg mb-4">
                  SRS document created successfully!
                </div>
              )}
              
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-white mb-2">Document ID</label>
                  <input
                    type="text"
                    required
                    value={formData.document_id}
                    onChange={(e) => setFormData({ ...formData, document_id: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    placeholder="SRS-001"
                  />
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white mb-2">Section</label>
                    <select
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    >
                      {sections.map(s => (
                        <option key={s.value} value={s.value} className="bg-slate-800">{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white mb-2">Version</label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-white mb-2">Subsection (Optional)</label>
                  <input
                    type="text"
                    value={formData.subsection}
                    onChange={(e) => setFormData({ ...formData, subsection: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Content</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={10}
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

