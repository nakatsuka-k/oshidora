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

app.get('/v1/top', (c) => {
  return c.json({
    pickup: [
      { id: 'p1', title: 'ピックアップ：ダウトコール 第01話', thumbnailUrl: '' },
      { id: 'p2', title: 'ピックアップ：ダウトコール 第02話', thumbnailUrl: '' },
      { id: 'p3', title: 'ピックアップ：ダウトコール 第03話', thumbnailUrl: '' },
    ],
    notice: {
      id: 'n1',
      body: '本日より新機能を追加しました。より快適に視聴できるよう改善しています。詳細はアプリ内のお知らせをご確認ください。',
    },
    ranking: [
      { id: 'r1', title: 'ランキング 1位：ダウトコール', thumbnailUrl: '' },
      { id: 'r2', title: 'ランキング 2位：ミステリーX', thumbnailUrl: '' },
      { id: 'r3', title: 'ランキング 3位：ラブストーリーY', thumbnailUrl: '' },
      { id: 'r4', title: 'ランキング 4位：コメディZ', thumbnailUrl: '' },
    ],
    favorites: [
      { id: 'f1', title: 'お気に入り：ダウトコール', thumbnailUrl: '' },
      { id: 'f2', title: 'お気に入り：ミステリーX', thumbnailUrl: '' },
      { id: 'f3', title: 'お気に入り：ラブストーリーY', thumbnailUrl: '' },
    ],
  })
})

app.get('/v1/categories', (c) => {
  return c.json({
    items: [
      { id: 'c1', name: 'ドラマ' },
      { id: 'c2', name: 'ミステリー' },
      { id: 'c3', name: '恋愛' },
      { id: 'c4', name: 'コメディ' },
      { id: 'c5', name: 'アクション' },
    ],
  })
})

app.get('/v1/cast', (c) => {
  return c.json({
    items: [
      { id: 'a1', name: '松岡美沙', role: '出演者', thumbnailUrl: '' },
      { id: 'a2', name: '櫻井拓馬', role: '出演者', thumbnailUrl: '' },
      { id: 'a3', name: '監督太郎', role: '監督', thumbnailUrl: '' },
      { id: 'a4', name: 'Oshidora株式会社', role: '制作', thumbnailUrl: '' },
    ],
  })
})

app.get('/v1/videos', (c) => {
  return c.json({
    items: [
      { id: 'v1', title: 'ダウトコール 第01話', rating: 4.7, ratingCount: 128, thumbnailUrl: '' },
      { id: 'v2', title: 'ダウトコール 第02話', rating: 4.6, ratingCount: 94, thumbnailUrl: '' },
      { id: 'v3', title: 'ダウトコール 第03話', rating: 4.8, ratingCount: 156, thumbnailUrl: '' },
      { id: 'v4', title: 'ミステリーX 第01話', rating: 4.4, ratingCount: 61, thumbnailUrl: '' },
      { id: 'v5', title: 'ラブストーリーY 第01話', rating: 4.2, ratingCount: 43, thumbnailUrl: '' },
    ],
  })
})

app.get('/v1/oshi', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, created_at FROM oshi ORDER BY created_at DESC'
  ).all()

  return c.json({ items: results })
})

app.post('/v1/oshi', async (c) => {
  const body = await c.req.json<{ name?: string }>().catch((): { name?: string } => ({}))
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
