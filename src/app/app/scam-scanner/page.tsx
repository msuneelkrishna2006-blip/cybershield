'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, Badge, Spinner, RiskScore } from '@/components/ui'
import { useTranslation } from '@/contexts/TranslationContext'
import { Search, Link as LinkIcon, Image as ImageIcon, QrCode, ShieldCheck, AlertTriangle, MessageSquareWarning, Info, Bot } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ScannerErrorBoundary } from '@/components/ui/ScannerErrorBoundary'

const QrCameraScanner = dynamic(() => import('@/components/ui/QrCameraScanner'), { ssr: false })

interface ScanApiResult {
  scanId: string;
  result: {
    riskScore: number;
    riskLevel: string;
    category: string;
    confidence: number;
    indicators: string[];
    explanation: string;
    recommendedAction: string;
    safeNextSteps: string[];
  };
  metadata: {
    provider: string;
    fallback: boolean;
    analyzedAt: string;
  };
}

interface ScanHistoryItem {
  id: string;
  type: string;
  riskScore: number;
  riskLevel: string;
  category: string;
  summary: string;
  createdAt: string;
}

const TABS = [
  { id: 'text', labelKey: 'tabMessage', icon: MessageSquareWarning },
  { id: 'link', labelKey: 'tabLink', icon: LinkIcon },
  { id: 'qr', labelKey: 'tabQr', icon: QrCode },
  { id: 'image', labelKey: 'tabScreenshot', icon: ImageIcon },
]

