import { env } from '@/config/env'

export const isProd = env.NODE_ENV === 'production'
