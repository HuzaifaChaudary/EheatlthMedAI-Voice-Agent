'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { get } from '@/lib/api'

interface Term {
  id: number
  term: string
  acronym: string | null
  definition: string
  category: string
  stakeholder_relevance: string[]
}

export default function GlossaryPage() {
  const router = useRouter()
  const [terms, setTerms] = useState<Term[]>([])
  const [filteredTerms, setFilteredTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    fetchTerms()
  }, [router])

  useEffect(() => {
    filterTerms()
  }, [searchQuery, selectedCategory, terms])

  const fetchTerms = async () => {
    try {
      const response = await get('/terminology')

      if (response.data?.terminology) {
        setTerms(response.data.terminology)
        setFilteredTerms(response.data.terminology)
      } else if (response.error) {
        console.error('Error fetching terms:', response.error)
      }
    } catch (error) {
      console.error('Error fetching terms:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterTerms = () => {
    let filtered = terms

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.term.toLowerCase().includes(query) ||
        (t.acronym && t.acronym.toLowerCase().includes(query)) ||
        t.definition.toLowerCase().includes(query)
      )
    }

    setFilteredTerms(filtered)
  }

  const categories = ['all', 'hipaa', 'technical', 'medical', 'legal', 'telephony']
  const categoryLabels: Record<string, string> = {
    all: 'All Categories',
    hipaa: 'HIPAA',
    technical: 'Technical',
    medical: 'Medical',
    legal: 'Legal',
    telephony: 'Telephony'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading glossary...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-white text-xl font-semibold">Terminology & Glossary</span>
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
                placeholder="Search terms, acronyms, or definitions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="md:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-slate-800">
                    {categoryLabels[cat]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Terms List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Terms List */}
          <div className="lg:col-span-2 space-y-4">
            {filteredTerms.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
                <p className="text-white text-lg">No terms found</p>
              </div>
            ) : (
              filteredTerms.map((term) => (
                <div
                  key={term.id}
                  onClick={() => setSelectedTerm(term)}
                  className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 cursor-pointer transition-all hover:bg-white/20 ${
                    selectedTerm?.id === term.id ? 'ring-2 ring-blue-400' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-white font-bold text-lg">
                        {term.term}
                        {term.acronym && (
                          <span className="text-teal-300 ml-2">({term.acronym})</span>
                        )}
                      </h3>
                      <span className="inline-block mt-2 px-2 py-1 bg-teal-600/50 text-white text-xs rounded">
                        {term.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-200 mt-3 line-clamp-2">{term.definition}</p>
                  {term.stakeholder_relevance && term.stakeholder_relevance.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {term.stakeholder_relevance.map((stakeholder, idx) => (
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
              ))
            )}
          </div>

          {/* Term Detail Sidebar */}
          <div className="lg:col-span-1">
            {selectedTerm ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 sticky top-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {selectedTerm.term}
                  {selectedTerm.acronym && (
                    <span className="text-teal-300 ml-2">({selectedTerm.acronym})</span>
                  )}
                </h2>
                <div className="mb-4">
                  <span className="px-3 py-1 bg-teal-600/50 text-white text-sm rounded">
                    {selectedTerm.category}
                  </span>
                </div>
                <div className="text-slate-200 leading-relaxed mb-4">
                  {selectedTerm.definition}
                </div>
                {selectedTerm.stakeholder_relevance && selectedTerm.stakeholder_relevance.length > 0 && (
                  <div>
                    <h4 className="text-white font-semibold mb-2">Relevant For:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTerm.stakeholder_relevance.map((stakeholder, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-purple-500/50 text-white text-xs rounded"
                        >
                          {stakeholder}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <p className="text-slate-300">Select a term to view details</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

