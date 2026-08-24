import type { Config } from 'drizzle-kit'

export default {
  schema: './src/database/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // La directa, con fallback a la de siempre para que en local no cambie
    // nada. `generate` no se conecta a nada, pero `studio` y `push` si, y el
    // pooler de Neon no sostiene lo que esos dos hacen.
    // `||`, no `??`: una variable vacia no es undefined. Ver scripts/migrate.ts.
    url: (process.env.DIRECT_DATABASE_URL?.trim() || process.env.DATABASE_URL)!,
  },
} satisfies Config
