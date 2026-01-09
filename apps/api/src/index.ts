import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  Bindings: {
    DB: D1Database
    CLOUDFLARE_ACCOUNT_ID?: string
    R2_ACCESS_KEY_ID?: string
    R2_SECRET_ACCESS_KEY?: string
    R2_BUCKET?: string
    R2_PUBLIC_BASE_URL?: string
    CLOUDFLARE_STREAM_API_TOKEN?: string
    CLOUDFLARE_STREAM_SIGNING_KEY_ID?: string
    // Cloudflare Stream Signed URLs require an RSA signing key.
    // Store the *private* JWK returned by Cloudflare (data.result.jwk) as a secret.
    // For backward compat, we also accept it via CLOUDFLARE_STREAM_SIGNING_KEY_SECRET.
    CLOUDFLARE_STREAM_SIGNING_KEY_JWK?: string
    CLOUDFLARE_STREAM_SIGNING_KEY_SECRET?: string
  }
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i])
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlEncodeJson(value: unknown) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)))
}

function tryParseJwkFromString(value: string): JsonWebKey | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // 1) JSON string (recommended): {"kty":"RSA",...}
  if (trimmed.startsWith('{')) {
    try {
      const jwk = JSON.parse(trimmed) as JsonWebKey
      if (jwk && typeof jwk === 'object') return jwk
    } catch {
      return null
    }
  }

  // 2) Base64/Base64URL encoded JSON (Cloudflare sometimes returns this)
  // Common prefix for base64-encoded JSON is "eyJ".
  if (trimmed.startsWith('eyJ')) {
    try {
      // Convert base64url -> base64 then decode.
      let b64 = trimmed.replace(/-/g, '+').replace(/_/g, '/')
      const pad = b64.length % 4
      if (pad === 2) b64 += '=='
      else if (pad === 3) b64 += '='
      const json = atob(b64)
      const jwk = JSON.parse(json) as JsonWebKey
      if (jwk && typeof jwk === 'object') return jwk
    } catch {
      return null
    }
  }

  return null
}

async function signRs256(unsigned: string, jwk: JsonWebKey) {
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(unsigned))
  return base64UrlEncode(sig)
}

