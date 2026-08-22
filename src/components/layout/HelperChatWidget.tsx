'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Send, X, ChevronUp, ChevronDown, Bot, Sparkles } from 'lucide-react'
import { cn, genId, sleep } from '@/lib/utils'
import { useTranslation } from '@/contexts/TranslationContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES = [
  "What is Scam Scanner?",
  "How does Fake Call work?",
  "How do I add a Family member?",
  "What happens when I tap SOS?"
]

function getCannedResponse(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('scam scanner') || msg.includes('scan')) {
    return "The **Scam Scanner** (/app/scam-scanner) helps analyze suspicious SMS texts, WhatsApp messages, website links, or uploaded screenshots of messages. Our AI scans them for phishing signals and lets you know if they are safe or scams."
  }
  if (msg.includes('fake call') || msg.includes('incoming call') || msg.includes('women safety') || msg.includes('fake')) {
    return "The **Fake Incoming Call** feature is under **Women Safety** (/app/women-safety). It triggers a realistic fake call to help you exit uncomfortable situations safely. You can also share your **Journey Location** with trusted contacts."
  }
  if (msg.includes('family') || msg.includes('member')) {
    return "In the **Family Dashboard** (/app/family), you can add family members to check their digital safety scores, coordinate safety alerts, and manage child safety restrictions."
  }
  if (msg.includes('sos') || msg.includes('emergency') || msg.includes('danger')) {
    return "🚨 **EMERGENCY WARNING:** If you are in immediate danger or distress, tap the red floating **SOS button** on the bottom-right of your screen right now! It will share your coordinates and alert emergency contacts. You can also call **112 (Police)** or **181 (Women Helpline)**."
  }
  return "I am **Saheli**, your CyberShield guide! I can help you with:\n- **Scam Scanner** (how to check texts/links)\n- **Women Safety** (fake calls, location sharing)\n- **Family Dashboard** (risk scores)\n- **Emergency SOS** (helplines & alerts)\n\nWhat would you like to ask?"
}

function renderMessageContent(content: string) {
  const parts = content.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-extrabold text-cyan-300">{part.slice(2, -2)}</strong>
    }
    // Simple line renderer for bullet points
    if (part.startsWith('- ')) {
      return (
        <li key={i} className="ml-4 list-disc text-slate-300 my-0.5">
          {part.slice(2)}
        </li>
      )
    }
    return <span key={i} className="whitespace-pre-line">{part}</span>
  })
}

