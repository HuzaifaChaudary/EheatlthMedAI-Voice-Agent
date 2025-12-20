'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, Mic, Volume2, Brain, Settings, Play, Save, 
  RefreshCw, Check, AlertTriangle, Sliders, Zap, Globe
} from 'lucide-react'
import { get, post, put } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface Agent {
  id: number
  name: string
  type: string
  voice_model: string
  is_active: boolean
}

interface STTConfig {
  id?: number
  provider: string
  model: string
  language_code: string
  sample_rate: number
  encoding: string
}

interface NLUConfig {
  id?: number
  provider: string
  model: string
  temperature: number
  max_tokens: number
}

interface TTSConfig {
  id?: number
  provider: string
  voice_id: string
  voice_name: string
  language_code: string
  speaking_rate: number
  pitch: number
  volume_gain_db: number
}

interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  labels: Record<string, string>
}

const sttProviders = [
  { id: 'deepgram', name: 'Deepgram', models: ['nova-2', 'nova', 'enhanced', 'base'] },
  { id: 'google', name: 'Google Cloud STT', models: ['latest_long', 'latest_short', 'phone_call'] },
  { id: 'assemblyai', name: 'AssemblyAI', models: ['best', 'nano'] }
]

const nluProviders = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] }
]

const ttsProviders = [
  { id: 'elevenlabs', name: 'ElevenLabs', description: 'High-quality neural voices' },
  { id: 'openai', name: 'OpenAI TTS', description: 'Fast and affordable' },
  { id: 'google', name: 'Google Cloud TTS', description: 'WaveNet voices' }
]

const languages = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)' }
]

