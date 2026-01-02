import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  Bindings: {
    DB: D1Database
  }
}

const app = new Hono<Env>()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  })
)

app.get('/health', (c) => c.text('ok'))

app.get('/v1/oshi', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, created_at FROM oshi ORDER BY created_at DESC'
  ).all()

  return c.json({ items: results })
})

app.post('/v1/oshi', async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}))
  const name = body?.name?.trim()
  if (!name) return c.json({ error: 'name is required' }, 400)

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  await c.env.DB.prepare(
    'INSERT INTO oshi (id, name, created_at) VALUES (?, ?, ?)'
  )
    .bind(id, name, createdAt)
    .run()

  return c.json({ id, name, created_at: createdAt }, 201)
})

export default app