export default function HelperChatWidget() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I am **Saheli**, your CyberShield guide. How can I help protect you and your family today?"
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatPanelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Handle outside click to dismiss tooltip
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (tooltipVisible) {
        setTooltipVisible(false)
        localStorage.setItem('cyber_chat_tooltip_dismissed', String(Date.now()))
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [tooltipVisible])

  // Handle tooltip display delay & dismissal logic
  useEffect(() => {
    const dismissedTime = localStorage.getItem('cyber_chat_tooltip_dismissed')
    const now = Date.now()
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000

    if (dismissedTime && (now - Number(dismissedTime) < threeDaysMs)) {
      return
    }

    const timer = setTimeout(() => {
      setTooltipVisible(true)
      const dismissTimer = setTimeout(() => {
        setTooltipVisible(false)
      }, 8000)
      return () => clearTimeout(dismissTimer)
    }, 4000)

    return () => clearTimeout(timer)
  }, [])

  // Keyboard close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when chat panel expands
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const toggleChat = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setIsOpen(!isOpen)
    if (tooltipVisible) {
      setTooltipVisible(false)
      localStorage.setItem('cyber_chat_tooltip_dismissed', String(Date.now()))
    }
  }

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = {
      id: genId(),
      role: 'user',
      content: text
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    try {
      const response = await fetch('/api/helper-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...conversationHistory, { role: 'user', content: text }]
        })
      })

      if (!response.ok || !response.body) {
        throw new Error('API call failed')
      }

      setIsLoading(false)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let streamedContent = ''

      const assistantMsgId = genId()
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }])

      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        const chunk = decoder.decode(value)
        streamedContent += chunk

        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (updated[lastIdx]?.id === assistantMsgId) {
            updated[lastIdx].content = streamedContent
          }
          return updated
        })
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        id: genId(), 
        role: 'assistant', 
        content: "⚠️ Saheli couldn't respond right now. Please try again." 
      }])
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(input)
    }
  }

  return (
    <>
      {/* CSS Animations definitions */}
      <style jsx global>{`
        @keyframes float-loop {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes arm-wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(20deg); }
        }
        .animate-mascot-float {
          animation: float-loop 3s ease-in-out infinite;
        }
        .animate-mascot-wave {
          animation: arm-wave 1.8s ease-in-out infinite;
          transform-origin: 20px 58px;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-mascot-float,
          .animate-mascot-wave {
            animation: none !important;
          }
        }
      `}</style>

      {/* Floating Launcher Block (Bottom-Right, stacked above SOS) */}
      <div 
        className={cn(
          "fixed bottom-[104px] right-[28px] z-40 flex flex-row-reverse items-end gap-3 transition-all duration-300",
          isOpen && "hidden"
        )}
      >
        {/* Mascot + Toggle Trigger */}
        <div className="relative select-none group">
          {/* Circular Up-Chevron Toggle Button */}
          <button
            onClick={toggleChat}
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-tr from-pink-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 text-white flex items-center justify-center shadow-md border border-white/20 transition-transform hover:scale-110 z-10"
            aria-label={isOpen ? "Close Help Chat" : "Open Help Chat"}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {/* Mascot Robot SVG */}
          <div 
            onClick={toggleChat}
            className="animate-mascot-float hover:scale-105 transition-transform duration-300"
          >
            <svg 
              viewBox="0 0 100 100" 
              className="w-14 h-14 drop-shadow-[0_0_12px_rgba(6,182,212,0.45)] cursor-pointer"
            >
              {/* Antenna */}
              <line x1="50" y1="20" x2="50" y2="10" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />
              <circle cx="50" cy="8" r="4" fill="#ec4899" className="animate-pulse" />

              {/* Dome Head */}
              <path d="M25 45 C25 22, 75 22, 75 45 Z" fill="#09090b" stroke="#06b6d4" strokeWidth="3" />
              {/* Screen Visor */}
              <rect x="35" y="32" width="30" height="10" rx="3" fill="#18181b" stroke="#06b6d4" strokeWidth="1.5" />
              <ellipse cx="43" cy="37" rx="3" ry="1.5" fill="#06b6d4" />
              <ellipse cx="57" cy="37" rx="3" ry="1.5" fill="#06b6d4" />

              {/* Round Torso */}
              <rect x="30" y="52" width="40" height="35" rx="15" fill="#09090b" stroke="#06b6d4" strokeWidth="3" />
              {/* Status dot panel */}
              <rect x="38" y="60" width="24" height="12" rx="4" fill="#18181b" stroke="#06b6d4" strokeWidth="1" />
              <circle cx="44" cy="66" r="2" fill="#22c55e" />
              <circle cx="50" cy="66" r="2" fill="#06b6d4" />
              <circle cx="56" cy="66" r="2" fill="#ec4899" />

              {/* Left Arm (Waving) */}
              <path d="M25 58 Q12 50, 10 40" fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" className="animate-mascot-wave" />
              {/* Right Arm (Down) */}
              <path d="M75 58 Q85 68, 88 78" fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Tooltip Promo Popover */}
        {tooltipVisible && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-cyan-950/90 border border-cyan-800/40 text-cyan-200 text-xs px-4 py-2.5 rounded-xl shadow-xl shadow-cyan-950/50 whitespace-nowrap animate-in fade-in slide-in-from-right-4 duration-300 flex items-center gap-2 max-w-[280px]"
          >
            <Sparkles size={14} className="text-pink-400 shrink-0" />
            <span>Know about all our safety tools &rarr;</span>
          </div>
        )}
      </div>

      {/* Expanded Chat Dialog Panel (Bottom-Right, stacked above SOS) */}
      {isOpen && (
        <div 
          ref={chatPanelRef}
          role="dialog"
          aria-label="Saheli AI Assistant"
          className={cn(
            "fixed z-45 flex flex-col glass-dark border border-white/10 shadow-2xl transition-all duration-300",
            "bottom-[104px] right-6 w-[380px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-9rem)] rounded-3xl"
          )}
        >
          {/* Header Block */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              {/* Tiny Robot Avatar */}
              <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                  Saheli
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">CyberShield Guide & AI Assistant</p>
              </div>
            </div>
            <button 
              onClick={toggleChat}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              aria-label="Close Chat Panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat History Messages list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant'
              return (
                <div 
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    isAssistant ? "mr-auto" : "ml-auto flex-row-reverse"
                  )}
                >
                  {isAssistant && (
                    <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400 text-xs">
                      <Bot size={14} />
                    </div>
                  )}
                  <div 
                    className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      isAssistant 
                        ? "bg-white/5 border border-white/5 text-slate-200 rounded-tl-none" 
                        : "bg-pink-600 text-white rounded-tr-none shadow-[0_2px_10px_rgba(219,39,119,0.15)]"
                    )}
                  >
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              )
            })}

            {/* Typing Loader Indicator */}
            {isLoading && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400 text-xs">
                  <Bot size={14} />
                </div>
                <div className="bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reply Chips - only shows when there is no user messages besides initial hello */}
          {messages.length === 1 && !isLoading && (
            <div className="px-5 py-2.5 flex flex-wrap gap-2 border-t border-white/5 bg-black/10">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply}
                  onClick={() => handleSendMessage(reply)}
                  className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white px-3 py-1.5 rounded-full transition-all text-left"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {/* Input Panel block */}
          <div className="p-4 border-t border-white/5 bg-black/40">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Saheli about CyberShield..."
                className="flex-1 bg-white/5 border border-white/10 focus:border-cyan-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSendMessage(input)}
                disabled={isLoading || !input.trim()}
                className={cn(
                  "p-2.5 rounded-xl flex items-center justify-center transition-all shrink-0",
                  input.trim() && !isLoading
                    ? "bg-gradient-to-tr from-pink-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 text-white shadow-md cursor-pointer"
                    : "bg-white/5 border border-white/10 text-slate-600 cursor-not-allowed"
                )}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