async function makeStreamSignedToken(params: {
  videoId: string
  keyId: string
  keyJwk: JsonWebKey
  expiresInSeconds?: number
}) {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (params.expiresInSeconds ?? 60 * 10)

  const header = { alg: 'RS256', typ: 'JWT', kid: params.keyId }
  const payload = { sub: params.videoId, exp }
  const unsigned = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`
  const signature = await signRs256(unsigned, params.keyJwk)
  return { token: `${unsigned}.${signature}`, exp }
}

const app = new Hono<Env>()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  })
)

app.get('/health', (c) => c.text('ok'))

function toHex(bytes: ArrayBuffer) {
  const u8 = new Uint8Array(bytes)
  let out = ''
  for (const b of u8) out += b.toString(16).padStart(2, '0')
  return out
}

function awsUriEncode(value: string) {
  // RFC3986 encode (AWS SigV4 requires encoding !'()* as well)
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function awsEncodePathPreserveSlash(path: string) {
  return path
    .split('/')
    .map((seg) => awsUriEncode(seg))
    .join('/')
}

function amzDateNow() {
  // YYYYMMDD'T'HHMMSS'Z'
  const iso = new Date().toISOString() // 2026-01-09T12:34:56.789Z
  return iso.replace(/[:-]/g, '').replace(/\.(\d{3})Z$/, 'Z')
}

async function sha256Hex(text: string) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(digest)
}

async function sha256HexBytes(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string) {
  const rawKey = key instanceof Uint8Array ? key : new Uint8Array(key)
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  return new Uint8Array(sig)
}

async function awsV4SigningKey(secretAccessKey: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  const kSigning = await hmacSha256(kService, 'aws4_request')
  return kSigning
}

async function awsV4Signature(opts: {
  method: string
  canonicalUri: string
  host: string
  contentType: string
  amzDate: string
  dateStamp: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
  payloadHash: string
}) {
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders =
    `content-type:${opts.contentType}\n` +
    `host:${opts.host}\n` +
    `x-amz-content-sha256:${opts.payloadHash}\n` +
    `x-amz-date:${opts.amzDate}\n`

  const canonicalRequest = [
    opts.method,
    opts.canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    opts.payloadHash,
  ].join('\n')

  const canonicalRequestHash = await sha256Hex(canonicalRequest)
  const scope = `${opts.dateStamp}/${opts.region}/${opts.service}/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${opts.amzDate}\n${scope}\n${canonicalRequestHash}`
  const signingKey = await awsV4SigningKey(opts.secretAccessKey, opts.dateStamp, opts.region, opts.service)
  const signatureBytes = await hmacSha256(signingKey, stringToSign)
  const signature = Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return { authorization, signedHeaders }
}

// R2 upload proxy: browser uploads -> this API -> server-side PUT to R2(S3)
// Avoids direct browser->R2 CORS issues.
app.put('/v1/r2/assets/*', async (c) => {
  const keyRaw = (c.req.param('*') || '').trim()
  if (!keyRaw) return c.json({ error: 'key is required' }, 400)
  if (keyRaw.includes('..')) return c.json({ error: 'invalid key' }, 400)

  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID
  const accessKeyId = c.env.R2_ACCESS_KEY_ID
  const secretAccessKey = c.env.R2_SECRET_ACCESS_KEY
  const bucket = (c.env.R2_BUCKET || 'assets').trim() || 'assets'
  const publicBaseUrl = (c.env.R2_PUBLIC_BASE_URL || 'https://pub-a2d549876dd24a08aebc65d95ed4ff91.r2.dev').trim()

  if (!accountId) return c.json({ error: 'CLOUDFLARE_ACCOUNT_ID is required' }, 500)
  if (!accessKeyId || !secretAccessKey) {
    return c.json(
      {
        error: 'R2 credentials are not configured',
        hint: 'Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY as Worker secrets.',
      },
      501
    )
  }

  const key = awsEncodePathPreserveSlash(keyRaw)
  const host = `${accountId}.r2.cloudflarestorage.com`
  const canonicalUri = `/${bucket}/${key}`
  const targetUrl = `https://${host}${canonicalUri}`

  const contentType = c.req.header('content-type')?.trim() || 'application/octet-stream'
  const amzDate = amzDateNow()
  const dateStamp = amzDate.slice(0, 8)

  // Buffer payload so we can compute x-amz-content-sha256 reliably.
  // This is more compatible than UNSIGNED-PAYLOAD across S3-compatible providers.
  const bodyBytes = await c.req.arrayBuffer()
  if (bodyBytes.byteLength > 10 * 1024 * 1024) {
    return c.json({ error: 'Payload too large (max 10MB)' }, 413)
  }
  const payloadHash = await sha256HexBytes(bodyBytes)

  const { authorization } = await awsV4Signature({
    method: 'PUT',
    canonicalUri,
    host,
    contentType,
    amzDate,
    dateStamp,
    accessKeyId,
    secretAccessKey,
    region: 'auto',
    service: 's3',
    payloadHash,
  })

  const upstreamResp = await fetch(targetUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorization,
    },
    body: bodyBytes,
  })

  if (!upstreamResp.ok) {
    const text = await upstreamResp.text().catch(() => '')
    return c.json(
      {
        error: 'Failed to upload to R2',
        status: upstreamResp.status,
        details: text.slice(0, 1000),
      },
      502
    )
  }

  return c.json({ publicUrl: `${publicBaseUrl}/${keyRaw}` })
})

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shareHtml(opts: {
  title: string
  description?: string
  url: string
  imageUrl?: string
}) {
  const title = escapeHtml(opts.title)
  const description = escapeHtml(opts.description ?? '')
  const url = escapeHtml(opts.url)
  const image = opts.imageUrl ? escapeHtml(opts.imageUrl) : ''

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ''}
</head>
<body>
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 16px;">
    <h1 style="font-size: 18px; margin: 0 0 8px;">${title}</h1>
    ${description ? `<p style="margin: 0 0 12px; color: #666;">${description}</p>` : ''}
    <p style="margin: 0;">このページは共有用です。</p>
  </main>
