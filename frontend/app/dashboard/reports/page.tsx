'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Download, RefreshCw, Calendar, TrendingUp, Phone, Clock, Users, DollarSign } from 'lucide-react'
import { get } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'

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
}

interface DailyVolume {
  date: string
  call_count: number
  total_duration: number
}

export default function ReportsPage() {
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
    fetchData()
  }, [router, dateRange])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date
      }).toString()

      // Fetch dashboard analytics
      const dashboardResponse = await get(`/analytics/dashboard?${queryParams}`)
      if (dashboardResponse.data) {
        setCallStats(dashboardResponse.data.callStats)
        setAgentPerformance(dashboardResponse.data.agentPerformance || [])
        setDailyVolume(dashboardResponse.data.dailyVolume || [])
      }

    } catch (err: any) {
      console.error('Error fetching analytics:', err)
      setError(err.message || 'Failed to fetch analytics data')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m 0s'
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Prepare chart data
  const volumeChartData = dailyVolume.map(d => ({
    date: formatChartDate(d.date),
    calls: d.call_count,
    duration: Math.round((d.total_duration || 0) / 60) // Convert to minutes
  }))

  const agentChartData = agentPerformance.map(a => ({
    name: a.name.split(' ')[0], // First name only for chart
    calls: a.total_calls,
    completed: a.completed_calls,
    avgDuration: Math.round(a.avg_duration || 0)
  }))

  const pieData = [
    { name: 'Completed', value: callStats?.completed_calls || 0 },
    { name: 'Failed', value: callStats?.failed_calls || 0 },
    { name: 'Other', value: Math.max(0, (callStats?.total_calls || 0) - (callStats?.completed_calls || 0) - (callStats?.failed_calls || 0)) }
  ].filter(d => d.value > 0)

  const COLORS = ['#10b981', '#ef4444', '#6366f1', '#f59e0b']

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-white">Loading reports...</p>
        </div>
      </div>
    )
  }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="container mx-auto px-6 py-6 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center space-x-3">
                    <span className="text-xl font-semibold">Reports & Analytics</span>
                </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
                <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm flex items-center gap-1 transition-colors">
                    <ChevronLeft size={16} /> Dashboard
                </Link>
        </div>
            </header>

            <main className="container mx-auto px-6 py-8">
        {/* Date Range Filter */}
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-400" />
            <span className="text-sm text-slate-400">Date Range:</span>
          </div>
          <input
            type="date"
            value={dateRange.start_date}
            onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={dateRange.end_date}
            onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <Phone size={24} className="text-teal-400" />
              <TrendingUp size={16} className="text-green-400" />
            </div>
            <p className="text-3xl font-bold">{callStats?.total_calls || 0}</p>
            <p className="text-sm text-slate-400">Total Calls</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <Clock size={24} className="text-purple-400" />
            </div>
            <p className="text-3xl font-bold">{formatDuration(callStats?.avg_duration || 0)}</p>
            <p className="text-sm text-slate-400">Avg Duration</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <Users size={24} className="text-blue-400" />
            </div>
            <p className="text-3xl font-bold">{callStats?.completed_calls || 0}</p>
            <p className="text-sm text-slate-400">Completed Calls</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={24} className="text-green-400" />
            </div>
            <p className="text-3xl font-bold">
              {callStats?.total_calls ? Math.round((callStats.completed_calls / callStats.total_calls) * 100) : 0}%
            </p>
            <p className="text-sm text-slate-400">Success Rate</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Call Volume Over Time */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold mb-4 text-teal-400 flex items-center gap-2">
              <TrendingUp size={20} />
              Call Volume Over Time
            </h3>
            <div className="h-64">
              {volumeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeChartData}>
                    <defs>
                      <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calls" 
                      stroke="#14b8a6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCalls)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Phone size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No call data for this period</p>
                  </div>
                </div>
              )}
                        </div>
                    </div>

          {/* Call Status Distribution */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold mb-4 text-purple-400 flex items-center gap-2">
              <Users size={20} />
              Call Status Distribution
            </h3>
            <div className="h-64">
              {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Users size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No call data for this period</p>
                  </div>
                </div>
              )}
            </div>
                        </div>
                    </div>

        {/* Agent Performance */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-8">
          <h3 className="text-lg font-semibold mb-4 text-blue-400 flex items-center gap-2">
            <Users size={20} />
            Agent Performance
          </h3>
          <div className="h-72">
            {agentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="calls" name="Total Calls" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Users size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No agent performance data</p>
                  <p className="text-sm mt-1">Agents will appear here after handling calls</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Agent Table */}
        {agentPerformance.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold mb-4 text-slate-300">Detailed Agent Metrics</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Agent</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Type</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Total Calls</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Completed</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Success Rate</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerformance.map((agent) => (
                    <tr key={agent.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 font-medium">{agent.name}</td>
                      <td className="py-3 px-4 text-slate-400 capitalize">{agent.type}</td>
                      <td className="py-3 px-4 text-right">{agent.total_calls}</td>
                      <td className="py-3 px-4 text-right text-green-400">{agent.completed_calls}</td>
                      <td className="py-3 px-4 text-right">
                        {agent.total_calls ? Math.round((agent.completed_calls / agent.total_calls) * 100) : 0}%
                      </td>
                      <td className="py-3 px-4 text-right">{formatDuration(agent.avg_duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Link to full analytics */}
        <div className="mt-8 text-center">
          <Link 
            href="/analytics"
            className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm"
          >
            View Full Analytics Dashboard →
          </Link>
        </div>
      </main>
        </div>
    )
}
