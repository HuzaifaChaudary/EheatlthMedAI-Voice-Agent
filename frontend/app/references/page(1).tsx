'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {  isAuthenticated  } from '@/lib/auth'
import { get, post } from '@/lib/api'

interface Reference {
  id: number
  code: string
  name: string
  type: string
  description: string
  authority: string
  version: string
  document_url: string
  stakeholder_relevance: string[]
  compliance_requirements: string
}

export default function ReferencesPage() {
  const router = useRouter()
  const [references, setReferences] = useState<Reference[]>([])
  const [filteredReferences, setFilteredReferences] = useState<Reference[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    fetchReferences()
  }, [router])

  useEffect(() => {
    filterReferences()
  }, [searchQuery, selectedType, references])

  const fetchReferences = async () => {
    try {
      const response = await get('/references')

      if (response.error) {
        console.error('Error fetching references:', response.error)
        return
      }

      if (response.data?.references) {
        setReferences(response.data.references)
        setFilteredReferences(response.data.references)
      }
    } catch (error) {
      console.error('Error fetching references:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterReferences = () => {
    let filtered = references

    if (selectedType !== 'all') {
      filtered = filtered.filter(r => r.type === selectedType)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.code.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.authority.toLowerCase().includes(query)
      )
    }

    setFilteredReferences(filtered)
  }

  const types = ['all', 'regulation', 'standard', 'protocol', 'template']
  const typeLabels: Record<string, string> = {
    all: 'All Types',
    regulation: 'Regulation',
    standard: 'Standard',
    protocol: 'Protocol',
    template: 'Template'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading references...</div>
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
          <span className="text-white text-xl font-semibold">Reference Standards</span>
        </div>
        <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
          ← Dashboard
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search references..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="md:w-48">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {types.map(type => (
                  <option key={type} value={type} className="bg-slate-800">
                    {typeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* References Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredReferences.map((ref) => (
            <div
              key={ref.id}
              onClick={() => setSelectedReference(ref)}
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 cursor-pointer transition-all hover:bg-white/20 ${
                selectedReference?.id === ref.id ? 'ring-2 ring-blue-400' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-bold text-lg">{ref.name}</h3>
                  <p className="text-teal-300 text-sm mt-1">{ref.code}</p>
                </div>
                <span className="px-2 py-1 bg-teal-600/50 text-white text-xs rounded">
                  {ref.type}
                </span>
              </div>
              <p className="text-slate-200 mb-3 line-clamp-2">{ref.description}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{ref.authority}</span>
                {ref.version && (
                  <span className="text-slate-300">v{ref.version}</span>
                )}
              </div>
              {ref.stakeholder_relevance && ref.stakeholder_relevance.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ref.stakeholder_relevance.map((stakeholder, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-purple-500/50 text-white text-xs rounded"
                    >
                      {stakeholder}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Reference Detail Modal */}
        {selectedReference && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedReference(null)}>
            <div className="bg-slate-900 rounded-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedReference.name}</h2>
                  <p className="text-teal-300">{selectedReference.code}</p>
                </div>
                <button
                  onClick={() => setSelectedReference(null)}
                  className="text-white hover:text-slate-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="px-3 py-1 bg-teal-600/50 text-white text-sm rounded mr-2">
                    {selectedReference.type}
                  </span>
                  <span className="text-slate-300 text-sm">
                    {selectedReference.authority} {selectedReference.version && `v${selectedReference.version}`}
                  </span>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2">Description</h3>
                  <p className="text-slate-200">{selectedReference.description}</p>
                </div>

                {selectedReference.compliance_requirements && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Compliance Requirements</h3>
                    <p className="text-slate-200 whitespace-pre-line">{selectedReference.compliance_requirements}</p>
                  </div>
                )}

                {selectedReference.document_url && (
                  <div>
                    <a
                      href={selectedReference.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Official Documentation
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

