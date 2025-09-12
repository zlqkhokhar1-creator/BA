import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Trading Platform - Professional Brokerage',
  description: 'Advanced AI-powered brokerage trading platform with institutional-grade performance',
  keywords: 'trading, brokerage, stocks, options, portfolio, analytics',
  authors: [{ name: 'Trading Platform Team' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 font-sans">
        <Providers>
          <div className="min-h-screen">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}