</body>
</html>`
}

// SNS share (browser) pages: provide OG meta so thumbnails appear in X/LINE/etc.
app.get('/share/work/:contentId', (c) => {
  const contentId = c.req.param('contentId')?.trim()
  if (!contentId) return c.text('contentId is required', 400)

  const title = (c.req.query('title') || '推しドラ').trim() || '推しドラ'
  const thumb = (c.req.query('thumb') || '').trim() || undefined

  const url = new URL(c.req.url)
  const html = shareHtml({
    title,
    description: `作品ID: ${contentId}`,
    url: url.toString(),
    imageUrl: thumb,
  })
  return c.html(html)
})

app.get('/share/cast/:castId', (c) => {
  const castId = c.req.param('castId')?.trim()
  if (!castId) return c.text('castId is required', 400)

  const title = (c.req.query('title') || '推しドラ').trim() || '推しドラ'
  const thumb = (c.req.query('thumb') || '').trim() || undefined

  const url = new URL(c.req.url)
  const html = shareHtml({
    title,
    description: `キャストID: ${castId}`,
    url: url.toString(),
    imageUrl: thumb,
  })
  return c.html(html)
})

app.get('/v1/stream/playback/:videoId', async (c) => {
  const videoId = c.req.param('videoId')?.trim()
  if (!videoId) return c.json({ error: 'videoId is required' }, 400)

  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID
  const token = c.env.CLOUDFLARE_STREAM_API_TOKEN

  // Always return the public endpoints so callers can still construct URLs during local/dev.
  // If the Stream video is configured as Signed URLs required, these URLs won't play without token=JWT.
  const basic = {
    videoId,
    iframeUrl: `https://iframe.videodelivery.net/${videoId}`,
    hlsUrl: `https://videodelivery.net/${videoId}/manifest/video.m3u8`,
    dashUrl: `https://videodelivery.net/${videoId}/manifest/video.mpd`,
    mp4Url: `https://videodelivery.net/${videoId}/downloads/default.mp4`,
  }

  if (!accountId || !token) {
    return c.json({
      ...basic,
      configured: false,
      note: 'Set CLOUDFLARE_STREAM_API_TOKEN to fetch Stream status via API.',
      readyToStream: null,
      status: null,
    })
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
          ...basic,
          configured: true,
          error: 'Failed to fetch Stream video info',
          status: resp.status,
          errors: data?.errors ?? [],
          readyToStream: null,
        },
        502
      )
    }

    const playback = data?.result?.playback ?? {}
    return c.json({
      ...basic,
      configured: true,
      hlsUrl: playback?.hls ?? basic.hlsUrl,
      dashUrl: playback?.dash ?? basic.dashUrl,
      readyToStream: data?.result?.readyToStream ?? null,
      status: data?.result?.status ?? null,
    })
  } catch (e) {
    return c.json(
      {
        ...basic,
        configured: true,
        error: 'Failed to fetch Stream video info (network)',
        message: e instanceof Error ? e.message : String(e),
        readyToStream: null,
        status: null,
      },
      502
    )
  }
})

