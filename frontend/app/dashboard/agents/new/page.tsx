'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save } from 'lucide-react'
import { post } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function CreateAgentPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [formData, setFormData] = useState({
        name: '',
        type: 'Front Desk Assistant', // Default
        description: '',
        voice_model: 'openai'
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const response = await post('/agents', {
                name: formData.name,
                type: formData.type,
                description: formData.description,
                voice_model: formData.voice_model,
                is_active: true,
                configuration: {}, // Empty default config
                system_prompt: `You are a helpful ${formData.type}.` // Simple default prompt
            })

            if (response.error) {
                throw new Error(response.error)
            }

            // Redirect to the config page for the new agent
            if (response.data?.agent?.id) {
                router.push(`/dashboard/agents/${response.data.agent.id}`)
            } else {
                router.push('/dashboard')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create agent')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white">
            {/* Header */}
            <header className="container mx-auto px-6 py-6 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center space-x-3">
                    <span className="text-xl font-semibold">Create New Agent</span>
                </div>
                <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm flex items-center gap-1 transition-colors">
                    <ChevronLeft size={16} /> Dashboard
                </Link>
            </header>

            <main className="container mx-auto px-6 py-8">
                <div className="max-w-3xl mx-auto">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-white mb-2">Create New AI Agent</h1>
                        <p className="text-slate-400">Configure a new AI agent to handle calls, appointments, and inquiries for your organization.</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 shadow-xl">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-slate-300 text-sm mb-2">Agent Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                    placeholder="e.g. Main Receptionist"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm mb-2">Agent Role</label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                >
                                    <option value="Front Desk Assistant">Front Desk Assistant</option>
                                    <option value="Billing Specialist">Billing Specialist</option>
                                    <option value="Collections Specialist">Collections Specialist</option>
                                    <option value="Medical Assistant">Medical Assistant</option>
                                    <option value="Triage Nurse">Triage Nurse</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm mb-2">Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 resize-none transition-colors"
                                    placeholder="Briefly describe this agent's purpose..."
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm mb-2">Voice Model Provider</label>
                                <select
                                    name="voice_model"
                                    value={formData.voice_model}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                >
                                    <option value="openai">OpenAI (Realtime)</option>
                                    <option value="elliza">Elliza.ai</option>
                                    <option value="deepgram">Deepgram</option>
                                    <option value="elevenlabs">ElevenLabs</option>
                                </select>
                            </div>

                            <div className="pt-6 flex justify-end space-x-4 border-t border-white/10">
                                <Link
                                    href="/dashboard"
                                    className="px-6 py-2.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </Link>
                                <Button
                                    type="submit"
                                    loading={loading}
                                    className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-2.5 h-auto text-base"
                                >
                                    Create Agent
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    )
}
