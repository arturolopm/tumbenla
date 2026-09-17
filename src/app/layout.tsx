import type { Metadata, Viewport } from 'next'
import { Anybody, Geist_Mono, Montserrat } from 'next/font/google'

import '@/app/_styles/globals.css'
import { QueryProvider } from '@/app/_providers/query-provider'
import { ToastProvider } from '@/components/ui/toast'
import { generateMetadata } from '@/lib/seo'

/** Stitch font pair: Anybody carries heavy display weights and Montserrat carries body text. */
const anybody = Anybody({
  variable: '--font-anybody',
  subsets: ['latin'],
  weight: ['700', '800', '900'],
})

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  ...generateMetadata({
    title: 'Tumbenla',
    description:
      'Sitios con un producto de Tumbenla en su carta. Mira dónde salir y qué compras de material ya tienen factura.',
    isRootLayout: true,
  }),
  icons: {
    icon: [
      { url: '/tumbenla-favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/tumbenla-favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/tumbenla-favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    shortcut: '/tumbenla-favicon-32.png',
    apple: [{ url: '/tumbenla-logo-180.png', sizes: '180x180', type: 'image/png' }],
  },
}

/** Dark-only theme: this also styles native controls, scrollbars and mobile browser chrome. */
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0d1321',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='es' className='dark'>
      <body
        className={`${montserrat.variable} ${geistMono.variable} ${anybody.variable} font-sans antialiased`}
      >
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
          <div className="h-screen w-full fixed top-0 left-0 -z-10 bg-[url('/grain.jpg')] opacity-5" />
        </QueryProvider>
      </body>
    </html>
  )
}
