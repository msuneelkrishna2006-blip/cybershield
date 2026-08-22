'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ScannerErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Scanner error caught by boundary:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-6 border border-red-500/30 bg-red-500/10 rounded-xl text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-red-400 text-sm font-semibold">Something went wrong with the scanner.</p>
          <p className="text-xs text-slate-400">Try uploading an image or typing the code manually instead.</p>
        </div>
      )
    }

    return this.props.children;
  }
}
