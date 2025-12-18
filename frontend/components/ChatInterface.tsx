'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatInterfaceProps {
  agentId: number
  organizationId?: number
  apiUrl?: string
}

export default function ChatInterface({ 
  agentId, 
  organizationId,
  apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (agentId && conversationId === null && !isInitializing) {
      initializeConversation()
    }
  }, [agentId])

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
        if (data.greeting_message) {
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
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 flex flex-col h-[600px]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900/30">
        {isInitializing && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mx-auto mb-4"></div>
              <p className="text-slate-300">Initializing conversation...</p>
            </div>
          </div>
        )}

        {!isInitializing && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-slate-400">Start a conversation with the AI assistant</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-teal-600 text-white rounded-br-none'
                  : 'bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-bl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              <p className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-teal-100' : 'text-slate-400'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-lg rounded-bl-none px-4 py-3">
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

      {/* Input Area */}
      <div className="p-4 border-t border-white/20 bg-slate-800/50 rounded-b-xl">
        <form onSubmit={sendMessage} className="flex space-x-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={conversationId ? "Type your message..." : (isInitializing ? "Initializing..." : "Loading...")}
            className="flex-1 px-4 py-3 bg-slate-900/50 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !conversationId || isInitializing}
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading || !conversationId || isInitializing}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

