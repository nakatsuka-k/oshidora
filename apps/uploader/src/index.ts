import { Hono } from 'hono'
import type { JwtVariables } from 'hono/jwt'
import { jwt } from 'hono/jwt'

type Bindings = {
  JWT_SECRET?: string
  AUTH_JWT_SECRET?: string
  PUBLIC_BASE_URL?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_STREAM_API_TOKEN?: string
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
  c.header('Access-Control-Allow-Methods', 'PUT,POST,GET,HEAD,OPTIONS')
  const requestedHeaders =
    (c.req.header('access-control-request-headers') || c.req.header('Access-Control-Request-Headers') || '').trim()
  const allowHeaders =
    requestedHeaders || 'Content-Type, Authorization, Tus-Resumable, Upload-Length, Upload-Metadata'
  c.header('Access-Control-Allow-Headers', allowHeaders)
  c.header('Access-Control-Expose-Headers', 'Location, Stream-Media-ID, Tus-Resumable')
  c.header('Access-Control-Max-Age', '86400')

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204 as any)
  }

  await next()
})

// JWT for uploads only
app.use('*', async (c, next) => {
  if (c.req.method !== 'PUT') return next()

  // CMS routes use AUTH_JWT_SECRET (different token) and should not be validated with JWT_SECRET.
  try {
    const path = new URL(c.req.url).pathname
    if (path.startsWith('/cms/')) return next()
  } catch {
    // ignore
  }

  if (!c.env.JWT_SECRET || !c.env.JWT_SECRET.trim()) {
    const { status, body } = jsonError('JWT_SECRET is not configured', 501)
    return c.json(body, status as any)
  }

  const token = getBearerToken(c.req.header('authorization') || null)
  if (!token) {
    const { status, body } = jsonError('Authorization token is required', 401)
    return c.json(body, status as any)
  }

  // Run Hono jwt middleware (expects Authorization header)
  return jwt({ secret: c.env.JWT_SECRET })(c, next)
})

// CMS admin JWT (for image uploads)
app.use('/cms/images', async (c, next) => {
  if (c.req.method !== 'PUT') return next()

  const secret = (c.env.AUTH_JWT_SECRET || '').trim()
  if (!secret) {
    return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 501)
  }

  return jwt({ secret })(c, next)
})

