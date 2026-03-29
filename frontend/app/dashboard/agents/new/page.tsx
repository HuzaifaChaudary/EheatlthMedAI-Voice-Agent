'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Phone } from 'lucide-react'
import { post, get } from '@/lib/api'
import { Button } from '@/components/ui/Button'

interface PhoneNumber {
  id: number
  phone_number: string
  provider: string
  is_active: boolean
}

type AgentRole =
    | 'Front Desk Assistant'
    | 'Billing Specialist'
    | 'Collections Specialist'
    | 'Medical Assistant'
    | 'Triage Nurse'

const DEFAULT_ROLE: AgentRole = 'Front Desk Assistant'

const ROLE_TEMPLATES: Record<AgentRole, { description: string; systemPrompt: string }> = {
    'Front Desk Assistant': {
        description: 'Handles appointment scheduling, patient check-ins, and general inquiries.',
        systemPrompt: 'You are a professional front desk assistant for a medical practice. Help patients with appointment scheduling, general inquiries, and routing calls appropriately. Be warm, clear, and efficient. Ask concise follow-up questions only when needed.'
    },
    'Billing Specialist': {
        description: 'Manages billing inquiries, payments, and insurance-related questions.',
        systemPrompt: 'You are a billing specialist AI assistant for a medical practice. Help patients understand statements, discuss balances, and guide payment options. Be empathetic, professional, and privacy-conscious. Keep responses concise for voice conversations.'
    },
    'Collections Specialist': {
        description: 'Supports overdue balance resolution and payment arrangement discussions.',
        systemPrompt: 'You are a collections specialist AI assistant. Help patients resolve overdue balances with empathy and professionalism. Offer practical payment plan options, avoid threatening language, and maintain a respectful tone throughout the conversation.'
    },
    'Medical Assistant': {
        description: 'Assists with medication requests, lab result guidance, and pre-visit intake.',
        systemPrompt: 'You are a medical assistant AI for a healthcare practice. Help with medication refill requests, lab result explanations, and pre-visit intake workflows. Be clear, safe, and concise. Remind patients to consult their healthcare provider for medical advice.'
    },
    'Triage Nurse': {
        description: 'Performs symptom triage and urgency assessment to guide next steps.',
        systemPrompt: 'You are a triage nurse AI assistant. Assess symptoms, identify urgency, and guide patients to the appropriate level of care. For severe red-flag symptoms, direct patients to emergency care immediately. Keep responses brief and structured for voice.'
    }
}

const isAgentRole = (value: string): value is AgentRole => value in ROLE_TEMPLATES

export default function CreateAgentPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
    const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(true)

    const [formData, setFormData] = useState({
        name: '',
        type: DEFAULT_ROLE,
        description: ROLE_TEMPLATES[DEFAULT_ROLE].description,
        system_prompt: ROLE_TEMPLATES[DEFAULT_ROLE].systemPrompt,
        voice_model: 'openai',
        phone_number_id: '' as string | number
    })

    useEffect(() => {
        fetchPhoneNumbers()
    }, [])

    const fetchPhoneNumbers = async () => {
        try {
            setLoadingPhoneNumbers(true)
            const response = await get('/telephony/phone-numbers')
            if (response.data?.phone_numbers) {
                setPhoneNumbers(response.data.phone_numbers.filter((pn: PhoneNumber) => pn.is_active))
            }
        } catch (error) {
            console.error('Error fetching phone numbers:', error)
        } finally {
            setLoadingPhoneNumbers(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target

        if (name === 'type' && isAgentRole(value)) {
            setFormData(prev => ({
                ...prev,
                type: value,
                description: ROLE_TEMPLATES[value].description,
                system_prompt: ROLE_TEMPLATES[value].systemPrompt
            }))
            return
        }

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
                phone_number_id: formData.phone_number_id || null,
                is_active: true,
                configuration: {}, // Empty default config
                system_prompt: formData.system_prompt
            })

            if (response.error) {
                throw new Error(response.error)
            }

            // Redirect to the config page for the new agent
            if (response.data?.agent?.id) {
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('agent_config_flash_message', `Agent "${formData.name}" created successfully`)
                }
                router.push(`/dashboard/agents/${response.data.agent.id}`)
            } else {
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('dashboard_flash_message', `Agent "${formData.name}" created successfully`)
                }
                router.push('/dashboard')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create agent')
        } finally {
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
                                <p className="text-xs text-slate-400 mt-2">{formData.description}</p>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-slate-300 text-sm">System Prompt</label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, system_prompt: ROLE_TEMPLATES[prev.type as AgentRole].systemPrompt }))}
                                        className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                                    >
                                        Reset to role default
                                    </button>
                                </div>
                                <textarea
                                    name="system_prompt"
                                    value={formData.system_prompt}
                                    onChange={handleChange}
                                    rows={7}
                                    required
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 resize-none transition-colors"
                                    placeholder="Define the agent's behavior, tone, and goals..."
                                />
                                <p className="text-xs text-slate-400 mt-2">
                                    This prompt controls how the agent responds in voice and chat interactions.
                                </p>
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
                                    <option value="deepgram">Deepgram</option>
                                    <option value="elevenlabs">ElevenLabs</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm mb-2 flex items-center">
                                    <Phone size={16} className="mr-2 text-teal-400" />
                                    Link to Phone Number
                                </label>
                                <select
                                    name="phone_number_id"
                                    value={formData.phone_number_id}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                >
                                    <option value="">No phone number (link later)</option>
                                    {loadingPhoneNumbers ? (
                                        <option disabled>Loading phone numbers...</option>
                                    ) : phoneNumbers.length === 0 ? (
                                        <option disabled>No phone numbers available. Add one in Telephony page first.</option>
                                    ) : (
                                        phoneNumbers.map((pn) => (
                                            <option key={pn.id} value={pn.id}>
                                                {pn.phone_number} ({pn.provider})
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-slate-400 mt-2">
                                    Select which phone number this agent should handle. When calls come to this number, this agent will automatically answer.
                                </p>
                                {phoneNumbers.length === 0 && (
                                    <Link href="/telephony" className="text-xs text-teal-400 hover:text-teal-300 mt-1 block">
                                        Go to Telephony page to add a phone number →
                                    </Link>
                                )}
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
