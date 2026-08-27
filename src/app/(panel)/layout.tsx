import type { Metadata } from 'next'

/**
 * El grupo (panel) existe para separar el chrome, no para proteger nada.
 *
 * EL GATE NO VIVE AQUI, y no es un descuido: este layout no conoce el slug del
 * sitio, asi que no puede saber contra que membresia comprobar. Cada pagina de
 * /panel/[slug] llama requireVenueAccess con su propio venueId. Ver la regla
 * grande en src/lib/auth/venue-access.ts.
 */
export const metadata: Metadata = {
  title: 'Panel del sitio',
  robots: { index: false, follow: false },
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return children
}
