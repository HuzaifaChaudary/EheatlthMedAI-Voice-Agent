'use client'

import Link from 'next/link'
import Logo from '@/components/Logo'

export default function Home() {

  const agentTypes = [
    'Front Desk',
    'Medical Assistant',
    'Triage Nurse Assistant'
  ]

  return (
    <>
      <style>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes vibrate {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translate(-2px, -2px) rotate(-1deg);
          }
          20%, 40%, 60%, 80% {
            transform: translate(2px, 2px) rotate(1deg);
          }
        }
        
        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(20, 184, 166, 0.4),
                        0 0 40px rgba(20, 184, 166, 0.3),
                        0 0 60px rgba(20, 184, 166, 0.2),
                        inset 0 0 20px rgba(20, 184, 166, 0.1);
          }
          50% {
            box-shadow: 0 0 30px rgba(20, 184, 166, 0.6),
                        0 0 60px rgba(20, 184, 166, 0.5),
                        0 0 90px rgba(20, 184, 166, 0.4),
                        inset 0 0 30px rgba(20, 184, 166, 0.2);
          }
        }
        
        @keyframes icon-glow {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))
                    drop-shadow(0 0 12px rgba(20, 184, 166, 0.8));
          }
          50% {
            filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.8))
                    drop-shadow(0 0 18px rgba(20, 184, 166, 1))
                    drop-shadow(0 0 24px rgba(20, 184, 166, 0.6));
          }
        }
        
        .call-icon-container {
          animation: spin-slow 8s linear infinite,
                     vibrate 0.3s ease-in-out infinite,
                     glow-pulse 2s ease-in-out infinite;
        }
        
        .call-icon-svg {
          animation: icon-glow 2s ease-in-out infinite;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Logo size="lg" showText={true} />
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-white text-sm">HIPAA Compliant</span>
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
          <Link
            href="/login"
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            LOGIN
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <div className="text-white space-y-6">
            <p className="text-teal-300 text-lg">Welcome To EHealth Med AI</p>
            <h1 className="text-5xl font-bold leading-tight">
              HIPAA-Compliant AI Voice Agents for Healthcare
            </h1>
            <p className="text-slate-200 text-lg leading-relaxed">
              Streamline patient interactions with intelligent voice assistants.
              From appointment booking to medical triage, our AI agents ensure
              compliance while improving patient care.
            </p>
            <div className="flex space-x-4 pt-4">
              <Link
                href="/signup"
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors inline-block"
              >
                Start Free Trial
              </Link>
              <Link
                href="/login"
                className="bg-white hover:bg-gray-100 text-gray-700 font-semibold px-8 py-3 rounded-lg transition-colors flex items-center space-x-2 inline-block"
              >
                <span>Login</span>
              </Link>
            </div>
          </div>

          {/* Right Side - Feature Card */}
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
            <div className="flex flex-col items-center space-y-6">
              {/* Icon Circle with Animations */}
              <div className="call-icon-container relative w-28 h-28 bg-gradient-to-br from-teal-500/40 via-teal-400/30 to-teal-600/40 rounded-full flex items-center justify-center border-2 border-teal-400/50">
                {/* Outer glow ring */}
                <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-xl"></div>
                {/* Inner glow ring */}
                <div className="absolute inset-2 rounded-full bg-teal-300/10 blur-md"></div>
                {/* Icon */}
                <svg
                  className="call-icon-svg relative z-10 w-14 h-14 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-white">
                AI Voice Agents Ready
              </h2>

              {/* Agent List */}
              <div className="w-full space-y-3">
                {agentTypes.map((agent, index) => (
                  <div
                    key={index}
                    className="bg-gray-200/20 hover:bg-gray-200/30 text-white font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer"
                  >
                    {agent}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </>
  )
}