export default function ScamScannerPage() {
  const { t } = useTranslation('scamScanner')
  const [activeTab, setActiveTab] = useState('text')
  const [input, setInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanApiResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Live Database States
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([])
  
  // Camera Scanning States
  const [isCameraMode, setIsCameraMode] = useState(false)
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null)
  const [ariaLiveAnnouncement, setAriaLiveAnnouncement] = useState('')
  const [manualCode, setManualCode] = useState('')

  const loadRecentScans = async () => {
    try {
      const res = await fetch('/api/v1/scans')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data && data.data.scans) {
          setRecentScans(data.data.scans)
        }
      }
    } catch (e) {
      console.error('Failed to load recent scans:', e)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecentScans()
  }, [])

  const handleScanSuccess = useCallback((decodedText: string) => {
    setInput(decodedText)
    setManualCode(decodedText)
    setIsCameraMode(false)
    setAriaLiveAnnouncement(t('qrDetected') + ": " + decodedText)
  }, [t])

  const handleScanError = useCallback((err: string) => {
    setCameraPermissionError(err)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraPermissionError(null)

    // Feature detection
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraPermissionError(t('cameraPermissionDenied') || "Camera access denied or camera not accessible.")
      // Auto-switch to Upload QR Image
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.click()
        }
      }, 100)
      return
    }

    setIsCameraMode(true)
  }, [t])

  const stopCamera = useCallback(async () => {
    setIsCameraMode(false)
  }, [])

  const performRealScan = async (finalInput: string, scanType: string) => {
    setResult(null)
    setScanError(null)
    setIsScanning(true)

    try {
      const res = await fetch('/api/v1/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: finalInput, type: scanType })
      })
      const data = await res.json()

      if (data.success && data.data) {
        setResult(data.data)
        loadRecentScans()
      } else {
        setScanError(data.error?.message || 'Failed to scan content. Please try again.')
      }
    } catch (err) {
      console.error('Scan error:', err)
      setScanError('A network error occurred while scanning.')
    } finally {
      setIsScanning(false)
    }
  }

  const triggerAutoScan = async (text: string) => {
    await performRealScan(text, 'qr')
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && !selectedFile) return

    setScanError(null)
    setOcrError(null)
    setResult(null)
    setIsScanning(true)

    let finalInput = input
    let scanType = activeTab === 'text' ? 'sms' : activeTab === 'link' ? 'url' : activeTab === 'qr' ? 'qr' : 'general'

    if ((activeTab === 'image' || activeTab === 'qr') && selectedFile) {
      const formData = new FormData()
      formData.append('file', selectedFile)

      try {
        const res = await fetch('/api/v1/ocr', { method: 'POST', body: formData })
        const data = await res.json()
        if (!data.success) {
          setOcrError(data.error || "OCR Failed")
          setIsScanning(false)
          return
        }
        finalInput = data.text
      } catch {
        setOcrError(t('ocrFailed'))
        setIsScanning(false)
        return
      }
    }

    await performRealScan(finalInput, scanType)
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'sms': return MessageSquareWarning
      case 'url':
      case 'link': return LinkIcon
      case 'qr': return QrCode
      case 'screenshot':
      case 'general':
      case 'image': default: return ImageIcon
    }
  }

  const getRiskColorClass = (level: string) => {
    switch (level.toUpperCase()) {
      case 'CRITICAL': return 'border-red-500/50 shadow-neon-red'
      case 'HIGH': return 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2)]'
      case 'MEDIUM': return 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)]'
      case 'LOW': return 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
      case 'SAFE': default: return 'border-emerald-500/50 shadow-neon-emerald'
    }
  }

  const getRiskBadgeVariant = (level: string) => {
    switch (level.toUpperCase()) {
      case 'CRITICAL': return 'danger'
      case 'HIGH': return 'warning'
      case 'MEDIUM': return 'warning'
      case 'LOW': return 'info'
      case 'SAFE': default: return 'safe'
    }
  }

  const formatCategory = (cat: string) => {
    return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Hidden ARIA announcement banner */}
      <div aria-live="assertive" className="sr-only">
        {ariaLiveAnnouncement}
      </div>

      <div>
        <h1 className="text-3xl font-black text-white mb-2">{t('title')}</h1>
        <p className="text-slate-400">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Input Area */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-1">
            <div className="flex flex-wrap border-b border-white/10">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => { 
                      setActiveTab(tab.id); setResult(null); setInput(''); setScanError(null);
                      setSelectedFile(null); setPreviewUrl(null); setOcrError(null);
                      stopCamera()
                    }}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                      isActive ? 'border-cyan-400 text-cyan-400 bg-white/5' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} /> {t(tab.labelKey)}
                  </button>
                )
              })}
            </div>
            
            <div className="p-6">
              <form onSubmit={handleScan} className="space-y-4">
                
                {activeTab === 'text' && (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('messagePlaceholder')}
                    className="textarea h-40 resize-none"
                    disabled={isScanning}
                  />
                )}

                {activeTab === 'link' && (
                  <input
                    type="url"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="https://suspicious-website.com"
                    className="input py-4"
                    disabled={isScanning}
                  />
                )}

                {activeTab === 'qr' && (
                  <ScannerErrorBoundary>
                    <div className="space-y-4">
                      {isCameraMode ? (
                        <QrCameraScanner
                          onScanSuccess={handleScanSuccess}
                          onScanError={handleScanError}
                          onCancel={stopCamera}
                        />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="flex flex-col items-center justify-center border-2 border-dashed border-cyan-500/30 rounded-xl p-8 text-center bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                          >
                            <Bot className="w-10 h-10 text-cyan-400 mb-2 animate-pulse" />
                            <span className="text-white font-bold text-sm">{t('scanWithCamera')}</span>
                            <span className="text-slate-500 text-[10px] mt-1">{t('cameraSubtext')}</span>
                          </button>
                          
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center bg-black/20 hover:bg-white/5 transition-colors cursor-pointer flex flex-col items-center justify-center relative overflow-hidden"
                          >
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              accept="image/png, image/jpeg" 
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  setSelectedFile(file)
                                  setPreviewUrl(URL.createObjectURL(file))
                                }
                              }}
                            />
                            {previewUrl ? (
                              <div className="absolute inset-0 w-full h-full p-4 flex flex-col items-center justify-center bg-black/80">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded" />
                                <p className="text-xs text-white/80 mt-2">{t('changeImage')}</p>
                              </div>
                            ) : (
                              <>
                                <ImageIcon className="w-10 h-10 text-slate-500 mb-2" />
                                <span className="text-slate-300 font-bold text-sm">{t('uploadQrImage')}</span>
                                <span className="text-slate-500 text-[10px] mt-1">{t('uploadQrSubtext')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {cameraPermissionError && (
                        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                          <AlertTriangle size={16} />
                          {cameraPermissionError}
                        </div>
                      )}

                      {/* Manual Fallback accessibility entry */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('manualCodeLabel')}</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualCode}
                            onChange={e => setManualCode(e.target.value)}
                            placeholder={t('manualCodePlaceholder')}
                            className="input py-2 flex-1 text-sm bg-black/40"
                            disabled={isScanning}
                          />
                          <button
                            type="button"
                            disabled={isScanning || !manualCode.trim()}
                            onClick={() => {
                              if (manualCode.trim()) {
                                setInput(manualCode.trim())
                                triggerAutoScan(manualCode.trim())
                              }
                            }}
                            className="bg-cyan-500 hover:bg-cyan-600 text-black px-4 py-2 rounded-lg font-bold text-xs transition-colors shrink-0 cursor-pointer"
                          >
                            {t('submit')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </ScannerErrorBoundary>
                )}

                {activeTab === 'image' && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center bg-black/20 hover:bg-white/5 transition-colors cursor-pointer relative overflow-hidden"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/png, image/jpeg" 
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setSelectedFile(file)
                          setPreviewUrl(URL.createObjectURL(file))
                        }
                      }}
                    />
                    {previewUrl ? (
                      <div className="absolute inset-0 w-full h-full p-4 flex flex-col items-center justify-center bg-black/80">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded" />
                        <p className="text-xs text-white/80 mt-2 bg-black/50 px-2 py-1 rounded">{t('changeImage')}</p>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-300 font-medium">{t('uploadClick')}</p>
                        <p className="text-xs text-slate-500 mt-2">{t('uploadQrSubtext')}</p>
                      </>
                    )}
                  </div>
                )}
                
                {ocrError && (
                  <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle size={16} />
                    {ocrError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <ShieldCheck size={14} className="text-emerald-400" /> {t('encrypted')}
                  </p>
                  <button 
                    type="submit" 
                    disabled={isScanning || (!input && !selectedFile)}
                    className="btn-primary"
                  >
                    {isScanning ? (
                      <><Spinner size={16} className="text-white mr-2" /> {t('scanning')}</>
                    ) : (
                      <><Search size={16} className="mr-2" /> {t('analyzeNow')}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </Card>

          {/* Error Message */}
          {scanError && !isScanning && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-3 text-red-400 text-sm">
              <AlertTriangle size={20} />
              <p>{scanError}</p>
            </div>
          )}

          {/* Scanning Animation State */}
          <AnimatePresence>
            {isScanning && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)] relative overflow-hidden">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                      <Spinner className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">{t('scanning')}</h4>
                      <p className="text-sm text-cyan-400">Analyzing content in real-time...</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results State */}
          <AnimatePresence>
            {result && !isScanning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className={`border-2 ${getRiskColorClass(result.result.riskLevel)}`}>
                  <div className="flex items-start gap-6 mb-8">
                    <RiskScore score={result.result.riskScore} size={80} />
                    <div className="flex-1 pt-2">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-black uppercase tracking-wider">
                          {['CRITICAL', 'HIGH'].includes(result.result.riskLevel.toUpperCase()) ? t('threatDetected') : t('contentSafe')}
                        </h3>
                        <Badge variant={getRiskBadgeVariant(result.result.riskLevel) as any}>
                          {formatCategory(result.result.category)}
                        </Badge>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{result.result.explanation}</p>
                      
                      <div className="mt-3 flex items-center gap-4">
                        <p className="text-xs text-slate-400">
                          Confidence: <span className="text-white font-bold">{(result.result.confidence * 100).toFixed(0)}%</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Analyzed by: <span className="text-cyan-400 font-bold">{result.metadata.provider === 'gemini' ? 'Gemini AI' : 'Heuristic Engine'}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Recommendations */}
                    <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                        <ShieldCheck size={16} /> {t('actionPlan')}
                      </h4>
                      
                      <p className="text-sm font-semibold text-white mb-3">{result.result.recommendedAction}</p>

                      <ul className="space-y-2">
                        {result.result.safeNextSteps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                            <span className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${['CRITICAL', 'HIGH'].includes(result.result.riskLevel.toUpperCase()) ? 'bg-red-400' : 'bg-emerald-400'}`} />
                            {step}
                          </li>
                        ))}
                      </ul>
                      
                      {['CRITICAL', 'HIGH'].includes(result.result.riskLevel.toUpperCase()) && (
                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                          <p className="text-xs text-slate-400">{t('moneyDeducted')}</p>
                          <Link href="/app/emergency" className="text-xs font-bold bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-colors">
                            {t('reportInstantly')}
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Indicators */}
                    {result.result.indicators && result.result.indicators.length > 0 && (
                      <div>
                        <h4 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-3">Detected Indicators</h4>
                        <div className="space-y-3">
                          {result.result.indicators.map((indicator, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 text-sm text-slate-300">
                              <AlertTriangle size={16} className={['CRITICAL', 'HIGH'].includes(result.result.riskLevel.toUpperCase()) ? 'text-red-400' : 'text-yellow-400'} />
                              {indicator}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Col: Info/History */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-gradient-to-br from-slate-900 to-black">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-200">
              <Info className="text-cyan-400 w-5 h-5" /> {t('howItWorks')}
            </h3>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              CyberShield uses advanced threat analysis. Our system evaluates inputs dynamically against known patterns and live indicators:
            </p>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center shrink-0">🔍</div> {t('scamDetectionAgent')}</li>
              <li className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center shrink-0">🌐</div> {t('websiteVerificationAgent')}</li>
              <li className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-emerald-500/20 flex items-center justify-center shrink-0">📱</div> {t('upiPaymentAgent')}</li>
              <li className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-orange-500/20 flex items-center justify-center shrink-0">📊</div> {t('riskAssessorAgent')}</li>
            </ul>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-200">{t('recentScans')}</h3>
              <Link href="/app/scam-scanner/history" className="text-xs text-cyan-400 hover:underline">
                {t('viewAll')}
              </Link>
            </div>
            
            <div className="space-y-3">
              {recentScans.length > 0 ? recentScans.map((scan) => {
                const Icon = getIconForType(scan.type)
                return (
                  <div key={scan.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-white/5">
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize truncate">{scan.type} Scan</p>
                        <p className="text-[10px] text-slate-500">{new Date(scan.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                      </div>
                    </div>
                    <Badge variant={getRiskBadgeVariant(scan.riskLevel) as any}>{scan.riskLevel}</Badge>
                  </div>
                )
              }) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  {t('noRecentScans')}
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