export default function VoiceAIConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Agents
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  
  // Configurations
  const [sttConfig, setSttConfig] = useState<STTConfig>({
    provider: 'deepgram',
    model: 'nova-2',
    language_code: 'en-US',
    sample_rate: 16000,
    encoding: 'LINEAR16'
  })
  
  const [nluConfig, setNluConfig] = useState<NLUConfig>({
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    max_tokens: 1024
  })
  
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>({
    provider: 'elevenlabs',
    voice_id: '',
    voice_name: '',
    language_code: 'en-US',
    speaking_rate: 1.0,
    pitch: 0,
    volume_gain_db: 0
  })
  
  // ElevenLabs voices
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  
  // Test audio
  const [testText, setTestText] = useState('Hello! I am your AI healthcare assistant. How can I help you today?')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchAgents()
    fetchElevenLabsVoices()
  }, [router])

  useEffect(() => {
    if (selectedAgentId) {
      fetchAgentConfigs(selectedAgentId)
    }
  }, [selectedAgentId])

  const fetchAgents = async () => {
    try {
      const response = await get('/agents')
      if (response.data?.agents) {
        setAgents(response.data.agents)
        if (response.data.agents.length > 0) {
          setSelectedAgentId(response.data.agents[0].id)
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgentConfigs = async (agentId: number) => {
    try {
      const [sttRes, nluRes, ttsRes] = await Promise.all([
        get(`/voice-ai/stt/${agentId}`),
        get(`/voice-ai/nlu/${agentId}`),
        get(`/voice-ai/tts/${agentId}`)
      ])

      if (sttRes.data?.configurations?.[0]) {
        setSttConfig(sttRes.data.configurations[0])
      }
      if (nluRes.data?.configurations?.[0]) {
        setNluConfig(nluRes.data.configurations[0])
      }
      if (ttsRes.data?.configurations?.[0]) {
        setTtsConfig(ttsRes.data.configurations[0])
      }
    } catch (err) {
      console.error('Error fetching configs:', err)
    }
  }

  const fetchElevenLabsVoices = async () => {
    try {
      setVoicesLoading(true)
      const response = await get('/voice-ai/tts/elevenlabs/voices')
      if (response.data?.voices) {
        setElevenLabsVoices(response.data.voices)
      }
    } catch (err) {
      console.error('Error fetching voices:', err)
    } finally {
      setVoicesLoading(false)
    }
  }

  const handleSaveSTT = async () => {
    if (!selectedAgentId) return
    try {
      setSaving(true)
      await post('/voice-ai/stt', { ...sttConfig, agent_id: selectedAgentId })
      showMessage('success', 'STT configuration saved!')
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to save STT config')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNLU = async () => {
    if (!selectedAgentId) return
    try {
      setSaving(true)
      await post('/voice-ai/nlu', { ...nluConfig, agent_id: selectedAgentId })
      showMessage('success', 'NLU configuration saved!')
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to save NLU config')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTTS = async () => {
    if (!selectedAgentId) return
    try {
      setSaving(true)
      await post('/voice-ai/tts', { ...ttsConfig, agent_id: selectedAgentId })
      showMessage('success', 'TTS configuration saved!')
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to save TTS config')
    } finally {
      setSaving(false)
    }
  }

  const handleTestTTS = async () => {
    if (!testText.trim()) {
      showMessage('error', 'Please enter test text')
      return
    }
    try {
      setTesting(true)
      const response = await post('/voice-ai/tts/test', {
        text: testText,
        provider: ttsConfig.provider,
        voice_id: ttsConfig.voice_id,
        agent_id: selectedAgentId
      })
      
      if (response.data?.audio) {
        // Create audio URL from base64
        const audioBlob = new Blob(
          [Uint8Array.from(atob(response.data.audio), c => c.charCodeAt(0))],
          { type: 'audio/mpeg' }
        )
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        
        // Auto-play
        const audio = new Audio(url)
        audio.play()
        
        showMessage('success', 'TTS test successful!')
      }
    } catch (err: any) {
      showMessage('error', err.message || 'TTS test failed')
    } finally {
      setTesting(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center space-x-3">
          <Mic size={28} className="text-teal-400" />
          <span className="text-xl font-semibold">Voice AI Configuration</span>
        </div>
        <Link href="/architecture" className="text-white hover:text-slate-300 text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> Architecture
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Message */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            {message.text}
          </div>
        )}

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Voice AI Pipeline</h1>
          <p className="text-slate-300 text-lg max-w-3xl">
            Configure Speech-to-Text (STT), Natural Language Understanding (NLU), and Text-to-Speech (TTS) 
            for your AI voice agents. Each agent can have unique voice configurations.
          </p>
        </div>

        {/* Agent Selector */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-8">
          <label className="block text-sm text-slate-400 mb-2">Select Agent to Configure</label>
          <select
            value={selectedAgentId || ''}
            onChange={(e) => setSelectedAgentId(Number(e.target.value))}
            className="w-full md:w-1/2 bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
          >
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.type})
              </option>
            ))}
          </select>
        </div>

        {/* Pipeline Diagram */}
        <div className="bg-slate-950 rounded-xl p-6 border border-white/10 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 w-full md:w-48">
              <Mic size={32} className="mx-auto mb-2 text-blue-400" />
              <p className="font-bold">STT</p>
              <p className="text-xs text-slate-400">Speech → Text</p>
              <p className="text-xs text-teal-400 mt-1">{sttConfig.provider}</p>
            </div>
            <div className="text-2xl text-slate-600">→</div>
            <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 w-full md:w-48">
              <Brain size={32} className="mx-auto mb-2 text-purple-400" />
              <p className="font-bold">NLU</p>
              <p className="text-xs text-slate-400">Understanding</p>
              <p className="text-xs text-teal-400 mt-1">{nluConfig.provider}</p>
            </div>
            <div className="text-2xl text-slate-600">→</div>
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 w-full md:w-48">
              <Volume2 size={32} className="mx-auto mb-2 text-green-400" />
              <p className="font-bold">TTS</p>
              <p className="text-xs text-slate-400">Text → Speech</p>
              <p className="text-xs text-teal-400 mt-1">{ttsConfig.provider}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* STT Configuration */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <Mic size={24} className="text-blue-400" />
              <div>
                <h2 className="text-lg font-bold">Speech-to-Text (STT)</h2>
                <p className="text-xs text-slate-400">Convert patient speech to text</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Provider</label>
                <select
                  value={sttConfig.provider}
                  onChange={(e) => setSttConfig({ ...sttConfig, provider: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {sttProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Model</label>
                <select
                  value={sttConfig.model}
                  onChange={(e) => setSttConfig({ ...sttConfig, model: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {sttProviders.find(p => p.id === sttConfig.provider)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Language</label>
                <select
                  value={sttConfig.language_code}
                  onChange={(e) => setSttConfig({ ...sttConfig, language_code: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {languages.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Sample Rate</label>
                <select
                  value={sttConfig.sample_rate}
                  onChange={(e) => setSttConfig({ ...sttConfig, sample_rate: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  <option value={8000}>8000 Hz (Telephony)</option>
                  <option value={16000}>16000 Hz (Standard)</option>
                  <option value={44100}>44100 Hz (High Quality)</option>
                </select>
              </div>

              <button
                onClick={handleSaveSTT}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Save STT Config
              </button>
            </div>
          </div>

          {/* NLU Configuration */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <Brain size={24} className="text-purple-400" />
              <div>
                <h2 className="text-lg font-bold">NLU (Understanding)</h2>
                <p className="text-xs text-slate-400">AI language model for medical vocabulary</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Provider</label>
                <select
                  value={nluConfig.provider}
                  onChange={(e) => setNluConfig({ ...nluConfig, provider: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {nluProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Model</label>
                <select
                  value={nluConfig.model}
                  onChange={(e) => setNluConfig({ ...nluConfig, model: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {nluProviders.find(p => p.id === nluConfig.provider)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Temperature: {nluConfig.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={nluConfig.temperature}
                  onChange={(e) => setNluConfig({ ...nluConfig, temperature: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Focused</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={nluConfig.max_tokens}
                  onChange={(e) => setNluConfig({ ...nluConfig, max_tokens: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  min={256}
                  max={4096}
                />
              </div>

              <button
                onClick={handleSaveNLU}
                disabled={saving}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Save NLU Config
              </button>
            </div>
          </div>

          {/* TTS Configuration */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <Volume2 size={24} className="text-green-400" />
              <div>
                <h2 className="text-lg font-bold">Text-to-Speech (TTS)</h2>
                <p className="text-xs text-slate-400">Configurable voice output</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Provider</label>
                <select
                  value={ttsConfig.provider}
                  onChange={(e) => setTtsConfig({ ...ttsConfig, provider: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {ttsProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {ttsConfig.provider === 'elevenlabs' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Voice {voicesLoading && '(loading...)'}
                  </label>
                  <select
                    value={ttsConfig.voice_id}
                    onChange={(e) => {
                      const voice = elevenLabsVoices.find(v => v.voice_id === e.target.value)
                      setTtsConfig({ 
                        ...ttsConfig, 
                        voice_id: e.target.value,
                        voice_name: voice?.name || ''
                      })
                    }}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select a voice...</option>
                    {elevenLabsVoices.map(v => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name} ({v.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Speaking Rate: {ttsConfig.speaking_rate}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={ttsConfig.speaking_rate}
                  onChange={(e) => setTtsConfig({ ...ttsConfig, speaking_rate: Number(e.target.value) })}
                  className="w-full accent-green-500"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Pitch: {ttsConfig.pitch > 0 ? '+' : ''}{ttsConfig.pitch}
                </label>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={ttsConfig.pitch}
                  onChange={(e) => setTtsConfig({ ...ttsConfig, pitch: Number(e.target.value) })}
                  className="w-full accent-green-500"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Lower</span>
                  <span>Higher</span>
                </div>
              </div>

              <button
                onClick={handleSaveTTS}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Save TTS Config
              </button>
            </div>
          </div>
        </div>

        {/* TTS Test Section */}
        <div className="mt-8 bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <Play size={24} className="text-teal-400" />
            <h2 className="text-lg font-bold">Test Voice Output</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white resize-none"
                rows={3}
                placeholder="Enter text to synthesize..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleTestTTS}
                disabled={testing}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {testing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Test Voice
                  </>
                )}
              </button>
              {audioUrl && (
                <audio controls className="w-full" src={audioUrl}>
                  Your browser does not support audio.
                </audio>
              )}
            </div>
          </div>
        </div>

        {/* SRS Requirements Note */}
        <div className="mt-8 bg-teal-500/10 border border-teal-500/30 rounded-xl p-4">
          <h3 className="font-bold text-teal-300 mb-2">SRS Requirements Covered</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>✓ Natural Language Understanding (NLU) tuned for medical vocabulary</li>
            <li>✓ Text-to-speech with configurable voice actors</li>
            <li>✓ Call recording/transcription support</li>
            <li>✓ Multi-language support</li>
          </ul>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/architecture/consent"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Settings size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Consent Management</p>
              <p className="text-xs text-slate-400">Recording consent workflows</p>
            </div>
          </Link>
          <Link 
            href="/architecture/recordings"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Mic size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Call Recordings</p>
              <p className="text-xs text-slate-400">View and manage recordings</p>
            </div>
          </Link>
          <Link 
            href="/telephony"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Zap size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Telephony Dashboard</p>
              <p className="text-xs text-slate-400">Calls, SMS, Voicemail</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}