app.put('/cms/images', async (c) => {
  const payload = (c.get('jwtPayload') as any) ?? null
  const kind = typeof payload?.kind === 'string' ? String(payload.kind) : ''
  const role = typeof payload?.role === 'string' ? String(payload.role) : ''
  const adminId = typeof payload?.adminId === 'string' ? String(payload.adminId) : ''
  if (kind !== 'cms' || role !== 'Admin' || !adminId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    const file = await c.req.blob()

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return c.json({ error: `ファイルサイズが${MAX_IMAGE_SIZE_MB}MBを超えています。` }, 413)
    }

    const contentType = (file.type || '').toLowerCase()
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return c.json({ error: 'アップロードできないファイルです。' }, 400)
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

    return c.json({ error: null, data: { fileId, url } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

// CMS admin JWT (for Stream direct-upload URL issuance)
app.use('/cms/stream/*', async (c, next) => {
  if (c.req.method !== 'POST') return next()

  const secret = (c.env.AUTH_JWT_SECRET || '').trim()
  if (!secret) {
    return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 501)
  }

  // Run Hono jwt middleware (expects Authorization header)
  return jwt({ secret })(c, next)
})

app.post('/cms/stream/tus', async (c) => {
  const payload = (c.get('jwtPayload') as any) ?? null
  const kind = typeof payload?.kind === 'string' ? String(payload.kind) : ''
  const role = typeof payload?.role === 'string' ? String(payload.role) : ''
  const adminId = typeof payload?.adminId === 'string' ? String(payload.adminId) : ''
  if (kind !== 'cms' || role !== 'Admin' || !adminId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const accountId = (c.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  const token = (c.env.CLOUDFLARE_STREAM_API_TOKEN || '').trim()
  if (!accountId || !token) {
    return c.json(
      {
        error: 'Cloudflare Stream is not configured',
        required: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN'],
      },
      500
    )
  }

  // Enforce 30GB max by Upload-Length
  const uploadLength = (c.req.header('upload-length') || '').trim()
  if (!uploadLength) {
    return c.json({ error: 'Upload-Length is required' }, 400)
  }
  const uploadLengthNum = Number(uploadLength)
  if (!Number.isFinite(uploadLengthNum) || uploadLengthNum <= 0) {
    return c.json({ error: 'Upload-Length must be a positive number' }, 400)
  }
  const max = 30 * 1024 * 1024 * 1024
  if (uploadLengthNum > max) {
    return c.json({ error: 'file_too_large', maxBytes: max }, 413)
  }

  const tusResumable = (c.req.header('tus-resumable') || '').trim() || '1.0.0'
  const uploadMetadata = (c.req.header('upload-metadata') || '').trim() || ''

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Tus-Resumable': tusResumable,
      'Upload-Length': String(uploadLengthNum),
      ...(uploadMetadata ? { 'Upload-Metadata': uploadMetadata } : {}),
    },
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    return c.json(
      {
        error: 'Failed to create tus upload URL',
        status: resp.status,
        detail: text.slice(0, 400),
      },
      502
    )
  }

  const location = resp.headers.get('Location')
  if (!location) {
    return c.json({ error: 'Missing Location header from Stream' }, 502)
  }

  const streamMediaId = resp.headers.get('Stream-Media-Id') || resp.headers.get('Stream-Media-ID')

  // CORS: expose Location + Stream-Media-ID so tus client can read it.
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Expose-Headers', 'Location, Stream-Media-ID, Tus-Resumable')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Tus-Resumable, Upload-Length, Upload-Metadata')
  c.header('Tus-Resumable', tusResumable)
  c.header('Location', location)
  if (streamMediaId) c.header('Stream-Media-ID', streamMediaId)

  return c.body(null, 201 as any)
})

app.post('/cms/stream/direct-upload', async (c) => {
  const payload = (c.get('jwtPayload') as any) ?? null
  const kind = typeof payload?.kind === 'string' ? String(payload.kind) : ''
  const role = typeof payload?.role === 'string' ? String(payload.role) : ''
  const adminId = typeof payload?.adminId === 'string' ? String(payload.adminId) : ''
  if (kind !== 'cms' || role !== 'Admin' || !adminId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const accountId = (c.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  const token = (c.env.CLOUDFLARE_STREAM_API_TOKEN || '').trim()
  if (!accountId || !token) {
    return c.json(
      {
        error: 'Cloudflare Stream is not configured',
        required: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN'],
      },
      500
    )
  }

  type DirectUploadBody = {
    maxDurationSeconds?: number
    metaName?: string
    requireSignedURLs?: boolean
    expectedSizeBytes?: unknown
  }

  const body: DirectUploadBody = await c.req.json<DirectUploadBody>().catch((): DirectUploadBody => ({}))

  const expectedSizeBytesNum = Number(body.expectedSizeBytes ?? NaN)
  if (Number.isFinite(expectedSizeBytesNum) && expectedSizeBytesNum > 0) {
    const max = 30 * 1024 * 1024 * 1024
    if (expectedSizeBytesNum > max) {
      return c.json(
        {
          error: 'file_too_large',
          maxBytes: max,
        },
        413
      )
    }
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maxDurationSeconds: typeof body.maxDurationSeconds === 'number' ? body.maxDurationSeconds : 60 * 60,
      requireSignedURLs: body.requireSignedURLs ?? true,
      meta: {
        name: String(body.metaName ?? 'upload').slice(0, 200) || 'upload',
      },
    }),
  })

  const data = (await resp.json().catch(() => null)) as
    | {
        success: boolean
        result?: any
        errors?: any[]
      }
    | null

  if (!resp.ok || !data?.success) {
    return c.json(
      {
        error: 'Failed to create direct upload URL',
        status: resp.status,
        errors: data?.errors ?? [],
      },
      502
    )
  }

  return c.json({
    uploadURL: data?.result?.uploadURL ?? null,
    uid: data?.result?.uid ?? null,
    expires: data?.result?.expires ?? null,
  })
})

app.put('/', async (c) => {
  try {
    const file = await c.req.blob()

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const { status, body } = jsonError(`ファイルサイズが${MAX_IMAGE_SIZE_MB}MBを超えています。`, 413)
      return c.json(body, status as any)
    }

    const contentType = (file.type || '').toLowerCase()
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      const { status, body } = jsonError('アップロードできないファイルです。', 400)
      return c.json(body, status as any)
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
