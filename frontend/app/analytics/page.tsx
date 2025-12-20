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

interface AvgHandleTime {
  avg_handle_time_seconds: number
  avg_completed_handle_time_seconds: number
  total_calls: number
  completed_calls: number
  avg_handle_time_formatted: string
  avg_completed_handle_time_formatted: string
}

interface SchedulingSuccessRate {
  total_booking_attempts: number
  successful_bookings: number
  cancelled_bookings: number
  no_shows: number
  success_rate_percentage: number
  unique_days_with_bookings: number
}

interface CollectionsRecovered {
  total_recovered: number
  total_payments: number
  avg_payment_amount: number
  statements_paid: number
  completed_payments: number
  failed_payments: number
  total_overdue_before: number
  overdue_statements: number
  recovery_rate_percentage: number
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [callStats, setCallStats] = useState<CallStats | null>(null)
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([])
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([])
  const [avgHandleTime, setAvgHandleTime] = useState<AvgHandleTime | null>(null)
  const [schedulingSuccessRate, setSchedulingSuccessRate] = useState<SchedulingSuccessRate | null>(null)
  const [collectionsRecovered, setCollectionsRecovered] = useState<CollectionsRecovered | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartType, setChartType] = useState<'bar' | 'line' | 'combined'>('combined')
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    fetchAnalytics()

    // Set up polling if auto-refresh is enabled
    let intervalId: NodeJS.Timeout | null = null
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchAnalytics()
      }, refreshInterval * 1000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [router, dateRange, autoRefresh, refreshInterval])

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
        setAvgHandleTime(null)
        setSchedulingSuccessRate(null)
        setCollectionsRecovered(null)
        setAvgHandleTime(null)
        setSchedulingSuccessRate(null)
        setCollectionsRecovered(null)
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
        setAvgHandleTime(response.data.avg_handle_time || null)
        setSchedulingSuccessRate(response.data.scheduling_success_rate || null)
        setCollectionsRecovered(response.data.collections_recovered || null)
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

        {/* Date Range Selector and Auto-Refresh */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/20">
          <div className="flex gap-4 items-end flex-wrap">
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
            <div className="flex gap-2 items-end">
              <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span>Auto-refresh</span>
              </label>
              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm"
                >
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                  <option value={300}>5m</option>
                </select>
              )}
            </div>
            {autoRefresh && (
              <div className="flex items-center gap-2 text-teal-400 text-sm">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                <span>Live updates enabled</span>
              </div>
            )}
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

        {/* Advanced Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {avgHandleTime && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Average Handle Time</div>
              <div className="text-2xl font-bold text-white mb-1">{avgHandleTime.avg_handle_time_formatted}</div>
              <div className="text-slate-400 text-xs">Completed calls: {avgHandleTime.avg_completed_handle_time_formatted}</div>
              <div className="text-slate-400 text-xs mt-1">Total: {avgHandleTime.total_calls} calls</div>
            </div>
          )}
          {schedulingSuccessRate && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Scheduling Success Rate</div>
              <div className="text-2xl font-bold text-white mb-1">{schedulingSuccessRate.success_rate_percentage.toFixed(1)}%</div>
              <div className="text-slate-400 text-xs">Successful: {schedulingSuccessRate.successful_bookings} / {schedulingSuccessRate.total_booking_attempts}</div>
              <div className="text-slate-400 text-xs mt-1">Cancelled: {schedulingSuccessRate.cancelled_bookings} | No-shows: {schedulingSuccessRate.no_shows}</div>
            </div>
          )}
          {collectionsRecovered && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm mb-2">Collections Recovered</div>
              <div className="text-2xl font-bold text-white mb-1">{formatCurrency(collectionsRecovered.total_recovered)}</div>
              <div className="text-slate-400 text-xs">Recovery rate: {collectionsRecovered.recovery_rate_percentage.toFixed(1)}%</div>
              <div className="text-slate-400 text-xs mt-1">Payments: {collectionsRecovered.total_payments} | Statements: {collectionsRecovered.statements_paid}</div>
            </div>
          )}
        </div>

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

          {/* Daily Volume Chart - Line and Bar */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Daily Call Volume</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${
                    chartType === 'bar'
                      ? 'bg-teal-600/20 text-teal-300 border-teal-500'
                      : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20'
                  }`}
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${
                    chartType === 'line'
                      ? 'bg-teal-600/20 text-teal-300 border-teal-500'
                      : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20'
                  }`}
                >
                  Line
                </button>
                <button
                  onClick={() => setChartType('combined')}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${
                    chartType === 'combined'
                      ? 'bg-teal-600/20 text-teal-300 border-teal-500'
                      : 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/20'
                  }`}
                >
                  Combined
                </button>
              </div>
            </div>
            {dailyVolume.length > 0 ? (
              <>
                {/* Combined Line and Bar Chart */}
                <div className="mb-6 relative">
                  <svg viewBox="0 0 800 250" className="w-full h-64">
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map((y) => (
                      <line
                        key={y}
                        x1="50"
                        y1={50 + (y / 100) * 150}
                        x2="750"
                        y2={50 + (y / 100) * 150}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                      />
                    ))}
                    {/* Y-axis labels */}
                    {(() => {
                      const maxCalls = Math.max(...dailyVolume.map(d => d.call_count || 0), 1)
                      return [0, 25, 50, 75, 100].map((y) => (
                        <text
                          key={y}
                          x="45"
                          y={55 + (y / 100) * 150}
                          fill="rgba(255,255,255,0.5)"
                          fontSize="10"
                          textAnchor="end"
                        >
                          {Math.round((maxCalls * y) / 100)}
                        </text>
                      ))
                    })()}
                    {/* Bar Chart - Show if bar or combined */}
                    {(chartType === 'bar' || chartType === 'combined') && dailyVolume.slice(0, 30).reverse().map((day, index) => {
                      const maxCalls = Math.max(...dailyVolume.map(d => d.call_count || 0), 1)
                      const height = ((day.call_count || 0) / maxCalls) * 150
                      const x = 50 + (index / Math.min(dailyVolume.length, 30)) * 700
                      const width = 700 / Math.min(dailyVolume.length, 30) - 2
                      return (
                        <rect
                          key={index}
                          x={x}
                          y={200 - height}
                          width={width}
                          height={height}
                          fill={chartType === 'combined' ? "#14b8a6" : "#14b8a6"}
                          opacity={chartType === 'combined' ? 0.6 : 1}
                          className="hover:fill-teal-400 transition-colors cursor-pointer"
                        >
                          <title>{`${day.call_count} calls on ${new Date(day.date).toLocaleDateString()}`}</title>
                        </rect>
                      )
                    })}
                    {/* Line Chart - Show if line or combined */}
                    {(chartType === 'line' || chartType === 'combined') && (
                      <>
                        <polyline
                          points={dailyVolume.slice(0, 30).reverse().map((day, index) => {
                            const maxCalls = Math.max(...dailyVolume.map(d => d.call_count || 0), 1)
                            const height = ((day.call_count || 0) / maxCalls) * 150
                            const x = 50 + (index / Math.min(dailyVolume.length, 30)) * 700 + (700 / Math.min(dailyVolume.length, 30)) / 2
                            const y = 200 - height
                            return `${x},${y}`
                          }).join(' ')}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          className="cursor-pointer"
                        />
                        {/* Data points */}
                        {dailyVolume.slice(0, 30).reverse().map((day, index) => {
                          const maxCalls = Math.max(...dailyVolume.map(d => d.call_count || 0), 1)
                          const height = ((day.call_count || 0) / maxCalls) * 150
                          const x = 50 + (index / Math.min(dailyVolume.length, 30)) * 700 + (700 / Math.min(dailyVolume.length, 30)) / 2
                          const y = 200 - height
                          return (
                            <circle
                              key={index}
                              cx={x}
                              cy={y}
                              r="4"
                              fill="#3b82f6"
                              className="hover:r-6 transition-all cursor-pointer"
                            >
                              <title>{`${day.call_count} calls on ${new Date(day.date).toLocaleDateString()}`}</title>
                            </circle>
                          )
                        })}
                      </>
                    )}
                    {/* X-axis labels */}
                    {dailyVolume.slice(0, 30).reverse().filter((_, index) => index % 5 === 0).map((day, labelIndex) => {
                      const index = labelIndex * 5
                      const x = 50 + (index / Math.min(dailyVolume.length, 30)) * 700 + (700 / Math.min(dailyVolume.length, 30)) / 2
                      return (
                        <text
                          key={index}
                          x={x}
                          y="235"
                          fill="rgba(255,255,255,0.5)"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </text>
                      )
                    })}
                  </svg>
                </div>
                {/* List View with Drill-down */}
                <div className="space-y-2 max-h-48 overflow-y-auto border-t border-white/10 pt-4">
                  {dailyVolume.map((day, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        // Drill-down functionality - could open a modal or navigate to detailed view
                        alert(`Drill-down for ${new Date(day.date).toLocaleDateString()}: ${day.call_count} calls, ${formatDuration(day.total_duration)} total duration`)
                      }}
                    >
                      <div>
                        <div className="text-white font-medium text-sm">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-slate-300 text-xs">{formatDuration(day.total_duration)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">{day.call_count}</div>
                        <div className="text-slate-300 text-xs">calls</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-300">
                No call volume data available for the selected date range.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

