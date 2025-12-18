'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { get } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface StakeholderType {
  id: number
  code: string
  name: string
  description: string
  reading_guidance: string
}

interface Guidance {
  id: number
  section: string
  title: string
  content: string
  priority: string
  estimated_time_minutes: number
  references: any[]
}

export default function GuidancePage() {
  const router = useRouter()
  const [stakeholderTypes, setStakeholderTypes] = useState<StakeholderType[]>([])
  const [selectedStakeholder, setSelectedStakeholder] = useState<string>('')
  const [guidance, setGuidance] = useState<Guidance[]>([])
  const [userContent, setUserContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guidanceLoading, setGuidanceLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const loadData = async () => {
      await fetchStakeholderTypes()
      await fetchUserContent()
    }
    loadData()
  }, [router])

  useEffect(() => {
    if (selectedStakeholder) {
      fetchGuidance(selectedStakeholder)
    }
  }, [selectedStakeholder])

  const fetchStakeholderTypes = async () => {
    try {
      const response = await get('/stakeholders/types')
      const types = response.data?.stakeholder_types || []
      setStakeholderTypes(types)
      // If no stakeholder is selected and we have types, select the first one
      if (!selectedStakeholder && types.length > 0) {
        setSelectedStakeholder(types[0].code)
      }
    } catch (error: any) {
      console.error('Error fetching stakeholder types:', error)
      setError(error?.message || 'Failed to load stakeholder types')
    }
  }

  const fetchUserContent = async () => {
    try {
      const response = await get('/stakeholders/me/content')
      setUserContent(response.data || {})
      // If user has assigned stakeholder types, use the first one
      if (response.data?.stakeholder_types && response.data.stakeholder_types.length > 0 && !selectedStakeholder) {
        setSelectedStakeholder(response.data.stakeholder_types[0])
      }
    } catch (error: any) {
      console.error('Error fetching user content:', error)
      // Don't set error here as it's optional - user might not have assigned types
    } finally {
      setLoading(false)
    }
  }

  const fetchGuidance = async (stakeholderCode: string) => {
    if (!stakeholderCode) {
      setGuidance([])
      return
    }

    setGuidanceLoading(true)
    try {
      const response = await get(`/stakeholders/${stakeholderCode}/guidance`)
      setGuidance(response.data?.guidance || [])
      setError(null)
    } catch (error: any) {
      console.error('Error fetching guidance:', error)
      setError(error?.message || 'Failed to load reading guidance')
      setGuidance([])
    } finally {
      setGuidanceLoading(false)
    }
  }

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/50 border-red-400',
    medium: 'bg-yellow-500/50 border-yellow-400',
    low: 'bg-green-500/50 border-green-400'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading guidance...</div>
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
          <span className="text-white text-xl font-semibold">Reading Guidance</span>
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

        {/* Stakeholder Selector */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
          <label className="block text-white font-semibold mb-3">Select Your Role</label>
          {stakeholderTypes.length === 0 ? (
            <p className="text-slate-300">No stakeholder types available. Please contact an administrator.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stakeholderTypes.map((stakeholder) => (
                <button
                  key={stakeholder.id}
                  onClick={() => setSelectedStakeholder(stakeholder.code)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedStakeholder === stakeholder.code
                      ? 'bg-teal-600/50 border-teal-500 text-white'
                      : 'bg-white/5 border-white/20 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold">{stakeholder.name}</div>
                  <div className="text-xs mt-1 opacity-75">{stakeholder.code}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Guidance List */}
        {guidanceLoading ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <div className="text-white text-lg">Loading guidance...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {guidance.map((item) => (
            <div
              key={item.id}
              className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 ${priorityColors[item.priority] || 'border-white/20'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-bold text-xl mb-1">{item.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="capitalize">{item.section}</span>
                    {item.estimated_time_minutes && (
                      <>
                        <span>•</span>
                        <span>{item.estimated_time_minutes} min read</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="capitalize">{item.priority || 'medium'} priority</span>
                  </div>
                </div>
              </div>
              <p className="text-slate-200 leading-relaxed mb-4">{item.content}</p>
              {item.references && Array.isArray(item.references) && item.references.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-2">Related References:</h4>
                  <div className="flex flex-wrap gap-2">
                    {item.references.map((ref: any, idx: number) => (
                      <span
                        key={ref.id || idx}
                        className="px-3 py-1 bg-purple-500/50 text-white text-sm rounded"
                      >
                        {ref.name || ref.code || 'Reference'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            ))}
          </div>
        )}

        {!guidanceLoading && guidance.length === 0 && selectedStakeholder && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <p className="text-white text-lg">No guidance available for this stakeholder type</p>
            <p className="text-slate-300 text-sm mt-2">Please select a different role or contact an administrator to add guidance content.</p>
          </div>
        )}

        {!guidanceLoading && !selectedStakeholder && stakeholderTypes.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20">
            <p className="text-white text-lg">Please select a role to view reading guidance</p>
          </div>
        )}
      </main>
    </div>
  )
}

