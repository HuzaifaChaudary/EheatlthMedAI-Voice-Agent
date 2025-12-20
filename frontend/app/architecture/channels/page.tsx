'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, Phone, MessageSquare, Smartphone, Speaker, Globe, 
  Tv, Watch, Settings, Check, X, Plus, Zap, Shield, Volume2
} from 'lucide-react'
import { get, post, put } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface Channel {
  id: string
  name: string
  type: 'phone' | 'web' | 'mobile' | 'smart_device' | 'sms'
  description: string
  icon: any
  status: 'active' | 'inactive' | 'coming_soon'
  features: string[]
  configuration: {
    label: string
    value: string
    editable: boolean
  }[]
}

const defaultChannels: Channel[] = [
  {
    id: 'phone',
    name: 'Phone (Voice Calls)',
    type: 'phone',
    description: 'Inbound and outbound voice calls via Twilio. Patients call your number and speak with AI agents.',
    icon: Phone,
    status: 'active',
    features: [
      'Inbound call handling',
      'Outbound calls',
      'Call recording',
      'Transcription',
      'IVR integration',
      'Call transfer to humans'
    ],
    configuration: [
      { label: 'Phone Number', value: '+1 (770) 343-4007', editable: false },
      { label: 'Provider', value: 'Twilio', editable: false },
      { label: 'Max Concurrent Calls', value: '10', editable: true },
      { label: 'Call Recording', value: 'Enabled', editable: true }
    ]
  },
  {
    id: 'web',
    name: 'Web Chat',
    type: 'web',
    description: 'Embedded chat widget for websites. Visitors can chat with AI agents directly on your website.',
    icon: MessageSquare,
    status: 'active',
    features: [
      'Embeddable widget',
      'Real-time messaging',
      'File attachments',
      'Typing indicators',
      'Chat history',
      'Custom branding'
    ],
    configuration: [
      { label: 'Widget Position', value: 'Bottom Right', editable: true },
      { label: 'Theme', value: 'Auto (Light/Dark)', editable: true },
      { label: 'Welcome Message', value: 'Hello! How can I help you today?', editable: true },
      { label: 'Offline Mode', value: 'Show Form', editable: true }
    ]
  },
  {
    id: 'mobile',
    name: 'Mobile Apps',
    type: 'mobile',
    description: 'Native iOS and Android SDKs for integrating AI agents into your mobile healthcare apps.',
    icon: Smartphone,
    status: 'active',
    features: [
      'iOS SDK (Swift)',
      'Android SDK (Kotlin)',
      'Flutter support',
      'Push notifications',
      'Voice input',
      'Offline caching'
    ],
    configuration: [
      { label: 'iOS Bundle ID', value: 'com.yourapp.ios', editable: true },
      { label: 'Android Package', value: 'com.yourapp.android', editable: true },
      { label: 'Push Notifications', value: 'Enabled', editable: true },
      { label: 'Biometric Auth', value: 'Enabled', editable: true }
    ]
  },
  {
    id: 'sms',
    name: 'SMS / Text Messages',
    type: 'sms',
    description: 'Two-way SMS messaging for appointment reminders, follow-ups, and simple interactions.',
    icon: MessageSquare,
    status: 'active',
    features: [
      'Appointment reminders',
      'Two-way messaging',
      'Opt-in/opt-out',
      'TCPA compliant',
      'Message templates',
      'Delivery tracking'
    ],
    configuration: [
      { label: 'SMS Number', value: '+1 (770) 343-4007', editable: false },
      { label: 'Provider', value: 'Twilio', editable: false },
      { label: 'Auto-Response', value: 'Enabled', editable: true },
      { label: 'Quiet Hours', value: '10 PM - 8 AM', editable: true }
    ]
  },
  {
    id: 'alexa',
    name: 'Amazon Alexa',
    type: 'smart_device',
    description: 'Voice-first experience for Alexa devices. Patients can interact with AI agents hands-free.',
    icon: Speaker,
    status: 'coming_soon',
    features: [
      'Alexa Skills Kit',
      'Voice commands',
      'HIPAA-eligible',
      'Account linking',
      'Proactive events',
      'Multi-modal (Echo Show)'
    ],
    configuration: [
      { label: 'Skill ID', value: 'Not configured', editable: true },
      { label: 'Invocation Name', value: 'my health assistant', editable: true },
      { label: 'Account Linking', value: 'Required', editable: false },
      { label: 'Certification', value: 'Pending', editable: false }
    ]
  },
  {
    id: 'google',
    name: 'Google Assistant',
    type: 'smart_device',
    description: 'Voice interactions via Google Assistant on phones, smart speakers, and displays.',
    icon: Volume2,
    status: 'coming_soon',
    features: [
      'Actions on Google',
      'Voice commands',
      'Smart displays',
      'Account linking',
      'Push notifications',
      'Routines support'
    ],
    configuration: [
      { label: 'Project ID', value: 'Not configured', editable: true },
      { label: 'Invocation', value: 'Talk to my health assistant', editable: true },
      { label: 'Account Linking', value: 'Required', editable: false },
      { label: 'Certification', value: 'Pending', editable: false }
    ]
  }
]

