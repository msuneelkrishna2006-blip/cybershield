import type { Metadata } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { TranslationProvider } from '@/contexts/TranslationContext'
import { Toaster } from 'react-hot-toast'
import I18nInitializer from '@/components/I18nInitializer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: 'CyberShield 2.0 | India\'s AI Guardian for Digital Safety',
  description: 'Protect your family from online fraud, scams, and safety threats with AI-powered security.',
}

import FloatingWidgets from '@/components/layout/FloatingWidgets'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}>
        <I18nInitializer>
          <TranslationProvider>
            <AuthProvider>
              {children}
              <FloatingWidgets />
              <Toaster 
                position="bottom-right" 
                toastOptions={{
                  style: {
                    background: '#0a193b',
                    color: '#fff',
                    border: '1px solid rgba(6, 182, 212, 0.2)',
                  }
                }} 
              />
            </AuthProvider>
          </TranslationProvider>
        </I18nInitializer>
      </body>
    </html>
  )
}
