import { env } from '@/config/env-runtime'

export const isProd = env.NODE_ENV === 'production'
