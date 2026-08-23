/**
 * URL slugs from Spanish text.
 *
 * Accents and ñ must be folded before slugifying or the URLs come out with
 * percent-encoded bytes: 'Bogotá' would become 'bogot%C3%A1' rather than
 * 'bogota'. NFD splits a letter from its combining accent so the accent can be
 * stripped on its own; ñ is handled separately because folding it to 'n' is a
 * spelling decision, not an accent, and NFD leaves it alone.
 */
export const slugify = (input: string) =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ñÑ]/g, 'n')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
