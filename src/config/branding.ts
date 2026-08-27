export interface ThemeColors {
  primaryColor?: string
  primaryHoverColor?: string
  accentColor?: string
  accentHoverColor?: string
  backgroundColor?: string
}

export interface BrandConfig {
  name: string
  logoUrl?: string
  faviconUrl?: string
  customCssUrl?: string
  supportEmail?: string
  documentationUrl?: string
  termsUrl?: string
  privacyUrl?: string
  theme?: ThemeColors
}

/**
 * Brand values for the two places that cannot read CSS custom properties: the
 * PWA manifest and the email templates.
 *
 * src/app/_styles/globals.css is the source of truth for the app itself. These
 * hex values mirror its oklch tokens and must be updated alongside them. CSS
 * cannot import TypeScript, so the sync is manual by necessity, not by
 * accident. Previously this file said #701ffc while the emails said #6f3dfa and
 * neither matched the stylesheet at all.
 *
 * Los hex son los de Stitch ("Calor de Barrio"), que es de donde salieron los
 * tokens oklch del stylesheet. Aca el hex es el original y el oklch el derivado,
 * al reves que antes:
 *
 *   primary   #f56218  naranja de relleno -> oklch(0.676 0.196 41.9)
 *   accent    #f5a202  ambar de rumba     -> oklch(0.776 0.165 72.6)
 *   surface   #0d1321  navy profundo      -> oklch(0.188 0.030 265.9)
 *   card      #191f2e                     -> oklch(0.241 0.030 267.3)
 *
 * Los correos siguen en tema claro a proposito: el HTML oscuro en email es un
 * campo minado de compatibilidad y la gente lee los correos de auth en bandejas
 * blancas. Estos colores son acentos dentro de esa plantilla clara, y por eso
 * el naranja de relleno funciona ahi aunque sobre fondo blanco no serviria para
 * texto pequeno.
 */
const defaultConfig: BrandConfig = {
  name: 'Tumbenla',
  logoUrl: undefined,
  faviconUrl: '/favicon/favicon.ico',
  customCssUrl: undefined,
  supportEmail: 'hola@tumbenla.com',
  documentationUrl: undefined,
  termsUrl: '/terminos',
  privacyUrl: '/privacidad',
  theme: {
    primaryColor: '#f56218',
    primaryHoverColor: '#ff7c3a',
    accentColor: '#f5a202',
    accentHoverColor: '#ffc476',
    backgroundColor: '#0d1321',
  },
}

const getThemeColors = (): ThemeColors => {
  return {
    primaryColor: defaultConfig.theme?.primaryColor,
    primaryHoverColor: defaultConfig.theme?.primaryHoverColor,
    accentColor: defaultConfig.theme?.accentColor,
    accentHoverColor: defaultConfig.theme?.accentHoverColor,
    backgroundColor: defaultConfig.theme?.backgroundColor,
  }
}

export const getBrandConfig = (): BrandConfig => {
  return {
    name: defaultConfig.name,
    logoUrl: defaultConfig.logoUrl,
    faviconUrl: defaultConfig.faviconUrl,
    customCssUrl: defaultConfig.customCssUrl,
    supportEmail: defaultConfig.supportEmail,
    documentationUrl: defaultConfig.documentationUrl,
    termsUrl: defaultConfig.termsUrl,
    privacyUrl: defaultConfig.privacyUrl,
    theme: getThemeColors(),
  }
}

/**
 * Hook to use brand configuration in React components
 */
export const useBrandConfig = () => {
  return getBrandConfig()
}
