'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { get } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface CallStats {
  total_calls: number
  completed_calls: number
  failed_calls: number
  total_duration: number
  avg_duration: number
  total_cost: number
}

interface AgentPerformance {
  id: number
  name: string
  type: string
  total_calls: number
  completed_calls: number
  avg_duration: number
  avg_cost: number
}

interface DailyVolume {
  date: string
  call_count: number
  total_duration: number
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [callStats, setCallStats] = useState<CallStats | null>(null)
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([])
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    fetchAnalytics()
  }, [router, dateRange])

  const fetchAnalytics = async () => {
    try {
      setError(null)
      const params = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date
      })

      const response = await get(`/analytics/dashboard?${params}`)

      if (response.error) {
        setError(response.error)
        console.error('Analytics API error:', response.error)
        // Set empty data on error
        setCallStats({
          total_calls: 0,
          completed_calls: 0,
          failed_calls: 0,
          total_duration: 0,
          avg_duration: 0,
          total_cost: 0
        })
        setAgentPerformance([])
        setDailyVolume([])
      } else if (response.data) {
        setCallStats(response.data.call_stats || {
          total_calls: 0,
          completed_calls: 0,
          failed_calls: 0,
          total_duration: 0,
          avg_duration: 0,
          total_cost: 0
        })
        setAgentPerformance(response.data.agent_performance || [])
        setDailyVolume(response.data.daily_volume || [])
      }
    } catch (error: any) {
      console.error('Error fetching analytics:', error)
      setError(error.message || 'Failed to load analytics data')
      // Set empty data on error
      setCallStats({
        total_calls: 0,
        completed_calls: 0,
        failed_calls: 0,
        total_duration: 0,
        avg_duration: 0,
        total_cost: 0
      })
      setAgentPerformance([])
      setDailyVolume([])
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-white text-xl font-semibold">Analytics Dashboard</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-4 mb-6 border border-red-500/50">
            <div className="text-red-200 font-semibold mb-1">Error Loading Analytics</div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        )}

        {/* Date Range Selector */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/20">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-white text-sm mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                className="px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
              />
            </div>
            <div>
              <label className="block text-white text-sm mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                className="px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white"
              />
            </div>
          </div>
        </div>

        {/* Call Statistics Cards */}
        {callStats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Total Calls</div>
              <div className="text-3xl font-bold text-white">{callStats.total_calls || 0}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Completed</div>
              <div className="text-3xl font-bold text-green-400">{callStats.completed_calls || 0}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Failed</div>
              <div className="text-3xl font-bold text-red-400">{callStats.failed_calls || 0}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Avg Duration</div>
              <div className="text-2xl font-bold text-white">{formatDuration(Math.round(callStats.avg_duration || 0))}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Total Duration</div>
              <div className="text-2xl font-bold text-white">{formatDuration(callStats.total_duration || 0)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Total Cost</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(callStats.total_cost || 0)}</div>
            </div>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center border border-white/20 mb-8">
            <p className="text-white text-lg">No analytics data available</p>
            <p className="text-slate-300 text-sm mt-2">Analytics data will appear here once calls are logged.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Agent Performance */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Agent Performance</h2>
            <div className="space-y-4">
              {agentPerformance.map((agent) => (
                <div key={agent.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{agent.name}</h3>
                      <p className="text-slate-300 text-sm">{agent.type}</p>
                    </div>
                    <span className="text-white font-bold">{agent.total_calls} calls</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                    <div>
                      <div className="text-slate-300">Completed</div>
                      <div className="text-white font-semibold">{agent.completed_calls}</div>
                    </div>
                    <div>
                      <div className="text-slate-300">Avg Duration</div>
                      <div className="text-white font-semibold">{formatDuration(Math.round(agent.avg_duration || 0))}</div>
                    </div>
                    <div>
                      <div className="text-slate-300">Avg Cost</div>
                      <div className="text-white font-semibold">{formatCurrency(agent.avg_cost || 0)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Volume Chart */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Daily Call Volume</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {dailyVolume.map((day, index) => (
                <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div>
                    <div className="text-white font-medium">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-slate-300 text-sm">{formatDuration(day.total_duration)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-lg">{day.call_count}</div>
                    <div className="text-slate-300 text-xs">calls</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

