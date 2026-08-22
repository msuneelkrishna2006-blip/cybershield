'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { AlertTriangle, FlipHorizontal } from 'lucide-react'
import { useTranslation } from '@/contexts/TranslationContext'

interface QrCameraScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanError?: (error: string) => void
  onCancel: () => void
}

interface CameraDevice {
  id: string
  label: string
}

export default function QrCameraScanner({ onScanSuccess, onScanError, onCancel }: QrCameraScannerProps) {
  const { t } = useTranslation('scamScanner')
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const elementId = "qr-reader-target"

  // Use refs to store active callbacks to avoid re-triggering useEffect when parent functions change
  const onScanSuccessRef = useRef(onScanSuccess)
  const onScanErrorRef = useRef(onScanError)

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess
    onScanErrorRef.current = onScanError
  })

  useEffect(() => {
    let isMounted = true
    let scannerInstance: Html5Qrcode | null = null

    const initScanner = async () => {
      // 1. Feature detection
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        const msg = t('cameraHttpsError') || "Camera access requires HTTPS or is not supported."
        setError(msg)
        if (onScanErrorRef.current) onScanErrorRef.current(msg)
        return
      }

      try {
        // 2. Get cameras list
        const devices = await Html5Qrcode.getCameras()
        if (!isMounted) return

        if (!devices || devices.length === 0) {
          const msg = t('noCamerasDetected') || "No cameras detected on this device."
          setError(msg)
          if (onScanErrorRef.current) onScanErrorRef.current(msg)
          return
        }

        setCameras(devices)

        // 3. Instantiate Html5Qrcode
        // The element is guaranteed to exist because this is inside useEffect of a rendered component
        const scanner = new Html5Qrcode(elementId)
        scannerInstance = scanner
        scannerRef.current = scanner

        if (!isMounted) return

        // 4. Select target camera (back camera if mobile, else first camera)
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'))
        const targetCameraId = backCamera ? backCamera.id : devices[0].id
        setActiveCameraId(targetCameraId)

        if (!isMounted) return

        // 5. Start scanning
        await scanner.start(
          targetCameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            onScanSuccessRef.current(decodedText)
          },
          () => {
            // Ignore scan frame errors
          }
        )

        // If unmounted while scanner was starting
        if (!isMounted) {
          if (scanner.isScanning) {
            await scanner.stop()
          }
          scannerRef.current = null
        }
      } catch (err: unknown) {
        console.error('QR Scanner init error:', err)
        if (!isMounted) return
        const msg = t('cameraPermissionDenied') || "Camera permission denied or camera not accessible."
        setError(msg)
        if (onScanErrorRef.current) onScanErrorRef.current(msg)
      }
    }

    initScanner()

    return () => {
      isMounted = false
      if (scannerInstance) {
        if (scannerInstance.isScanning) {
          scannerInstance.stop().catch(err => {
            console.error('Failed to stop scanner on unmount:', err)
          })
        }
      }
    }
  }, [t])

  const flipCamera = async () => {
    if (!scannerRef.current || cameras.length <= 1 || !activeCameraId) return

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop()
      }

      const currentIndex = cameras.findIndex(c => c.id === activeCameraId)
      const nextIndex = (currentIndex + 1) % cameras.length
      const nextCameraId = cameras[nextIndex].id
      setActiveCameraId(nextCameraId)

      await scannerRef.current.start(
        nextCameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          onScanSuccessRef.current(decodedText)
        },
        () => {}
      )
    } catch (err) {
      console.error('Failed to flip camera:', err)
      setError(t('cameraPermissionDenied') || "Failed to switch camera.")
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-red-500/30 bg-red-500/10 rounded-xl text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-red-400 text-sm font-semibold">{error}</p>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
        >
          {t('cancelCamera') || "Cancel"}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div id={elementId} className="w-full h-64 bg-black rounded-xl overflow-hidden relative border border-white/10" />
      <div className="flex justify-between items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="bg-red-500/20 text-red-400 px-4 py-2 border border-red-500/30 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors cursor-pointer"
        >
          {t('cancelCamera') || "Cancel"}
        </button>
        {cameras.length > 1 && (
          <button
            type="button"
            onClick={flipCamera}
            className="flex items-center gap-1.5 bg-cyan-500/20 text-cyan-400 px-4 py-2 border border-cyan-500/30 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-colors cursor-pointer"
          >
            <FlipHorizontal size={14} />
            {t('flipCamera') || "Flip Camera"}
          </button>
        )}
      </div>
    </div>
  )
}