export default function ChannelsPage() {
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>(defaultChannels)
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    // In a real app, fetch channel configurations from API
    setLoading(false)
  }, [router])

  const getStatusBadge = (status: Channel['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            <Check size={12} /> Active
          </span>
        )
      case 'inactive':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            <X size={12} /> Inactive
          </span>
        )
      case 'coming_soon':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Zap size={12} /> Coming Soon
          </span>
        )
    }
  }

  const getChannelIcon = (channel: Channel) => {
    const IconComponent = channel.icon
    const colorClass = channel.status === 'active' 
      ? 'text-teal-400' 
      : channel.status === 'coming_soon' 
        ? 'text-yellow-400' 
        : 'text-slate-400'
    return <IconComponent size={28} className={colorClass} />
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
          <Globe size={28} className="text-teal-400" />
          <span className="text-xl font-semibold">Voice Channels</span>
        </div>
        <Link href="/architecture" className="text-white hover:text-slate-300 text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> Architecture
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-4">Multi-Channel Support</h1>
          <p className="text-slate-300 text-lg max-w-3xl">
            Connect with patients across multiple channels - phone, web, mobile apps, SMS, and smart devices. 
            All channels are HIPAA-compliant with consistent AI agent behavior.
          </p>
        </div>

        {/* Channel Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Phone size={24} className="text-teal-400 mb-2" />
            <p className="text-2xl font-bold">{channels.filter(c => c.status === 'active').length}</p>
            <p className="text-sm text-slate-400">Active Channels</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Smartphone size={24} className="text-blue-400 mb-2" />
            <p className="text-2xl font-bold">3</p>
            <p className="text-sm text-slate-400">Mobile Platforms</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Speaker size={24} className="text-purple-400 mb-2" />
            <p className="text-2xl font-bold">2</p>
            <p className="text-sm text-slate-400">Smart Devices</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Shield size={24} className="text-green-400 mb-2" />
            <p className="text-2xl font-bold">100%</p>
            <p className="text-sm text-slate-400">HIPAA Compliant</p>
          </div>
        </div>

        {/* SRS Requirement Note */}
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 mb-8">
          <p className="text-teal-300 text-sm">
            <strong>SRS Requirement:</strong> Multi-channel access (phone, web, mobile, smart devices) - 
            All channels must support HIPAA-compliant voice AI interactions with consistent agent behavior.
          </p>
        </div>

        {/* Channel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map(channel => (
            <div 
              key={channel.id}
              className={`bg-white/5 backdrop-blur-sm rounded-xl p-6 border transition-all ${
                channel.status === 'active' 
                  ? 'border-white/10 hover:border-teal-500/50' 
                  : 'border-white/5 opacity-75'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getChannelIcon(channel)}
                  <div>
                    <h3 className="font-bold">{channel.name}</h3>
                    <p className="text-xs text-slate-400 capitalize">{channel.type.replace('_', ' ')}</p>
                  </div>
                </div>
                {getStatusBadge(channel.status)}
              </div>

              {/* Description */}
              <p className="text-sm text-slate-300 mb-4">{channel.description}</p>

              {/* Features */}
              <div className="mb-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Features</p>
                <div className="flex flex-wrap gap-1">
                  {channel.features.slice(0, 3).map((feature, i) => (
                    <span 
                      key={i}
                      className="px-2 py-0.5 text-xs bg-white/5 rounded text-slate-300"
                    >
                      {feature}
                    </span>
                  ))}
                  {channel.features.length > 3 && (
                    <span className="px-2 py-0.5 text-xs bg-white/5 rounded text-slate-400">
                      +{channel.features.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Configuration Preview */}
              <div className="bg-slate-950/50 rounded-lg p-3 mb-4">
                {channel.configuration.slice(0, 2).map((config, i) => (
                  <div key={i} className="flex justify-between text-xs py-1">
                    <span className="text-slate-400">{config.label}</span>
                    <span className="text-slate-200">{config.value}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {channel.status === 'active' ? (
                  <>
                    <button 
                      onClick={() => {
                        setSelectedChannel(channel)
                        setShowConfigModal(true)
                      }}
                      className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Settings size={14} />
                      Configure
                    </button>
                    <Link 
                      href={channel.id === 'phone' ? '/telephony' : channel.id === 'web' ? '/webchat' : '#'}
                      className="px-3 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Open
                    </Link>
                  </>
                ) : (
                  <button 
                    disabled
                    className="flex-1 px-3 py-2 bg-white/5 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Architecture Diagram */}
        <div className="mt-12 bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-bold mb-4">Channel Architecture</h2>
          <div className="bg-slate-950 rounded-lg p-6">
            <pre className="text-sm text-slate-300 overflow-x-auto">
{`┌─────────────────────────────────────────────────────────────────┐
│                        PATIENT CHANNELS                          │
├─────────────────────────────────────────────────────────────────┤
│  📞 Phone    💬 Web Chat   📱 Mobile   📨 SMS   🔊 Smart Devices │
│   (Twilio)   (WebSocket)   (SDK)     (Twilio)  (Alexa/Google)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE AI & TELEPHONY LAYER                    │
├─────────────────────────────────────────────────────────────────┤
│  STT (Speech-to-Text)  →  NLU (Intent)  →  TTS (Text-to-Speech) │
│  Deepgram/Google          OpenAI/Anthropic     ElevenLabs       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI AGENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Front Desk │ Medical Assistant │ Triage Nurse │ Billing │ ...  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     INTEGRATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  EHR/EMR  │  Scheduling  │  Billing  │  CRM  │  HL7/FHIR        │
└─────────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/telephony"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Phone size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Telephony Dashboard</p>
              <p className="text-xs text-slate-400">Manage calls & SMS</p>
            </div>
          </Link>
          <Link 
            href="/webchat"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <MessageSquare size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Web Chat</p>
              <p className="text-xs text-slate-400">Test chat interface</p>
            </div>
          </Link>
          <Link 
            href="/architecture/sdks"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Smartphone size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Mobile SDKs</p>
              <p className="text-xs text-slate-400">iOS & Android integration</p>
            </div>
          </Link>
        </div>
      </main>

      {/* Configuration Modal */}
      {showConfigModal && selectedChannel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getChannelIcon(selectedChannel)}
                  <div>
                    <h3 className="text-lg font-bold">{selectedChannel.name}</h3>
                    <p className="text-xs text-slate-400">Channel Configuration</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowConfigModal(false)
                    setSelectedChannel(null)
                  }}
                  className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {selectedChannel.configuration.map((config, i) => (
                <div key={i}>
                  <label className="block text-sm text-slate-400 mb-1">{config.label}</label>
                  <input
                    type="text"
                    defaultValue={config.value}
                    disabled={!config.editable}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      config.editable 
                        ? 'bg-slate-800 border-white/10 text-white focus:border-teal-500 focus:outline-none' 
                        : 'bg-slate-900 border-white/5 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  setShowConfigModal(false)
                  setSelectedChannel(null)
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Save configuration
                  setShowConfigModal(false)
                  setSelectedChannel(null)
                }}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg font-medium transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

