'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatWidgetProps {
  agentId: number
  organizationId?: number
  apiUrl?: string
}

export default function ChatWidget({ 
  agentId, 
  organizationId,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Reset conversation when agent changes
    if (agentId) {
      setConversationId(null)
      setMessages([])
      setIsInitializing(false)
    }
  }, [agentId])

  useEffect(() => {
    if (isOpen && conversationId === null && agentId && !isInitializing) {
      console.log('Initializing conversation for agent:', agentId)
      initializeConversation()
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const initializeConversation = async () => {
    if (isInitializing || conversationId) return
    
    setIsInitializing(true)
    try {
      const response = await fetch(`${apiUrl}/webchat/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentId,
          organization_id: organizationId,
          metadata: { channel: 'web_chat' }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to create conversation:', errorData)
        throw new Error(errorData.message || 'Failed to create conversation')
      }

      const data = await response.json()
      console.log('Conversation created:', data)
      
      if (data.conversation_id) {
        setConversationId(data.conversation_id)
        
        // Add greeting message if provided
        if (data.greeting_message && messages.length === 0) {
          const greeting: Message = {
            role: 'assistant',
            content: data.greeting_message,
            timestamp: new Date().toISOString()
          }
          setMessages([greeting])
        } else {
          // Load existing messages if any
          loadConversation(data.conversation_id)
        }
      } else {
        console.error('No conversation_id in response:', data)
        throw new Error('Failed to get conversation ID from server')
      }
    } catch (error) {
      console.error('Error initializing conversation:', error)
      // Show error to user
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to initialize conversation. Please try again.'}`,
        timestamp: new Date().toISOString()
      }
      setMessages([errorMessage])
    } finally {
      setIsInitializing(false)
    }
  }

  const loadConversation = async (convId: number) => {
    try {
      const response = await fetch(`${apiUrl}/webchat/conversation/${convId}`)
      const data = await response.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || isLoading || !conversationId) return

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch(`${apiUrl}/webchat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: userMessage.content,
          agent_id: agentId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to send message:', errorData)
        throw new Error(errorData.message || 'Failed to send message')
      }

      const data = await response.json()
      console.log('Message response:', data)
      
      if (data.assistant_message) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.assistant_message,
          timestamp: data.timestamp || new Date().toISOString()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('No assistant message in response')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : 'Please try again.'}`,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-teal-600 hover:bg-teal-700 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 z-[9999]"
          aria-label="Open chat"
          style={{ position: 'fixed' }}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-slate-800 rounded-lg shadow-2xl flex flex-col z-[9999] border border-white/20" style={{ position: 'fixed' }}>
          {/* Header */}
          <div className="bg-teal-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <div>
              <h3 className="font-semibold">AI Assistant</h3>
              <p className="text-xs text-teal-100">We're here to help</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close chat"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 py-8">
                <p>Start a conversation with our AI assistant</p>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-teal-600 text-white'
                      : 'bg-white/10 backdrop-blur-sm text-white border border-white/20'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-teal-100' : 'text-slate-400'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-lg px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-white/20 bg-slate-800 rounded-b-lg">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={conversationId ? "Type your message..." : (isInitializing ? "Initializing conversation..." : "Click to start conversation")}
                className="flex-1 px-4 py-2 bg-slate-900/50 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !conversationId || isInitializing}
                autoFocus={conversationId ? true : false}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading || !conversationId}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

