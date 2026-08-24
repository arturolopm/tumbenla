import type { Metadata, Viewport } from 'next'
import { Anybody, Geist_Mono, Montserrat } from 'next/font/google'

import '@/app/_styles/globals.css'
import { QueryProvider } from '@/app/_providers/query-provider'
import { ToastProvider } from '@/components/ui/toast'
import { generateMetadata } from '@/lib/seo'

/**
 * El par de Stitch. Anybody carga solo los pesos gordos porque es cara de
 * titular y nunca corre texto; Montserrat carga el rango de cuerpo.
 */
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
      'Bares y discotecas que ponen una parte de sus ventas en material de construccion. Mira cuales son, donde quedan, y en que se fue la plata.',
    isRootLayout: true,
  }),
  icons: {
    icon: '/image.png',
    shortcut: '/image.png',
    apple: '/image.png',
  },
}

/**
 * Dark-only, so the theme is declared rather than negotiated. This is what
 * turns native form controls, scrollbars and the mobile browser chrome dark;
 * the class alone only styles our own elements.
 */
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0d1321',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
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
