import { Hono } from 'hono'
import type { JwtVariables } from 'hono/jwt'
import { jwt } from 'hono/jwt'

type Bindings = {
  JWT_SECRET?: string
  PUBLIC_BASE_URL?: string
  BUCKET: R2Bucket
}

type Variables = JwtVariables

type ResponseBody =
  | { error: null; data: { fileId: string; url: string } }
  | { error: string; data: null }

const MAX_IMAGE_SIZE_MB = 32
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function jsonError(message: string, status = 500): { status: number; body: ResponseBody } {
  return { status, body: { error: message, data: null } }
}

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const m = authHeader.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}

function splitXForwardedFor(xff: string | null): string[] {
  if (!xff) return []
  return xff
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// CORS
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'PUT,GET,HEAD,OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204)
  }

  await next()
})

// JWT for uploads only
app.use('*', async (c, next) => {
  if (c.req.method !== 'PUT') return next()

  if (!c.env.JWT_SECRET || !c.env.JWT_SECRET.trim()) {
    const { status, body } = jsonError('JWT_SECRET is not configured', 501)
    return c.json(body, status)
  }

  const token = getBearerToken(c.req.header('authorization') || null)
  if (!token) {
    const { status, body } = jsonError('Authorization token is required', 401)
    return c.json(body, status)
  }

  // Run Hono jwt middleware (expects Authorization header)
  return jwt({ secret: c.env.JWT_SECRET })(c, next)
})

app.put('/', async (c) => {
  try {
    const file = await c.req.blob()

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const { status, body } = jsonError(`ファイルサイズが${MAX_IMAGE_SIZE_MB}MBを超えています。`, 413)
      return c.json(body, status)
    }

    const contentType = (file.type || '').toLowerCase()
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      const { status, body } = jsonError('アップロードできないファイルです。', 400)
      return c.json(body, status)
    }

    const fileId = crypto.randomUUID()

    await c.env.BUCKET.put(fileId, file, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    })

    const publicBaseUrl = (c.env.PUBLIC_BASE_URL || '').trim() || 'https://assets.oshidra.com'
    const url = `${publicBaseUrl.replace(/\/$/, '')}/${fileId}`

    const responseBody: ResponseBody = { error: null, data: { fileId, url } }
    return c.json(responseBody)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const responseBody: ResponseBody = { error: message, data: null }
    return c.json(responseBody, 500)
  }
})

// Public read (serves images)
app.get('/:fileId', async (c) => {
  const fileId = (c.req.param('fileId') || '').trim()
  if (!fileId) return c.text('Not Found', 404)

  const requestUrl = new URL(c.req.url)

  // Use default cache
  const cache = caches.default
  const cached = await cache.match(requestUrl.toString())
  if (cached) return cached

  const obj = await c.env.BUCKET.get(fileId)
  if (!obj) return c.text('Not Found', 404)

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.etag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')

  const res = new Response(obj.body, { headers })
  c.executionCtx.waitUntil(cache.put(requestUrl.toString(), res.clone()))
  return res
})

// Health
app.get('/health', (c) => c.text('ok'))

export default app
