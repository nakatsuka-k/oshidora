import { Hono } from 'hono'

type Bindings = {
  PUBLIC_BASE_URL?: string
  PUBLIC_UPLOAD_ENABLED?: string
  BUCKET: R2Bucket
}

type ResponseBody =
  | { error: null; data: { fileId: string; url: string } }
  | { error: string; data: null }

const MAX_IMAGE_SIZE_MB = 32
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

const MAX_FILE_SIZE_MB = 32
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_FILE_TYPES = new Set(['application/pdf'])

function jsonError(message: string, status = 500): { status: number; body: ResponseBody } {
  return { status, body: { error: message, data: null } }
}

const app = new Hono<{ Bindings: Bindings }>()

app.onError((err, c) => {
  const status = typeof (err as any)?.status === 'number' ? Number((err as any).status) : 500
  const message = err instanceof Error ? err.message : 'Unknown error'
  const { status: s, body } = jsonError(message, status)
  return c.json(body, s as any)
})

// CORS
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'PUT,POST,GET,HEAD,OPTIONS')
  const requestedHeaders =
    (c.req.header('access-control-request-headers') || c.req.header('Access-Control-Request-Headers') || '').trim()
  const allowHeaders = requestedHeaders || 'Content-Type, Authorization'
  c.header('Access-Control-Allow-Headers', allowHeaders)
  c.header('Access-Control-Max-Age', '86400')

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204 as any)
  }

  await next()
})

function requireEnabled(c: any) {
  const enabled = (c.env.PUBLIC_UPLOAD_ENABLED || '').trim() === '1'
  if (!enabled) {
    const { status, body } = jsonError('PUBLIC_UPLOAD_ENABLED is not enabled', 403)
    return c.json(body, status as any)
  }
  return null
}

app.put('/cms/images', async (c) => {
  const gate = requireEnabled(c)
  if (gate) return gate

  const file = await c.req.blob()

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return c.json({ error: `ファイルサイズが${MAX_IMAGE_SIZE_MB}MBを超えています。`, data: null }, 413)
  }

  const contentType = (file.type || '').toLowerCase()
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return c.json({ error: 'アップロードできないファイルです。', data: null }, 400)
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

  return c.json({ error: null, data: { fileId, url } } satisfies ResponseBody)
})

app.put('/cms/files', async (c) => {
  const gate = requireEnabled(c)
  if (gate) return gate

  const file = await c.req.blob()

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return c.json({ error: `ファイルサイズが${MAX_FILE_SIZE_MB}MBを超えています。`, data: null }, 413)
  }

  const contentType = (file.type || '').toLowerCase()
  if (!ALLOWED_FILE_TYPES.has(contentType)) {
    return c.json({ error: 'アップロードできないファイルです。', data: null }, 400)
  }

  const fileId = crypto.randomUUID()

  await c.env.BUCKET.put(fileId, file, {
    httpMetadata: {
      contentType,
      cacheControl: 'private, max-age=0, no-store',
    },
  })

  const publicBaseUrl = (c.env.PUBLIC_BASE_URL || '').trim() || 'https://assets.oshidra.com'
  const url = `${publicBaseUrl.replace(/\/$/, '')}/${fileId}`

  return c.json({ error: null, data: { fileId, url } } satisfies ResponseBody)
})

export default app
