import type { MetadataRoute } from 'next'
import { getBrandConfig } from '@/config/branding'

export default function manifest(): MetadataRoute.Manifest {
  const brand = getBrandConfig()

  return {
    name: brand.name,
    short_name: brand.name,
    description:
      'Sitios con un producto de Tumbenla en su carta y compras de material con factura.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: brand.theme?.backgroundColor,
    theme_color: brand.theme?.backgroundColor,
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/tumbenla-logo-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/tumbenla-logo-180.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    categories: ['food', 'lifestyle', 'social'],
    shortcuts: [
      {
        name: 'Ver los sitios',
        short_name: 'Sitios',
        description: 'Sitios con un producto de Tumbenla publicado',
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
