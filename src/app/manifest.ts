import type { MetadataRoute } from 'next'
import { getBrandConfig } from '@/config/branding'

export default function manifest(): MetadataRoute.Manifest {
  const brand = getBrandConfig()

  return {
    name: brand.name,
    short_name: brand.name,
    description:
      'Bares y discotecas que ponen una parte de sus ventas en material de construcción. Mira cuáles son, dónde quedan, y en qué se fue la plata.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: brand.theme?.backgroundColor,
    theme_color: brand.theme?.backgroundColor,
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/favicon/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/favicon/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/favicon/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    categories: ['food', 'lifestyle', 'social'],
    shortcuts: [
      {
        name: 'Ver los sitios',
        short_name: 'Sitios',
        description: 'Bares y discotecas que están poniendo',
        url: '/sitios',
      },
      {
        name: 'En que se fue la plata',
        short_name: 'Transparencia',
        description: 'Recibos y fotos de cada compra',
        url: '/transparencia',
      },
    ],
    lang: 'es-CO',
    dir: 'ltr',
  }
}
