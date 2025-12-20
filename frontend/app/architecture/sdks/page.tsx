'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  ChevronLeft, Smartphone, Globe, Code, Package, Download, 
  Copy, Check, Terminal, BookOpen, Zap, Shield
} from 'lucide-react'

interface SDK {
  id: string
  name: string
  platform: string
  version: string
  description: string
  installCommand: string
  features: string[]
  documentation: string
  status: 'stable' | 'beta' | 'coming_soon'
}

const sdks: SDK[] = [
  {
    id: 'web',
    name: 'Web SDK',
    platform: 'JavaScript / TypeScript',
    version: '1.0.0',
    description: 'Embed AI voice agents directly into your web applications with real-time chat and voice capabilities.',
    installCommand: 'npm install @ehealthmedai/web-sdk',
    features: [
      'Real-time chat interface',
      'Voice-to-text input',
      'Text-to-speech output',
      'Customizable UI themes',
      'HIPAA-compliant data handling',
      'WebSocket for real-time updates'
    ],
    documentation: '/docs/web-sdk',
    status: 'stable'
  },
  {
    id: 'react',
    name: 'React SDK',
    platform: 'React 18+',
    version: '1.0.0',
    description: 'React components and hooks for seamless integration of AI agents into React applications.',
    installCommand: 'npm install @ehealthmedai/react-sdk',
    features: [
      '<ChatWidget /> component',
      'useAgent() hook',
      'useConversation() hook',
      'Context providers',
      'TypeScript support',
      'SSR compatible'
    ],
    documentation: '/docs/react-sdk',
    status: 'stable'
  },
  {
    id: 'ios',
    name: 'iOS SDK',
    platform: 'Swift / iOS 14+',
    version: '0.9.0',
    description: 'Native iOS SDK for building healthcare apps with AI voice agent capabilities.',
    installCommand: 'pod install EHealthMedAI',
    features: [
      'Native Swift API',
      'Voice recognition',
      'Push notifications',
      'Secure keychain storage',
      'HIPAA compliance built-in',
      'HealthKit integration'
    ],
    documentation: '/docs/ios-sdk',
    status: 'beta'
  },
  {
    id: 'android',
    name: 'Android SDK',
    platform: 'Kotlin / Android 8+',
    version: '0.9.0',
    description: 'Native Android SDK for integrating AI voice agents into Android healthcare applications.',
    installCommand: 'implementation "com.ehealthmedai:android-sdk:0.9.0"',
    features: [
      'Kotlin-first API',
      'Voice recognition',
      'Firebase Cloud Messaging',
      'Android Keystore',
      'HIPAA compliance',
      'Google Fit integration'
    ],
    documentation: '/docs/android-sdk',
    status: 'beta'
  },
  {
    id: 'flutter',
    name: 'Flutter SDK',
    platform: 'Dart / Flutter 3+',
    version: '0.8.0',
    description: 'Cross-platform Flutter package for iOS and Android with a single codebase.',
    installCommand: 'flutter pub add ehealthmedai_flutter',
    features: [
      'Cross-platform widgets',
      'Platform channels',
      'Stream-based API',
      'Material & Cupertino styles',
      'Null safety',
      'Hot reload support'
    ],
    documentation: '/docs/flutter-sdk',
    status: 'beta'
  },
  {
    id: 'python',
    name: 'Python SDK',
    platform: 'Python 3.8+',
    version: '1.0.0',
    description: 'Server-side Python SDK for backend integrations, automation, and data processing.',
    installCommand: 'pip install ehealthmedai',
    features: [
      'Async/await support',
      'Type hints',
      'Webhook handlers',
      'Batch processing',
      'Data export utilities',
      'CLI tools included'
    ],
    documentation: '/docs/python-sdk',
    status: 'stable'
  }
]

