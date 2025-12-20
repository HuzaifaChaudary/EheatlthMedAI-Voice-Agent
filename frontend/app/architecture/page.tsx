'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ArchitecturePage() {
  const router = useRouter()

  const layers = [
    {
      name: 'Presentation Layer',
      description: 'Portals, SDKs, and user interfaces',
      icon: '🖥️',
      routes: [
        { name: 'Portals', path: '/architecture/portals' },
        { name: 'SDKs', path: '/architecture/sdks' },
        { name: 'Voice Channels', path: '/architecture/channels' }
      ]
    },
    {
      name: 'Voice AI & Telephony',
      description: 'STT, NLU, TTS, consent, and call recording',
      icon: '🎤',
      routes: [
        { name: 'Voice AI Config', path: '/architecture/voice-ai' },
        { name: 'Consent Management', path: '/architecture/consent' },
        { name: 'Telephony', path: '/architecture/telephony' },
        { name: 'Call Recordings', path: '/architecture/recordings' },
        { name: 'SMS', path: '/architecture/sms' },
        { name: 'Voicemail', path: '/architecture/voicemail' }
      ]
    },
    {
      name: 'Integration Layer',
      description: 'APIs, webhooks, HL7/FHIR connectors',
      icon: '🔌',
      routes: [
        { name: 'HL7 Connectors', path: '/architecture/hl7' },
        { name: 'FHIR Connectors', path: '/architecture/fhir' },
        { name: 'EHR Systems', path: '/architecture/ehr' },
        { name: 'Webhooks', path: '/integrations' }
      ]
    },
    {
      name: 'Data & Security',
      description: 'Encryption, keys, RBAC, audit logs',
      icon: '🔒',
      routes: [
        { name: 'Encryption Keys', path: '/architecture/security' },
        { name: 'Access Policies', path: '/architecture/access-policies' },
        { name: 'Audit Logs', path: '/admin' }
      ]
    },
    {
      name: 'Analytics & Reporting',
      description: 'Reports, metrics, and insights',
      icon: '📊',
      routes: [
        { name: 'Analytics Dashboard', path: '/analytics' },
        { name: 'Report Templates', path: '/architecture/reports' },
        { name: 'Generated Reports', path: '/architecture/reports' }
      ]
    },
    {
      name: 'Appointments & Reminders',
      description: 'Appointment management and reminder configuration',
      icon: '📅',
      routes: [
        { name: 'Appointments', path: '/appointments' },
        { name: 'Reminder Configuration', path: '/architecture/reminders' }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="text-white text-xl font-semibold">System Architecture</span>
        </div>
        <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
          ← Dashboard
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">System Architecture Layers</h1>
          <p className="text-slate-300">Manage and configure all system components</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {layers.map((layer, idx) => (
            <div
              key={idx}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors"
            >
              <div className="text-4xl mb-4">{layer.icon}</div>
              <h2 className="text-2xl font-bold text-white mb-2">{layer.name}</h2>
              <p className="text-slate-300 text-sm mb-4">{layer.description}</p>
              <div className="space-y-2">
                {layer.routes.map((route, routeIdx) => (
                  <Link
                    key={routeIdx}
                    href={route.path}
                    className="block px-4 py-2 bg-teal-600/50 hover:bg-teal-600/70 text-white rounded-lg transition-colors text-sm"
                  >
                    {route.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

