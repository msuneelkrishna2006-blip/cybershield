'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const PARTICLES = [
  { x: 30, y: 150, duration: 4.2, delay: 0.5 },
  { x: 90, y: 210, duration: 3.5, delay: 1.2 },
  { x: 150, y: 80, duration: 5.1, delay: 0.2 },
  { x: 210, y: 170, duration: 4.8, delay: 1.8 },
  { x: 60, y: 100, duration: 3.9, delay: 0.9 },
  { x: 180, y: 120, duration: 4.5, delay: 1.4 },
]

interface RobotAvatarProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'alert' | 'success'
}

export default function RobotAvatar({ state }: RobotAvatarProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [blink, setBlink] = useState(false)

  // Track mouse cursor relative to the screen center for head movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2)
      const y = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2)
      setMousePos({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Auto eye-blink timer
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 150)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Colors based on state
  const getGlowColor = () => {
    switch (state) {
      case 'listening': return 'rgba(34, 211, 238, 0.4)' // Cyan
      case 'thinking': return 'rgba(168, 85, 247, 0.4)' // Purple
      case 'speaking': return 'rgba(59, 130, 246, 0.4)' // Blue
      case 'alert': return 'rgba(239, 68, 68, 0.4)' // Red
      case 'success': return 'rgba(16, 185, 129, 0.4)' // Emerald
      default: return 'rgba(34, 211, 238, 0.2)' // Idle Cyan-tinted
    }
  }

  const getEyeColor = () => {
    switch (state) {
      case 'alert': return '#ef4444'
      case 'success': return '#10b981'
      case 'thinking': return '#c084fc'
      default: return '#22d3ee'
    }
  }

  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      {/* Holographic Glowing Base Rings */}
      <div 
        className="absolute inset-0 rounded-full border border-white/5 bg-gradient-to-b from-transparent to-cyan-500/5 blur-sm"
        style={{ boxShadow: `inset 0 0 30px ${getGlowColor()}, 0 0 30px ${getGlowColor()}` }}
      />
      
      {/* Outer Tech rings rotating */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute w-[95%] h-[95%] rounded-full border border-dashed border-cyan-500/10 pointer-events-none"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute w-[105%] h-[105%] rounded-full border border-cyan-500/5 pointer-events-none"
      />

      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
        {PARTICLES.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-400"
            initial={{ 
              x: p.x, 
              y: p.y, 
              opacity: 0.1 
            }}
            animate={{
              y: [240, -10],
              opacity: [0.1, 0.8, 0]
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: p.delay
            }}
          />
        ))}
      </div>

      {/* Main Robot Avatar SVG */}
      <motion.svg
        viewBox="0 0 200 200"
        className="w-48 h-48 z-10 select-none"
        animate={{
          y: state === 'idle' ? [0, -4, 0] : [0, -1, 0]
        }}
        transition={{
          duration: state === 'idle' ? 4 : 2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      >
        {/* Shadow glow under head */}
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={getEyeColor()} stopOpacity="0.4" />
            <stop offset="100%" stopColor={getEyeColor()} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="115" r="45" fill="url(#glow)" />

        {/* Head Neck */}
        <rect x="90" y="125" width="20" height="20" rx="5" fill="#131B2E" stroke="#1E293B" strokeWidth="2" />

        {/* Floating Head Group - rotates with mouse position */}
        <motion.g
          animate={{
            x: mousePos.x * 12,
            y: mousePos.y * 8,
            rotate: mousePos.x * 5
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 15 }}
        >
          {/* Futuristic Ear Sensors */}
          <rect x="35" y="65" width="10" height="30" rx="3" fill="#1E293B" stroke="#06b6d4" strokeWidth="1" />
          <rect x="155" y="65" width="10" height="30" rx="3" fill="#1E293B" stroke="#06b6d4" strokeWidth="1" />
          
          {/* Main Head Base */}
          <rect x="42" y="45" width="116" height="75" rx="24" fill="#0D1527" stroke={state === 'alert' ? '#ef4444' : '#0e7490'} strokeWidth="3" />
          
          {/* Visor Shadow */}
          <rect x="52" y="55" width="96" height="42" rx="12" fill="#040814" />

          {/* Left Eye */}
          <motion.ellipse
            cx="80"
            cy="76"
            rx="12"
            ry={blink ? 1 : 12}
            fill={getEyeColor()}
            animate={{
              scale: state === 'listening' ? [1, 1.15, 1] : 1
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity
            }}
            className="shadow-lg"
            style={{ filter: `drop-shadow(0 0 6px ${getEyeColor()})` }}
          />

          {/* Right Eye */}
          <motion.ellipse
            cx="120"
            cy="76"
            rx="12"
            ry={blink ? 1 : 12}
            fill={getEyeColor()}
            animate={{
              scale: state === 'listening' ? [1, 1.15, 1] : 1
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity
            }}
            style={{ filter: `drop-shadow(0 0 6px ${getEyeColor()})` }}
          />

          {/* Mouth / Voice Wave visualizer */}
          <g transform="translate(75, 102)">
            {state === 'speaking' ? (
              // Speaking wave animation
              <g>
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.rect
                    key={i}
                    x={i * 10}
                    y={-5}
                    width="4"
                    height="10"
                    rx="2"
                    fill="#3b82f6"
                    animate={{
                      height: [4, 14, 4],
                      y: [-2, -7, -2]
                    }}
                    transition={{
                      duration: 0.5 + (i * 0.08),
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.1
                    }}
                  />
                ))}
              </g>
            ) : state === 'listening' ? (
              // Listening voice waves
              <g>
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.rect
                    key={i}
                    x={i * 10}
                    y={-5}
                    width="4"
                    height="10"
                    rx="2"
                    fill="#22d3ee"
                    animate={{
                      height: [2, 18, 2],
                      y: [-1, -9, -1]
                    }}
                    transition={{
                      duration: 0.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.08
                    }}
                  />
                ))}
              </g>
            ) : state === 'thinking' ? (
              // Thinking loading dots
              <g transform="translate(10, -5)">
                {[0, 1, 2].map((i) => (
                  <motion.circle
                    key={i}
                    cx={i * 12}
                    cy="0"
                    r="3.5"
                    fill="#c084fc"
                    animate={{
                      y: [0, -6, 0]
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15
                    }}
                  />
                ))}
              </g>
            ) : state === 'alert' ? (
              // Alert hazard line
              <motion.line
                x1="0"
                y1="-2"
                x2="45"
                y2="-2"
                stroke="#ef4444"
                strokeWidth="4"
                strokeLinecap="round"
                animate={{
                  strokeWidth: [4, 2, 4],
                  opacity: [1, 0.4, 1]
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity
                }}
              />
            ) : (
              // Idle line mouth
              <line
                x1="10"
                y1="-2"
                x2="35"
                y2="-2"
                stroke="#0e7490"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
          </g>
        </motion.g>
      </motion.svg>

      {/* Ambient glowing aura rings behind base */}
      {state === 'thinking' && (
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.7, 0.3]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute w-[120%] h-[120%] rounded-full border border-purple-500/20 blur-md pointer-events-none"
        />
      )}
      {state === 'listening' && (
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.8, 0.4]
          }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="absolute w-[120%] h-[120%] rounded-full border border-cyan-500/25 blur-md pointer-events-none"
        />
      )}
    </div>
  )
}
