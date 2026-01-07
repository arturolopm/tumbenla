import type { Metadata } from 'next'
import { Geist, Geist_Mono, Bricolage_Grotesque } from 'next/font/google'

import './globals.css'
import { HydrationErrorHandler } from '@/app/_shell/hydration-error-handler'
import { QueryProvider } from '@/app/_shell/providers/query-provider'
import { ToastProvider } from '@/components/ui/toast'
import { generateMetadata } from '@/lib/seo'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const bricolageGrotesque = Bricolage_Grotesque({
  variable: '--font-bricolage-grotesque',
  subsets: ['latin'],
})

export const metadata: Metadata = generateMetadata({ title: 'ShipFree' })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolageGrotesque.variable} font-sans antialiased`}
      >
        <HydrationErrorHandler />
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
