'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

const localeNames: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
}

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <div className='flex items-center gap-2'>
      <span className='text-sm font-medium text-muted-foreground'>Language:</span>
      <select
        value={locale}
        onChange={(e) => handleLocaleChange(e.target.value)}
        className='rounded-md border border-[#E4E4E7] bg-white px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-200 ease-in-out hover:border-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
        aria-label='Select language'
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeNames[loc] || loc}
          </option>
        ))}
      </select>
    </div>
  )
}
