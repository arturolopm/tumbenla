import { parseEnv } from '@/config/env'

export const env = parseEnv(Object.assign(process.env))