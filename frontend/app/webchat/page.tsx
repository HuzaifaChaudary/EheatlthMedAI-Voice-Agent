'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ChatInterface from '@/components/ChatInterface'

export default function WebChatPage() {
  const [agentId, setAgentId] = useState<number | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
      const response = await fetch(`${apiUrl}/webchat/agents`)
      const data = await response.json()
      
      if (data.agents && data.agents.length > 0) {
        setAgents(data.agents)
        setAgentId(data.agents[0].id)
      }
    } catch (error) {
      console.error('Error fetching agents:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading agents...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-white text-xl font-semibold">Web Chat Interface</span>
        </div>
        <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
          ← Dashboard
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Web Chat Interface</h1>
          <p className="text-slate-300">Interact with AI voice agents through web chat</p>
        </div>

        {agents.length > 0 ? (
          <>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors mb-6">
              <label className="block text-sm font-medium text-white mb-2">
                Select AI Agent
              </label>
              <select
                value={agentId || ''}
                onChange={(e) => setAgentId(Number(e.target.value))}
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id} className="bg-slate-800">
                    {agent.name} ({agent.type})
                  </option>
                ))}
              </select>
              {agents.find(a => a.id === agentId)?.description && (
                <p className="mt-2 text-sm text-slate-300">
                  {agents.find(a => a.id === agentId)?.description}
                </p>
              )}
            </div>

            {agentId && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Chat with AI Assistant
                </h2>
                <ChatInterface agentId={agentId} />
              </div>
            )}
          </>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <p className="text-slate-300">No agents available. Please configure agents in the admin panel.</p>
          </div>
        )}
      </main>
    </div>
  )
}