// Private playback (Signed URLs)
app.get('/v1/stream/signed-playback/:videoId', async (c) => {
  const videoId = c.req.param('videoId')?.trim()
  if (!videoId) return c.json({ error: 'videoId is required' }, 400)

  const keyId = c.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID
  const jwkRaw = c.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK ?? c.env.CLOUDFLARE_STREAM_SIGNING_KEY_SECRET

  const keyJwk = jwkRaw ? tryParseJwkFromString(jwkRaw) : null

  if (!keyId || !keyJwk) {
    return c.json(
      {
        error: 'Cloudflare Stream Signed URL is not configured',
        required: ['CLOUDFLARE_STREAM_SIGNING_KEY_ID', 'CLOUDFLARE_STREAM_SIGNING_KEY_JWK'],
        note: 'Use the private JWK returned by Cloudflare (data.result.jwk). JSON or base64-encoded JSON is accepted.',
      },
      500
    )
  }

  const { token, exp } = await makeStreamSignedToken({
    videoId,
    keyId,
    keyJwk,
    expiresInSeconds: 60 * 10,
  })

  const tokenParam = `token=${encodeURIComponent(token)}`

  return c.json({
    videoId,
    expiresAt: exp,
    iframeUrl: `https://iframe.videodelivery.net/${videoId}?${tokenParam}`,
    hlsUrl: `https://videodelivery.net/${videoId}/manifest/video.m3u8?${tokenParam}`,
    dashUrl: `https://videodelivery.net/${videoId}/manifest/video.mpd?${tokenParam}`,
  })
})

