import type { Metadata } from 'next'
import { Geist, Geist_Mono, Bricolage_Grotesque } from 'next/font/google'
import { setI18n } from '@lingui/react/server'

import '@/app/_styles/globals.css'
import { QueryProvider } from '@/app/_providers/query-provider'
import { ToastProvider } from '@/components/ui/toast'
import { generateMetadata } from '@/lib/seo'
import { getI18nInstance } from '@/locale/server'
import { I18nProvider } from '@/locale/i18nProvider'

type Props = {
  params: Promise<{ lang: string }>
  children: React.ReactNode
}

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

export default async function RootLayout({ children, params }: Props) {
  const { lang } = await params
  const i18n = getI18nInstance(lang) // get a ready-made i18n instance for the given locale
  setI18n(i18n) // make it available server-side for the current request

  return (
    <html lang={lang}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolageGrotesque.variable} font-sans antialiased`}
      >
        <I18nProvider initialLocale={lang} initialMessages={i18n.messages}>
          <QueryProvider>
            <ToastProvider>{children}</ToastProvider>
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
