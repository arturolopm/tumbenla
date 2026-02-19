import type { Metadata } from 'next'
import { generateMetadata as generateSEOMetadata } from '@/lib/seo'
import Navbar from '../(site)/navbar'
import Footer from '../(site)/footer'
import { GridLayout } from '../(site)/grid-layout'

export const metadata: Metadata = generateSEOMetadata({
  title: 'Licenses',
  description: 'License information for ShipFree platform',
  canonical: '/licenses',
})

export default async function LicensesPage() {
  return (
    <GridLayout>
      <Navbar />
      <main className='min-h-screen pt-14'>
        <div className='mx-auto max-w-4xl px-4 py-16 sm:px-6'>
          <h1 className='mb-4 text-4xl font-semibold tracking-tight'>Licenses</h1>
          <p className='mb-12 text-sm text-muted-foreground'>Last updated: 17 jan 2026</p>

          <div className='prose prose-sm max-w-none space-y-8 text-muted-foreground'>
            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>1. shipfree codebase</h2>
              <p>
                the shipfree boilerplate and related source code are licensed for commercial and
                personal projects with a valid purchase or access key. redistribution or resale
                without permission is prohibited.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                2. open-source components
              </h2>
              <p>
                shipfree includes open-source libraries under their respective licenses (MIT,
                Apache 2.0, etc.). you must comply with their terms when using or modifying those
                components.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>3. attribution</h2>
              <p>
                you're not required to publicly credit shipfree, but attribution is appreciated when
                showcasing products built using it.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>4. termination</h2>
              <p>
                we reserve the right to revoke your license if you misuse or redistribute our code
                in violation of these terms.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </GridLayout>
  )
}
