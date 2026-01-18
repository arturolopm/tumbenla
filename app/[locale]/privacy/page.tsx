import type { Metadata } from 'next'
import { generateMetadata as generateSEOMetadata } from '@/lib/seo'
import Navbar from '../(site)/navbar'
import Footer from '../(site)/footer'
import { GridLayout } from '../(site)/grid-layout'

export const metadata: Metadata = generateSEOMetadata({
  title: 'Privacy Policy',
  description: 'Privacy Policy for ShipFree platform',
  canonical: '/privacy',
})

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <GridLayout>
      <Navbar />
      <main className='min-h-screen pt-14'>
        <div className='mx-auto max-w-4xl px-4 py-16 sm:px-6'>
          <h1 className='mb-4 text-4xl font-semibold tracking-tight'>Privacy Policy</h1>
          <p className='mb-12 text-sm text-muted-foreground'>Last updated: 17 jan 2026</p>

          <div className='prose prose-sm max-w-none space-y-8 text-muted-foreground'>
            <p>we value your privacy. here's how we handle your info.</p>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>1. data we collect</h2>
              <ul className='list-disc space-y-2 pl-6'>
                <li>basic account info (email, name, etc.)</li>
                <li>usage data (how you interact with the app)</li>
                <li>optional data you share (like feedback or support requests)</li>
              </ul>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>2. how we use it</h2>
              <ul className='list-disc space-y-2 pl-6'>
                <li>to run and improve shipfree</li>
                <li>to communicate with you about updates or issues</li>
                <li>to prevent misuse or fraud</li>
              </ul>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>3. cookies</h2>
              <p>
                we use cookies to keep you logged in and track performance. you can disable cookies,
                but some features might not work properly.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                4. third-party services
              </h2>
              <p>
                we may use analytics or hosting tools (like vercel, supabase, or stripe) that
                collect data in line with their own policies.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>5. data security</h2>
              <p>
                we take reasonable steps to secure your info but can't guarantee 100% security.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>6. your rights</h2>
              <p>
                you can request deletion or correction of your data anytime at{' '}
                <a
                  href='mailto:support@shipfree.dev'
                  className='text-(--brand-accent-hex) underline-offset-4 hover:text-(--brand-accent-hover-hex) hover:underline'
                >
                  support@shipfree.dev
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </GridLayout>
  )
}