// Client upload (Direct Upload URL)
app.post('/v1/stream/direct-upload', async (c) => {
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID
  const token = c.env.CLOUDFLARE_STREAM_API_TOKEN
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
  }

  const body: DirectUploadBody = await c.req.json<DirectUploadBody>().catch((): DirectUploadBody => ({}))

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maxDurationSeconds: typeof body.maxDurationSeconds === 'number' ? body.maxDurationSeconds : 60 * 30,
      requireSignedURLs: body.requireSignedURLs ?? true,
      meta: {
        name: body.metaName ?? 'upload',
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

type MockCast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

type MockVideo = {
  id: string
  title: string
  description: string
  ratingAvg: number
  reviewCount: number
  priceCoin?: number
  thumbnailUrl?: string
  castIds: string[]
}

const MOCK_CASTS: MockCast[] = [
  { id: 'a1', name: '松岡美沙', role: '出演者', thumbnailUrl: '' },
  { id: 'a2', name: '櫻井拓馬', role: '出演者', thumbnailUrl: '' },
  { id: 'a3', name: '監督太郎', role: '監督', thumbnailUrl: '' },
  { id: 'a4', name: 'Oshidora株式会社', role: '制作', thumbnailUrl: '' },
]

const MOCK_VIDEOS: MockVideo[] = [
  {
    id: 'v1',
    title: 'ダウトコール 第01話',
    description: '事件の幕開け。主人公が真相へ迫る。',
    ratingAvg: 4.7,
    reviewCount: 128,
    priceCoin: 0,
    thumbnailUrl: '',
    castIds: ['a1', 'a2', 'a3'],
  },
  {
    id: 'v2',
    title: 'ダウトコール 第02話',
    description: '新たな証言と裏切り。疑いは深まる。',
    ratingAvg: 4.6,
    reviewCount: 94,
    priceCoin: 30,
    thumbnailUrl: '',
    castIds: ['a1', 'a2', 'a3'],
  },
  {
    id: 'v3',
    title: 'ダウトコール 第03話',
    description: '見えない敵。真実はどこにあるのか。',
    ratingAvg: 4.8,
    reviewCount: 156,
    priceCoin: 30,
    thumbnailUrl: '',
    castIds: ['a1', 'a2', 'a3'],
  },
  {
    id: 'v4',
    title: 'ミステリーX 第01話',
    description: '不可解な失踪事件。密室の謎に挑む。',
    ratingAvg: 4.4,
    reviewCount: 61,
    priceCoin: 0,
    thumbnailUrl: '',
    castIds: ['a2', 'a3'],
  },
  {
    id: 'v5',
    title: 'ラブストーリーY 第01話',
    description: '偶然の出会い。少しずつ距離が近づく。',
    ratingAvg: 4.2,
    reviewCount: 43,
    priceCoin: 10,
    thumbnailUrl: '',
    castIds: ['a1'],
  },
]

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

app.get('/v1/cast', (c) => {
  const qRaw = c.req.query('q') ?? ''
  const q = normalizeQuery(qRaw)
  const items = !q
    ? MOCK_CASTS
    : MOCK_CASTS.filter((cast) => {
        const nameHit = normalizeQuery(cast.name).includes(q)
        const roleHit = normalizeQuery(cast.role).includes(q)
        return nameHit || roleHit
      })
  return c.json({
    items,
  })
})

app.get('/v1/videos', (c) => {
  return c.json({
    items: MOCK_VIDEOS.map((v) => ({
      id: v.id,
      title: v.title,
      ratingAvg: v.ratingAvg,
      reviewCount: v.reviewCount,
      priceCoin: v.priceCoin,
      thumbnailUrl: v.thumbnailUrl,
    })),
  })
})

app.get('/v1/comments', async (c) => {
  const contentId = (c.req.query('content_id') ?? '').trim()
  if (!contentId) return c.json({ error: 'content_id is required' }, 400)

  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') ?? 20) || 20))

  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const { results } = await c.env.DB.prepare(
    "SELECT id, author, body, created_at FROM comments WHERE content_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT ?"
  )
    .bind(contentId, limit)
    .all()

  return c.json({
    items: (results ?? []).map((r: any) => ({
      id: String(r.id ?? ''),
      author: String(r.author ?? ''),
      body: String(r.body ?? ''),
      createdAt: String(r.created_at ?? ''),
    })),
  })
})

app.post('/v1/comments', async (c) => {
  type Body = { contentId?: string; author?: string; body?: string }
  const body = await c.req.json<Body>().catch((): Body => ({}))

  const contentId = (body.contentId ?? '').trim()
  const author = (body.author ?? '').trim()
  const text = String(body.body ?? '')
  const trimmed = text.trim()

  if (!contentId) return c.json({ error: 'contentId is required' }, 400)
  if (!author) return c.json({ error: 'author is required' }, 400)
  if (!trimmed) return c.json({ error: 'body is required' }, 400)
  if (trimmed.length > 500) return c.json({ error: 'body is too long' }, 400)
  if (author.length > 50) return c.json({ error: 'author is too long' }, 400)

  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const status = 'pending'

  await c.env.DB.prepare(
    'INSERT INTO comments (id, content_id, author, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, contentId, author, trimmed, status, createdAt)
    .run()

  return c.json({ id, contentId, status, createdAt }, 201)
})

app.get('/v1/search', (c) => {
  const qRaw = c.req.query('q') ?? ''
  const q = normalizeQuery(qRaw)
  const limit = Math.max(1, Math.min(50, Number(c.req.query('limit') ?? 20) || 20))

  if (!q) {
    return c.json({ videos: [], casts: [] })
  }

  const casts = MOCK_CASTS.filter((cast) => normalizeQuery(cast.name).includes(q))
  const castIdHits = new Set(casts.map((c) => c.id))

  const videos = MOCK_VIDEOS.filter((video) => {
    const titleHit = normalizeQuery(video.title).includes(q)
    const descHit = normalizeQuery(video.description).includes(q)
    const castHit = video.castIds.some((id) => castIdHits.has(id))
    return titleHit || descHit || castHit
  })
    .slice(0, limit)
    .map((v) => ({
      id: v.id,
      title: v.title,
      ratingAvg: v.ratingAvg,
      reviewCount: v.reviewCount,
      priceCoin: v.priceCoin,
      thumbnailUrl: v.thumbnailUrl,
    }))

  return c.json({
    videos,
    casts: casts.slice(0, limit),
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

// Dev endpoints: mock login state for testing
let mockLoginState = false

app.get('/v1/dev/login-state', (c) => {
  return c.json({ loggedIn: mockLoginState })
})

app.post('/v1/dev/login-state', async (c) => {
  type Body = { loggedIn?: boolean }
  const body = await c.req.json<Body>().catch((): Body => ({}))
  const next = body.loggedIn
  if (typeof next === 'boolean') {
    mockLoginState = next
  }
  return c.json({ loggedIn: mockLoginState })
})

export default app
