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
 * These hex values are the exact sRGB fallbacks Tailwind compiles from the oklch
 * tokens, read back out of the built stylesheet rather than eyeballed:
 *
 *   primary   oklch(0.78 0.155 68)   -> #f7a232   amber
 *   accent    oklch(0.68 0.225 349)  -> #f54bae   magenta
 *   surface   oklch(0.145 0.012 295) -> #0a090f   near-black
 *   card      oklch(0.185 0.013 295) -> #131218
 */
const defaultConfig: BrandConfig = {
  name: 'Tumbenla',
  logoUrl: undefined,
  faviconUrl: '/favicon/favicon.ico',
  customCssUrl: undefined,
  supportEmail: 'hola@tumbenla.co',
  documentationUrl: undefined,
  termsUrl: '/terminos',
  privacyUrl: '/privacidad',
  theme: {
    primaryColor: '#f7a232',
    primaryHoverColor: '#f9b45c',
    accentColor: '#f54bae',
    accentHoverColor: '#f76fc0',
    backgroundColor: '#0a090f',
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
