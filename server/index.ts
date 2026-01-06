import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { auth } from '@/lib/auth'

const app = new Hono().basePath('/api')

app.use(
  '/auth/*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })
)

app.on(['POST', 'GET'], '/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

app.get('/', (c) => c.json({ message: 'Hello World' }))

export default app