export default function SDKsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredSDKs = selectedPlatform === 'all' 
    ? sdks 
    : sdks.filter(sdk => sdk.id === selectedPlatform)

  const getStatusBadge = (status: SDK['status']) => {
    switch (status) {
      case 'stable':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Stable</span>
      case 'beta':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Beta</span>
      case 'coming_soon':
        return <span className="px-2 py-1 text-xs rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30">Coming Soon</span>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center space-x-3">
          <Package size={28} className="text-teal-400" />
          <span className="text-xl font-semibold">SDKs & Libraries</span>
        </div>
        <Link href="/architecture" className="text-white hover:text-slate-300 text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> Architecture
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-4">Developer SDKs</h1>
          <p className="text-slate-300 text-lg max-w-3xl">
            Integrate EHealth Med AI voice agents into your applications with our official SDKs. 
            All SDKs include HIPAA-compliant data handling and secure communication.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Code size={24} className="text-teal-400 mb-2" />
            <p className="text-2xl font-bold">{sdks.length}</p>
            <p className="text-sm text-slate-400">Official SDKs</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Smartphone size={24} className="text-blue-400 mb-2" />
            <p className="text-2xl font-bold">3</p>
            <p className="text-sm text-slate-400">Mobile Platforms</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Shield size={24} className="text-green-400 mb-2" />
            <p className="text-2xl font-bold">100%</p>
            <p className="text-sm text-slate-400">HIPAA Compliant</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Zap size={24} className="text-yellow-400 mb-2" />
            <p className="text-2xl font-bold">{"<"}100ms</p>
            <p className="text-sm text-slate-400">Avg Response</p>
          </div>
        </div>

        {/* Platform Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedPlatform('all')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              selectedPlatform === 'all' 
                ? 'bg-teal-600 text-white' 
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            All Platforms
          </button>
          {['web', 'react', 'ios', 'android', 'flutter', 'python'].map(platform => (
            <button
              key={platform}
              onClick={() => setSelectedPlatform(platform)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors capitalize ${
                selectedPlatform === platform 
                  ? 'bg-teal-600 text-white' 
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {platform}
            </button>
          ))}
        </div>

        {/* SDK Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSDKs.map(sdk => (
            <div 
              key={sdk.id}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-white/20 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-bold">{sdk.name}</h3>
                    {getStatusBadge(sdk.status)}
                  </div>
                  <p className="text-sm text-slate-400">{sdk.platform} • v{sdk.version}</p>
                </div>
                {sdk.id === 'web' || sdk.id === 'react' ? (
                  <Globe size={24} className="text-teal-400" />
                ) : sdk.id === 'ios' ? (
                  <Smartphone size={24} className="text-blue-400" />
                ) : sdk.id === 'android' ? (
                  <Smartphone size={24} className="text-green-400" />
                ) : sdk.id === 'flutter' ? (
                  <Smartphone size={24} className="text-cyan-400" />
                ) : (
                  <Terminal size={24} className="text-yellow-400" />
                )}
              </div>

              {/* Description */}
              <p className="text-slate-300 text-sm mb-4">{sdk.description}</p>

              {/* Install Command */}
              <div className="bg-slate-950 rounded-lg p-3 mb-4 flex items-center justify-between">
                <code className="text-teal-400 text-sm font-mono truncate flex-1">
                  {sdk.installCommand}
                </code>
                <button
                  onClick={() => copyToClipboard(sdk.installCommand, sdk.id)}
                  className="ml-3 p-2 hover:bg-white/10 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === sdk.id ? (
                    <Check size={16} className="text-green-400" />
                  ) : (
                    <Copy size={16} className="text-slate-400" />
                  )}
                </button>
              </div>

              {/* Features */}
              <div className="mb-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Features</p>
                <div className="flex flex-wrap gap-2">
                  {sdk.features.slice(0, 4).map((feature, i) => (
                    <span 
                      key={i}
                      className="px-2 py-1 text-xs bg-white/5 rounded text-slate-300"
                    >
                      {feature}
                    </span>
                  ))}
                  {sdk.features.length > 4 && (
                    <span className="px-2 py-1 text-xs bg-white/5 rounded text-slate-400">
                      +{sdk.features.length - 4} more
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-white/10">
                <button className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <Download size={16} />
                  Get Started
                </button>
                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  <BookOpen size={16} />
                  Docs
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Integration Example */}
        <div className="mt-12 bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-2xl font-bold mb-4">Quick Integration Example</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* React Example */}
            <div>
              <p className="text-sm text-slate-400 mb-2">React Integration</p>
              <pre className="bg-slate-950 rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-slate-300">{`import { ChatWidget } from '@ehealthmedai/react-sdk';

function App() {
  return (
    <ChatWidget 
      agentId="your-agent-id"
      theme="dark"
      position="bottom-right"
      onMessage={(msg) => console.log(msg)}
    />
  );
}`}</code>
              </pre>
            </div>

            {/* Python Example */}
            <div>
              <p className="text-sm text-slate-400 mb-2">Python Backend</p>
              <pre className="bg-slate-950 rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-slate-300">{`from ehealthmedai import Client

client = Client(api_key="your-api-key")

# Start a conversation
response = client.chat(
    agent_id="your-agent-id",
    message="I need to schedule an appointment"
)

print(response.text)`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Support Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/docs"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <BookOpen size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Documentation</p>
              <p className="text-xs text-slate-400">Full API reference</p>
            </div>
          </Link>
          <a 
            href="https://github.com/ehealthmedai"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Code size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">GitHub</p>
              <p className="text-xs text-slate-400">Open source examples</p>
            </div>
          </a>
          <Link 
            href="/support"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Zap size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Developer Support</p>
              <p className="text-xs text-slate-400">Get help from our team</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}

