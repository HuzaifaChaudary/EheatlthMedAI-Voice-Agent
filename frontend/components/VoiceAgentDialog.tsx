'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
  isPartial?: boolean
}

interface AgentConfig {
  id: number | null
  name: string
  type: string
  description: string
  greeting_message?: string
  default_prompt: string
}

interface VoiceAgentDialogProps {
  isOpen: boolean
  onClose: () => void
  agent: AgentConfig
}

// Available OpenAI Realtime voices
const VOICES = [
  { id: 'coral', label: 'Coral', desc: 'Clear & articulate' },
  { id: 'alloy', label: 'Alloy', desc: 'Neutral & balanced' },
  { id: 'ash', label: 'Ash', desc: 'Warm & confident' },
  { id: 'ballad', label: 'Ballad', desc: 'Soft & gentle' },
  { id: 'echo', label: 'Echo', desc: 'Resonant' },
  { id: 'sage', label: 'Sage', desc: 'Wise & measured' },
  { id: 'shimmer', label: 'Shimmer', desc: 'Bright & optimistic' },
  { id: 'verse', label: 'Verse', desc: 'Versatile' },
]

const API_URL = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://ehealthmedai-backend.onrender.com/api'
    : 'http://localhost:5000/api'
)

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

export default function VoiceAgentDialog({ isOpen, onClose, agent }: VoiceAgentDialogProps) {
  // Form state
  const [systemPrompt, setSystemPrompt] = useState(agent.default_prompt)
  const [voice, setVoice] = useState('coral')
  const [showPromptEditor, setShowPromptEditor] = useState(true)

  // Connection state
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Conversation state
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [partialAiText, setPartialAiText] = useState('')
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  // Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callStartRef = useRef<number>(0)

  // ────────────────────────────────────────────
  // Effects
  // ────────────────────────────────────────────

  // Reset state when dialog opens with a new agent
  useEffect(() => {
    if (isOpen) {
      setSystemPrompt(agent.default_prompt)
      setMessages([])
      setError(null)
      setStatus('idle')
      setPartialAiText('')
      setIsAiSpeaking(false)
      setIsUserSpeaking(false)
      setCallDuration(0)
      setShowPromptEditor(true)
    }
    return () => {
      // Cleanup on unmount
      if (!isOpen) disconnect()
    }
  }, [isOpen, agent.type])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partialAiText])

  // Update call duration timer
  useEffect(() => {
    if (status === 'connected') {
      callStartRef.current = Date.now()
      callTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000))
      }, 1000)
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
        callTimerRef.current = null
      }
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current)
    }
  }, [status])

  // ────────────────────────────────────────────
  // Connection Logic
  // ────────────────────────────────────────────

  const connect = async () => {
    try {
      setStatus('connecting')
      setError(null)
      setMessages([])
      setPartialAiText('')
      setShowPromptEditor(false)

      // Step 1: Get ephemeral token from our backend
      const tokenRes = await fetch(`${API_URL}/voice-ai/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: agent.type,
          systemPrompt,
          voice
        })
      })

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({ message: 'Failed to create session' }))
        throw new Error(err.message || `Server error: ${tokenRes.status}`)
      }

      const { ephemeralToken } = await tokenRes.json()
      if (!ephemeralToken) {
        throw new Error('No ephemeral token received. Check backend OpenAI configuration.')
      }

      // Step 2: Create WebRTC peer connection
      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

      // Step 3: Set up audio output (AI → speaker)
      const audioEl = new Audio()
      audioEl.autoplay = true
      audioElementRef.current = audioEl

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0]
      }

      // Step 4: Capture microphone (user → AI)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      mediaStreamRef.current = stream
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      // Step 5: Create data channel for control events
      const dc = pc.createDataChannel('oai-events')
      dataChannelRef.current = dc

      dc.onopen = () => {
        console.log('✅ OpenAI Realtime data channel opened')
        // Send session configuration
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemPrompt,
            voice: voice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }))
      }

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          handleRealtimeEvent(msg)
        } catch (e) {
          console.warn('Failed to parse realtime event:', e)
        }
      }

      dc.onerror = (event) => {
        console.error('Data channel error:', event)
      }

      // Step 6: Create SDP offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Step 7: Send offer to OpenAI Realtime API via HTTP (SDP exchange)
      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-realtime',
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            'Authorization': `Bearer ${ephemeralToken}`,
            'Content-Type': 'application/sdp'
          }
        }
      )

      if (!sdpRes.ok) {
        const errText = await sdpRes.text().catch(() => '')
        throw new Error(`WebRTC negotiation failed (${sdpRes.status}): ${errText}`)
      }

      // Step 8: Set remote description — WebRTC connection established!
      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      setStatus('connected')

      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState
        console.log('ICE state:', state)
        if (state === 'failed' || state === 'closed') {
          disconnect()
        }
      }

    } catch (err: any) {
      console.error('Voice connection error:', err)
      setError(err.message || 'Failed to connect')
      setStatus('error')
      cleanupConnection()
    }
  }

  const cleanupConnection = () => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null
      audioElementRef.current = null
    }
  }

  const disconnect = useCallback(() => {
    cleanupConnection()
    setStatus('idle')
    setIsAiSpeaking(false)
    setIsUserSpeaking(false)
    setPartialAiText('')
  }, [])

  const handleClose = () => {
    disconnect()
    onClose()
  }

  // ────────────────────────────────────────────
  // Realtime Event Handler
  // ────────────────────────────────────────────

  const handleRealtimeEvent = useCallback((event: any) => {
    switch (event.type) {

      // Session lifecycle
      case 'session.created':
      case 'session.updated':
        console.log(`📡 ${event.type}`)
        break

      // AI is generating audio + transcript
      case 'response.audio_transcript.delta':
        setIsAiSpeaking(true)
        setPartialAiText(prev => prev + (event.delta || ''))
        break

      case 'response.audio_transcript.done':
        if (event.transcript) {
          const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          setMessages(prev => [...prev, {
            id,
            role: 'assistant',
            text: event.transcript,
            timestamp: new Date()
          }])
        }
        setPartialAiText('')
        setIsAiSpeaking(false)
        break

      case 'response.done':
        setIsAiSpeaking(false)
        setPartialAiText('')
        break

      // User speech detection (VAD)
      case 'input_audio_buffer.speech_started':
        setIsUserSpeaking(true)
        break

      case 'input_audio_buffer.speech_stopped':
        setIsUserSpeaking(false)
        break

      // User speech transcription
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          setMessages(prev => [...prev, {
            id,
            role: 'user',
            text: event.transcript,
            timestamp: new Date()
          }])
        }
        setIsUserSpeaking(false)
        break

      // Errors
      case 'error':
        console.error('OpenAI Realtime error:', event.error)
        setError(event.error?.message || 'A voice processing error occurred')
        break

      default:
        // Log unhandled events in dev for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('Realtime event:', event.type)
        }
    }
  }, [])

  // ────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-green-400'
      case 'connecting': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      default: return 'text-slate-400'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Connected — speak naturally'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Connection error'
      default: return 'Ready to connect'
    }
  }

  const getAgentIcon = () => {
    switch (agent.type) {
      case 'front_desk':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        )
      case 'medical_assistant':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        )
      case 'triage_nurse':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )
    }
  }

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── Header ─────────────────────────── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400">
              {getAgentIcon()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
              <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status === 'connected' && (
              <span className="text-sm text-slate-400 font-mono">{formatDuration(callDuration)}</span>
            )}
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Prompt Editor (shown before connecting) */}
          {showPromptEditor && status !== 'connected' && (
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-slate-300 mb-1">{agent.description}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  System Prompt
                  <span className="text-slate-500 font-normal ml-2">— customize the AI&apos;s behavior</span>
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 resize-y font-mono leading-relaxed"
                  placeholder="Enter the system prompt for this AI agent..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Voice</label>
                <div className="grid grid-cols-4 gap-2">
                  {VOICES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setVoice(v.id)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        voice === v.id
                          ? 'bg-teal-500/30 border-teal-400/60 text-teal-300 border'
                          : 'bg-slate-800/60 border-slate-600/30 text-slate-400 border hover:border-slate-500/50 hover:text-slate-300'
                      }`}
                    >
                      <div className="font-medium">{v.label}</div>
                      <div className="text-xs opacity-70">{v.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Conversation Area (shown after connecting) */}
          {(status === 'connected' || (status === 'idle' && messages.length > 0)) && (
            <div className="p-5 space-y-3 min-h-[200px]">
              {messages.length === 0 && !partialAiText && (
                <div className="text-center py-8">
                  <div className="relative mx-auto w-16 h-16 mb-4">
                    <div className={`absolute inset-0 rounded-full ${isAiSpeaking ? 'bg-teal-500/30 animate-ping' : isUserSpeaking ? 'bg-blue-500/30 animate-ping' : 'bg-slate-700/30'}`} />
                    <div className={`relative w-16 h-16 rounded-full flex items-center justify-center ${isAiSpeaking ? 'bg-teal-500/20' : isUserSpeaking ? 'bg-blue-500/20' : 'bg-slate-700/40'}`}>
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm">Voice agent is listening. Start speaking...</p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-blue-600/30 border border-blue-500/30 text-blue-100'
                      : 'bg-slate-700/40 border border-slate-600/30 text-slate-200'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs mt-1 opacity-50">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {/* Partial AI response (streaming) */}
              {partialAiText && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-xl px-4 py-2.5 bg-slate-700/40 border border-teal-500/30 text-slate-200">
                    <p className="text-sm leading-relaxed">{partialAiText}<span className="animate-pulse">▋</span></p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Connecting spinner */}
          {status === 'connecting' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full border-2 border-teal-500/30 border-t-teal-400 animate-spin mb-4" />
              <p className="text-slate-400 text-sm">Connecting to voice agent...</p>
              <p className="text-slate-500 text-xs mt-1">Requesting microphone access</p>
            </div>
          )}

          {/* Error state with retry */}
          {status === 'error' && (
            <div className="p-5">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                <svg className="w-10 h-10 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-red-300 text-sm font-medium mb-1">Connection Failed</p>
                <p className="text-red-400/70 text-xs mb-3">{error}</p>
                <button
                  onClick={() => { setStatus('idle'); setShowPromptEditor(true); setError(null) }}
                  className="text-sm text-teal-400 hover:text-teal-300 underline"
                >
                  Back to settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Audio Indicators ────────────────── */}
        {status === 'connected' && (
          <div className="px-5 py-3 border-t border-slate-700/30 flex items-center gap-4">
            {/* User speaking indicator */}
            <div className={`flex items-center gap-2 text-sm ${isUserSpeaking ? 'text-blue-400' : 'text-slate-500'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isUserSpeaking ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>You</span>
              {isUserSpeaking && (
                <div className="flex gap-0.5">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="w-0.5 bg-blue-400 rounded-full animate-pulse"
                      style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* AI speaking indicator */}
            <div className={`flex items-center gap-2 text-sm ${isAiSpeaking ? 'text-teal-400' : 'text-slate-500'}`}>
              {isAiSpeaking && (
                <div className="flex gap-0.5">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="w-0.5 bg-teal-400 rounded-full animate-pulse"
                      style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              )}
              <span>AI</span>
              <div className={`w-2.5 h-2.5 rounded-full ${isAiSpeaking ? 'bg-teal-400 animate-pulse' : 'bg-slate-600'}`} />
            </div>
          </div>
        )}

        {/* ── Footer / Action Buttons ─────────── */}
        <div className="p-5 border-t border-slate-700/50 bg-slate-900/50">
          {status === 'idle' || status === 'error' ? (
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 px-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={connect}
                disabled={!systemPrompt.trim()}
                className="flex-1 py-3 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Connect Voice Agent
              </button>
            </div>
          ) : status === 'connecting' ? (
            <button
              onClick={() => { disconnect(); setShowPromptEditor(true) }}
              className="w-full py-3 px-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setShowPromptEditor(!showPromptEditor)}
                className="py-3 px-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Show/hide prompt"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={() => { disconnect(); setShowPromptEditor(true) }}
                className="flex-1 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L8.228 3.684A1 1 0 007.28 3H5z" />
                </svg>
                End Call
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
