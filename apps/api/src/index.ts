import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  Bindings: {
    DB: D1Database
    AUTH_JWT_SECRET?: string
    AUTH_CODE_PEPPER?: string
    ALLOW_DEBUG_RETURN_CODES?: string
    ADMIN_API_KEY?: string
    TWILIO_ACCOUNT_SID?: string
    TWILIO_AUTH_TOKEN?: string
    TWILIO_FROM?: string
    MAIL_FROM?: string
    MAIL_FROM_NAME?: string
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
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
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

function base64Encode(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64DecodeToBytes(base64: string) {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function pbkdf2HashPassword(password: string, saltBytes: Uint8Array, iterations = 120_000) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    32 * 8
  )
  return new Uint8Array(bits)
}

async function hashPasswordForStorage(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2HashPassword(password, salt)
  return {
    saltB64: base64Encode(salt),
    hashB64: base64Encode(hash),
  }
}

async function verifyPassword(password: string, saltB64: string, hashB64: string) {
  const salt = base64DecodeToBytes(saltB64)
  const expected = base64DecodeToBytes(hashB64)
  const actual = await pbkdf2HashPassword(password, salt)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

async function hs256Sign(secret: string, unsigned: string) {
  const sig = await hmacSha256(new TextEncoder().encode(secret), unsigned)
  return base64UrlEncode(sig)
}

async function makeJwtHs256(secret: string, payload: Record<string, unknown>, expiresInSeconds = 60 * 60 * 24 * 7) {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + expiresInSeconds
  const header = { alg: 'HS256', typ: 'JWT' }
  const body = { ...payload, iat: now, exp }
  const unsigned = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(body)}`
  const signature = await hs256Sign(secret, unsigned)
  return `${unsigned}.${signature}`
}

function base64UrlDecodeToString(value: string) {
  let b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad === 2) b64 += '=='
  else if (pad === 3) b64 += '='
  return atob(b64)
}

async function verifyJwtHs256(secret: string, token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts
  const unsigned = `${h}.${p}`
  const expected = await hs256Sign(secret, unsigned)
  if (expected !== s) return null

  try {
    const payload = JSON.parse(base64UrlDecodeToString(p)) as any
    const exp = typeof payload?.exp === 'number' ? payload.exp : null
    if (typeof exp === 'number' && Math.floor(Date.now() / 1000) > exp) return null
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

function digitsOnly(value: string) {
  return value.replace(/\D+/g, '')
}

function normalizePhoneDigitsForJP(value: string) {
  const digits = digitsOnly(value)
  // Accept domestic JP formats like 090xxxxxxxx / 080xxxxxxxx / 070xxxxxxxx and normalize to E.164 digits (81...)
  if (digits.startsWith('0') && (digits.length === 10 || digits.length === 11)) {
    return `81${digits.slice(1)}`
  }
  return digits
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function shouldReturnDebugCodes(env: Env['Bindings']) {
  return String(env.ALLOW_DEBUG_RETURN_CODES ?? '').trim() === '1'
}

function makeRandomDigits(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes)
    .map((b) => String(b % 10))
    .join('')
}

async function hashVerificationCode(code: string, pepper: string) {
  return sha256Hex(`${pepper}:${code}`)
}

async function sendSmsViaTwilio(env: Env['Bindings'], to: string, body: string) {
  const accountSid = (env.TWILIO_ACCOUNT_SID ?? '').trim()
  const authToken = (env.TWILIO_AUTH_TOKEN ?? '').trim()
  const from = (env.TWILIO_FROM ?? '').trim()
  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      error: 'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM as secrets.',
      status: 501,
    }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const form = new URLSearchParams()
  form.set('To', to)
  form.set('From', from)
  form.set('Body', body)

  const auth = btoa(`${accountSid}:${authToken}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: `Twilio error: ${res.status} ${text}`.slice(0, 500), status: 502 }
  }
  return { ok: true }
}

async function sendEmailViaMailChannels(env: Env['Bindings'], to: string, subject: string, text: string) {
  const from = (env.MAIL_FROM ?? '').trim()
  const fromName = (env.MAIL_FROM_NAME ?? 'Oshidora').trim() || 'Oshidora'
  if (!from) {
    return {
      ok: false,
      error: 'Email is not configured. Set MAIL_FROM (e.g. no-reply@your-domain).',
      status: 501,
    }
  }

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: fromName },
    subject,
    content: [{ type: 'text/plain', value: text }],
  }

  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    return { ok: false, error: `MailChannels error: ${res.status} ${msg}`.slice(0, 500), status: 502 }
  }
  return { ok: true }
}

async function requireAuth(c: any) {
  const auth = c.req.header('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  const token = m?.[1] || ''
  const secret = (c.env.AUTH_JWT_SECRET ?? '').trim()
  if (!secret) return { ok: false, status: 500, error: 'AUTH_JWT_SECRET is not configured' as const }
  const payload = token ? await verifyJwtHs256(secret, token) : null
  if (!payload) return { ok: false, status: 401, error: 'Unauthorized' as const }
  const userId = typeof payload.userId === 'string' ? payload.userId : ''
  const stage = typeof payload.stage === 'string' ? payload.stage : ''
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized' as const }
  return { ok: true, userId, stage, payload } as const
}

async function requireAdmin(c: any) {
  const auth = await requireAuth(c)
  if (!auth.ok) return auth

  const expected = (c.env.ADMIN_API_KEY ?? '').trim()
  if (!expected) return { ok: false, status: 500, error: 'ADMIN_API_KEY is not configured' as const }

  const provided = (c.req.header('x-admin-key') ?? '').trim()
  if (!provided || provided !== expected) return { ok: false, status: 403, error: 'Forbidden' as const }

  return auth
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
app.put('/v1/r2/assets/:path*', async (c) => {
  const prefix = '/v1/r2/assets/'
  const keyFromParam = (c.req.param('path') || '').trim()
  const keyFromPath = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length).trim() : ''

  let keyRaw = (keyFromParam || keyFromPath).trim()
  try {
    keyRaw = decodeURIComponent(keyRaw)
  } catch {
    // keep as-is
  }

  if (!keyRaw) {
    return c.json({
      error: 'key is required',
      debug: {
        method: c.req.method,
        path: c.req.path,
        prefix,
        keyFromParam,
        keyFromPath,
        url: c.req.url,
      },
    }, 400)
  }
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
  const toItem = (w: MockWork) => ({
    id: w.id,
    title: w.title,
    thumbnailUrl: w.thumbnailUrl ?? '',
  })

  const byViewsSorted = [...MOCK_WORKS].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
  const byRatingSorted = [...MOCK_WORKS].sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))

  const maxViews = Math.max(1, ...MOCK_WORKS.map((w) => w.viewCount ?? 0))
  const maxPurchasers = Math.max(1, ...MOCK_WORKS.map((w) => w.purchaserCount ?? 0))
  const maxRevenue = Math.max(1, ...MOCK_WORKS.map((w) => w.revenueCoin ?? 0))
  const maxRating = 5

  const scoreOverall = (w: MockWork) => {
    const views = (w.viewCount ?? 0) / maxViews
    const rating = (w.ratingAvg ?? 0) / maxRating
    const purchasers = (w.purchaserCount ?? 0) / maxPurchasers
    const revenue = (w.revenueCoin ?? 0) / maxRevenue
    return views * 3 + rating * 3 + purchasers * 3 + revenue * 1
  }

  const overallSorted = [...MOCK_WORKS].sort((a, b) => scoreOverall(b) - scoreOverall(a))

  return c.json({
    pickup: MOCK_WORKS.slice(0, 6).map(toItem),
    recommended: byRatingSorted.slice(0, 6).map(toItem),
    rankings: {
      byViews: byViewsSorted.slice(0, 5).map(toItem),
      byRating: byRatingSorted.slice(0, 5).map(toItem),
      overall: overallSorted.slice(0, 5).map(toItem),
    },
  })
})

type MockNotice = {
  id: string
  title: string
  publishedAt: string
  excerpt: string
  bodyHtml: string
}

const MOCK_NOTICES: MockNotice[] = [
  {
    id: 'n1',
    title: '新機能追加のお知らせ',
    publishedAt: '2026-01-10 10:00',
    excerpt: '本日より新機能を追加しました。より快適に視聴できるよう改善しています。',
    bodyHtml:
      '<p>本日より新機能を追加しました。より快適に視聴できるよう改善しています。</p><p><strong>主な変更点</strong></p><p>・トップ画面右上のベルからお知らせ一覧を確認できます。</p><p>・お知らせ詳細はHTMLで表示されます。</p>',
  },
  {
    id: 'n2',
    title: 'キャンペーン開催のお知らせ',
    publishedAt: '2026-01-09 18:00',
    excerpt: '期間限定キャンペーンを開催します。詳しくはお知らせ詳細をご確認ください。',
    bodyHtml:
      '<p>期間限定キャンペーンを開催します。</p><p>詳しくはキャンペーンページをご確認ください。</p><p><a href="https://oshidora.example.com">キャンペーン詳細</a></p>',
  },
]

app.get('/v1/notices', (c) => {
  return c.json({
    items: MOCK_NOTICES.map(({ bodyHtml: _bodyHtml, ...rest }) => rest),
  })
})

app.get('/v1/notices/:id', (c) => {
  const id = c.req.param('id')
  const item = MOCK_NOTICES.find((n) => n.id === id) ?? null
  return c.json({ item })
})

app.post('/v1/inquiries', async (c) => {
  // NOTE: モック。実運用ではDB保存＋管理者通知（メール等）を行う。
  const body = (await c.req.json().catch(() => null)) as any
  if (!body || typeof body.subject !== 'string' || typeof body.body !== 'string') {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  return c.json({ ok: true })
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
  genres: string[]
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
  categoryId: string
  tags: string[]
  viewCount?: number
  purchaserCount?: number
  revenueCoin?: number
}

const MOCK_CASTS: MockCast[] = [
  { id: 'a1', name: '松岡美沙', role: '出演者', genres: ['女優'], thumbnailUrl: '' },
  { id: 'a2', name: '櫻井拓馬', role: '出演者', genres: ['俳優'], thumbnailUrl: '' },
  { id: 'a3', name: '監督太郎', role: '監督', genres: ['監督'], thumbnailUrl: '' },
  { id: 'a4', name: 'Oshidora株式会社', role: '制作', genres: ['制作'], thumbnailUrl: '' },
]

const MOCK_VIDEOS: MockVideo[] = [
  {
    id: 'v1',
    title: 'ダウトコール 第01話',
    description: '事件の幕開け。主人公が真相へ迫る。',
    ratingAvg: 4.7,
    reviewCount: 128,
    viewCount: 12800,
    purchaserCount: 420,
    revenueCoin: 0,
    priceCoin: 0,
    thumbnailUrl: '',
    castIds: ['a1', 'a2', 'a3'],
    categoryId: 'c1',
    tags: ['Drama', 'Mystery'],
  },
  {
    id: 'v2',
    title: 'ダウトコール 第02話',
    description: '新たな証言と裏切り。疑いは深まる。',
    ratingAvg: 4.6,
    reviewCount: 94,
    viewCount: 9400,
    purchaserCount: 310,
    revenueCoin: 9300,
    priceCoin: 30,
    thumbnailUrl: '',
    castIds: ['a1', 'a2', 'a3'],
    categoryId: 'c1',
    tags: ['Drama', 'Mystery'],
  },
  {
    id: 'v3',
    title: 'ダウトコール 第03話',
    description: '見えない敵。真実はどこにあるのか。',
    ratingAvg: 4.8,
    reviewCount: 156,
    viewCount: 15600,
    purchaserCount: 520,
    revenueCoin: 15600,
    priceCoin: 30,
    thumbnailUrl: '',
    castIds: ['a1', 'a2', 'a3'],
    categoryId: 'c1',
    tags: ['Drama', 'Mystery'],
  },
  {
    id: 'v4',
    title: 'ミステリーX 第01話',
    description: '不可解な失踪事件。密室の謎に挑む。',
    ratingAvg: 4.4,
    reviewCount: 61,
    viewCount: 6100,
    purchaserCount: 150,
    revenueCoin: 0,
    priceCoin: 0,
    thumbnailUrl: '',
    castIds: ['a2', 'a3'],
    categoryId: 'c2',
    tags: ['Mystery'],
  },
  {
    id: 'v5',
    title: 'ラブストーリーY 第01話',
    description: '偶然の出会い。少しずつ距離が近づく。',
    ratingAvg: 4.2,
    reviewCount: 43,
    viewCount: 4300,
    purchaserCount: 180,
    revenueCoin: 1800,
    priceCoin: 10,
    thumbnailUrl: '',
    castIds: ['a1'],
    categoryId: 'c3',
    tags: ['Romance'],
  },
  {
    id: 'v6',
    title: 'コメディZ 第01話',
    description: '笑いと涙のドタバタ劇。',
    ratingAvg: 4.1,
    reviewCount: 22,
    viewCount: 5200,
    purchaserCount: 90,
    revenueCoin: 0,
    priceCoin: 0,
    thumbnailUrl: '',
    castIds: ['a2'],
    categoryId: 'c4',
    tags: ['Comedy'],
  },
  {
    id: 'v7',
    title: 'アクションW 第01話',
    description: '息をのむ追跡劇が始まる。',
    ratingAvg: 4.3,
    reviewCount: 37,
    viewCount: 7000,
    purchaserCount: 210,
    revenueCoin: 4200,
    priceCoin: 20,
    thumbnailUrl: '',
    castIds: ['a1', 'a3'],
    categoryId: 'c5',
    tags: ['Action'],
  },
]

type MockWork = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  priceCoin?: number
  thumbnailUrl?: string
  categoryId: string
  tags: string[]
  viewCount?: number
  purchaserCount?: number
  revenueCoin?: number
}

const WORK_ID_BY_TITLE: Record<string, string> = {
  'ダウトコール': 'content-1',
  'ミステリーX': 'content-2',
  'ラブストーリーY': 'content-3',
  'コメディZ': 'content-4',
  'アクションW': 'content-5',
}

function workTitleFromVideoTitle(title: string) {
  const t = String(title ?? '').trim()
  const idx = t.indexOf(' 第')
  if (idx <= 0) return t
  return t.slice(0, idx).trim()
}

function buildMockWorksFromVideos(videos: MockVideo[]): MockWork[] {
  const groups = new Map<string, MockVideo[]>()
  for (const v of videos) {
    const key = workTitleFromVideoTitle(v.title)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(v)
  }

  const works: MockWork[] = []
  for (const [workTitle, eps] of groups.entries()) {
    const reviewCount = eps.reduce((acc, it) => acc + (Number.isFinite(it.reviewCount) ? it.reviewCount : 0), 0)
    const ratingSum = eps.reduce((acc, it) => {
      const r = Number.isFinite(it.ratingAvg) ? it.ratingAvg : 0
      const w = Number.isFinite(it.reviewCount) ? it.reviewCount : 0
      return acc + r * w
    }, 0)
    const ratingAvg = reviewCount > 0 ? Math.round((ratingSum / reviewCount) * 10) / 10 : 0

    const priceCoin = Math.max(0, ...eps.map((it) => (typeof it.priceCoin === 'number' ? it.priceCoin : 0)))
    const thumbnailUrl = eps.find((it) => (it.thumbnailUrl ?? '').trim())?.thumbnailUrl ?? ''

    const categoryCount = new Map<string, number>()
    for (const it of eps) {
      const cid = String(it.categoryId ?? '').trim()
      if (!cid) continue
      categoryCount.set(cid, (categoryCount.get(cid) ?? 0) + 1)
    }
    const categoryId = Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'c1'

    const tags = Array.from(
      new Set(
        eps
          .flatMap((it) => (Array.isArray(it.tags) ? it.tags : []))
          .map((t) => String(t ?? '').trim())
          .filter((t) => t)
      )
    )

    const viewCount = eps.reduce((acc, it) => acc + (Number.isFinite(it.viewCount) ? (it.viewCount ?? 0) : 0), 0)
    const purchaserCount = eps.reduce(
      (acc, it) => acc + (Number.isFinite(it.purchaserCount) ? (it.purchaserCount ?? 0) : 0),
      0
    )
    const revenueCoin = eps.reduce((acc, it) => acc + (Number.isFinite(it.revenueCoin) ? (it.revenueCoin ?? 0) : 0), 0)

    works.push({
      id: WORK_ID_BY_TITLE[workTitle] ?? workTitle,
      title: workTitle,
      ratingAvg,
      reviewCount,
      priceCoin,
      thumbnailUrl,
      categoryId,
      tags,
      viewCount,
      purchaserCount,
      revenueCoin,
    })
  }

  const order = ['ダウトコール', 'ミステリーX', 'ラブストーリーY', 'コメディZ', 'アクションW']
  return works.sort((a, b) => {
    const ai = order.indexOf(a.title)
    const bi = order.indexOf(b.title)
    if (ai === -1 && bi === -1) return a.title.localeCompare(b.title)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

const MOCK_WORKS: MockWork[] = buildMockWorksFromVideos(MOCK_VIDEOS)

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

app.get('/v1/cast', (c) => {
  const qRaw = c.req.query('q') ?? ''
  const q = normalizeQuery(qRaw)
  const genreRaw = c.req.query('genre') ?? ''
  const genre = normalizeQuery(genreRaw)
  const items = !q
    ? MOCK_CASTS
    : MOCK_CASTS.filter((cast) => {
        const nameHit = normalizeQuery(cast.name).includes(q)
        const roleHit = normalizeQuery(cast.role).includes(q)
        const genreHit = (cast.genres ?? []).some((g) => normalizeQuery(g).includes(q))
        return nameHit || roleHit || genreHit
      })

  const filteredByGenre = genre
    ? items.filter((cast) => (cast.genres ?? []).some((g) => normalizeQuery(g) === genre))
    : items

  return c.json({
    items: filteredByGenre,
  })
})

async function handleCreateWithdrawalRequest(c: any) {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { email?: unknown; reason?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = String(body.email ?? '').trim()
  const reason = String(body.reason ?? '').trim()

  if (!email) return c.json({ error: 'email is required' }, 400)
  if (email.length > 200) return c.json({ error: 'email is too long' }, 400)
  if (reason.length > 500) return c.json({ error: 'reason is too long (max 500)' }, 400)

  const id = (globalThis as any).crypto?.randomUUID
    ? crypto.randomUUID()
    : `wr_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const createdAt = new Date().toISOString()

  try {
    await c.env.DB.prepare(
      'INSERT INTO withdrawal_requests (id, user_id, email, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(id, auth.userId, email, reason, 'pending', createdAt)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true, id, status: 'pending', createdAt })
}

async function handleAdminListWithdrawalRequests(c: any) {
  const admin = await requireAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const statusRaw = String(c.req.query('status') ?? '').trim().toLowerCase()
  const limitRaw = String(c.req.query('limit') ?? '').trim()
  const offsetRaw = String(c.req.query('offset') ?? '').trim()

  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 50
  const offsetParsed = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0
  const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 1), 200) : 50
  const offset = Number.isFinite(offsetParsed) ? Math.max(offsetParsed, 0) : 0

  const allowedStatuses = new Set(['pending', 'approved', 'rejected'])
  if (statusRaw && !allowedStatuses.has(statusRaw)) {
    return c.json({ error: 'invalid status' }, 400)
  }

  const baseSql =
    'SELECT id, user_id, email, reason, status, created_at, decided_at, decided_by, decision_note FROM withdrawal_requests'
  const sql = statusRaw
    ? `${baseSql} WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    : `${baseSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`

  let rows: any[] = []
  try {
    const stmt = db.prepare(sql)
    const res = statusRaw ? await stmt.bind(statusRaw, limit, offset).all() : await stmt.bind(limit, offset).all()
    rows = (res.results ?? []) as any[]
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    userId: String(r.user_id ?? ''),
    email: String(r.email ?? ''),
    reason: String(r.reason ?? ''),
    status: String(r.status ?? ''),
    createdAt: String(r.created_at ?? ''),
    decidedAt: r.decided_at == null ? null : String(r.decided_at),
    decidedBy: r.decided_by == null ? null : String(r.decided_by),
    decisionNote: r.decision_note == null ? null : String(r.decision_note),
  }))

  return c.json({ items, limit, offset })
}

async function handleAdminDecideWithdrawalRequest(c: any) {
  const admin = await requireAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { decision?: unknown; note?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const decision = String(body.decision ?? '').trim().toLowerCase()
  const note = String(body.note ?? '').trim()

  if (decision !== 'approve' && decision !== 'reject') {
    return c.json({ error: "decision must be 'approve' or 'reject'" }, 400)
  }
  if (note.length > 500) return c.json({ error: 'note is too long (max 500)' }, 400)

  const nextStatus = decision === 'approve' ? 'approved' : 'rejected'
  const decidedAt = new Date().toISOString()
  const decidedBy = String((admin as any).userId ?? '')

  try {
    const existing = await db.prepare('SELECT id, status FROM withdrawal_requests WHERE id = ?').bind(id).first<any>()
    if (!existing) return c.json({ error: 'not_found' }, 404)
    const currentStatus = String(existing.status ?? '')
    if (currentStatus !== 'pending') {
      return c.json({ error: 'already_decided', status: currentStatus }, 409)
    }

    await db.prepare(
      'UPDATE withdrawal_requests SET status = ?, decided_at = ?, decided_by = ?, decision_note = ? WHERE id = ?'
    )
      .bind(nextStatus, decidedAt, decidedBy, note, id)
      .run()

    const row = await db.prepare(
      'SELECT id, user_id, email, reason, status, created_at, decided_at, decided_by, decision_note FROM withdrawal_requests WHERE id = ?'
    )
      .bind(id)
      .first<any>()

    return c.json({
      ok: true,
      item: {
        id: String(row?.id ?? ''),
        userId: String(row?.user_id ?? ''),
        email: String(row?.email ?? ''),
        reason: String(row?.reason ?? ''),
        status: String(row?.status ?? ''),
        createdAt: String(row?.created_at ?? ''),
        decidedAt: row?.decided_at == null ? null : String(row.decided_at),
        decidedBy: row?.decided_by == null ? null : String(row.decided_by),
        decisionNote: row?.decision_note == null ? null : String(row.decision_note),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
}

app.post('/v1/withdrawal-requests', (c) => handleCreateWithdrawalRequest(c))

app.get('/v1/admin/withdrawal-requests', (c) => handleAdminListWithdrawalRequests(c))
app.post('/v1/admin/withdrawal-requests/:id/decision', (c) => handleAdminDecideWithdrawalRequest(c))

async function handleGetFavoriteCasts(c: any) {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  let rows: Array<{ cast_id?: unknown; created_at?: unknown }> = []
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT cast_id, created_at FROM favorite_casts WHERE user_id = ? ORDER BY created_at DESC'
    )
      .bind(auth.userId)
      .all()
    rows = (results ?? []) as any
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => {
    const id = String(r.cast_id ?? '')
    const found = MOCK_CASTS.find((x) => x.id === id)
    return {
      id,
      name: found?.name ?? '',
      role: found?.role ?? '',
      thumbnailUrl: found?.thumbnailUrl ?? '',
    }
  })

  return c.json({ items })
}

async function handleDeleteFavoriteCasts(c: any) {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { castIds?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const raw = body.castIds
  if (!Array.isArray(raw)) return c.json({ error: 'castIds must be an array' }, 400)

  const castIds = Array.from(
    new Set(
      raw
        .map((v) => String(v ?? '').trim())
        .filter((v) => v)
    )
  )

  if (castIds.length === 0) return c.json({ error: 'castIds is required' }, 400)
  if (castIds.length > 100) return c.json({ error: 'castIds is too large (max 100)' }, 400)

  const placeholders = castIds.map(() => '?').join(',')
  try {
    await c.env.DB.prepare(`DELETE FROM favorite_casts WHERE user_id = ? AND cast_id IN (${placeholders})`)
      .bind(auth.userId, ...castIds)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ deleted: castIds.length })
}

app.get('/v1/favorites/casts', handleGetFavoriteCasts)
app.delete('/v1/favorites/casts', handleDeleteFavoriteCasts)

// Design-doc compatibility (docs/アプリ/* use /api/...)
app.get('/api/favorites/casts', handleGetFavoriteCasts)
app.delete('/api/favorites/casts', handleDeleteFavoriteCasts)
app.get('/v1/videos', (c) => {
  const categoryId = String(c.req.query('category_id') ?? '').trim()
  const tag = normalizeQuery(String(c.req.query('tag') ?? ''))

  let items = MOCK_VIDEOS
  if (categoryId) {
    items = items.filter((v) => v.categoryId === categoryId)
  }
  if (tag) {
    items = items.filter((v) => v.tags.some((t) => normalizeQuery(t) === tag))
  }

  return c.json({
    items: items.map((v) => ({
      id: v.id,
      title: v.title,
      ratingAvg: v.ratingAvg,
      reviewCount: v.reviewCount,
      priceCoin: v.priceCoin,
      thumbnailUrl: v.thumbnailUrl,
      tags: v.tags,
    })),
  })
})

app.get('/v1/comments', async (c) => {
  const contentId = (c.req.query('content_id') ?? '').trim()
  if (!contentId) return c.json({ error: 'content_id is required' }, 400)

  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') ?? 20) || 20))

  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const { results } = await c.env.DB.prepare(
    "SELECT id, author, body, episode_id, created_at FROM comments WHERE content_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT ?"
  )
    .bind(contentId, limit)
    .all()

  return c.json({
    items: (results ?? []).map((r: any) => ({
      id: String(r.id ?? ''),
      author: String(r.author ?? ''),
      body: String(r.body ?? ''),
      episodeId: String(r.episode_id ?? ''),
      createdAt: String(r.created_at ?? ''),
    })),
  })
})

// --- Reviews (mock + API compatibility) ---
// NOTE: This is a minimal API to support UI "評価表示" with a mock fallback.
// Persistence is not implemented yet (in-memory only for POST).

type ReviewItem = { id: string; rating: number; comment: string; createdAt: string }
type ReviewSummary = { ratingAvg: number; reviewCount: number }

const MOCK_WORK_REVIEW_SUMMARY: Record<string, ReviewSummary> = {
  // Work/content ids (and common aliases used by the app)
  'content-1': { ratingAvg: 4.7, reviewCount: 128 },
  'content-2': { ratingAvg: 4.4, reviewCount: 61 },
  'content-3': { ratingAvg: 4.2, reviewCount: 43 },
  'content-4': { ratingAvg: 4.1, reviewCount: 38 },
  p1: { ratingAvg: 4.7, reviewCount: 128 },
  p2: { ratingAvg: 4.7, reviewCount: 128 },
  p3: { ratingAvg: 4.7, reviewCount: 128 },
  r1: { ratingAvg: 4.7, reviewCount: 128 },
  r2: { ratingAvg: 4.4, reviewCount: 61 },
  r3: { ratingAvg: 4.2, reviewCount: 43 },
  r4: { ratingAvg: 4.1, reviewCount: 38 },
  f1: { ratingAvg: 4.7, reviewCount: 128 },
  f2: { ratingAvg: 4.4, reviewCount: 61 },
  f3: { ratingAvg: 4.2, reviewCount: 43 },
  v1: { ratingAvg: 4.7, reviewCount: 128 },
  v2: { ratingAvg: 4.6, reviewCount: 94 },
  v3: { ratingAvg: 4.8, reviewCount: 156 },
  v4: { ratingAvg: 4.4, reviewCount: 61 },
  v5: { ratingAvg: 4.2, reviewCount: 43 },
}

const MOCK_CAST_REVIEW_SUMMARY: Record<string, ReviewSummary> = {
  // Cast ids used by the app mock
  cast1: { ratingAvg: 4.8, reviewCount: 12 },
}

// In-memory review items (non-persistent)
const WORK_REVIEWS: Record<string, ReviewItem[]> = {
  'content-1': [{ id: 'wr1', rating: 5, comment: '最高！', createdAt: '2026-01-10T00:00:00.000Z' }],
}

const CAST_REVIEWS: Record<string, ReviewItem[]> = {
  cast1: [
    { id: 'cr1', rating: 5, comment: '最高でした！', createdAt: '2026-01-10T00:00:00.000Z' },
    { id: 'cr2', rating: 4, comment: '応援してます', createdAt: '2026-01-09T00:00:00.000Z' },
  ],
}

function buildSummaryFromItems(items: ReviewItem[], fallback: ReviewSummary): ReviewSummary {
  if (!items.length) return fallback
  const sum = items.reduce((acc, it) => acc + (Number.isFinite(it.rating) ? it.rating : 0), 0)
  const avg = sum / Math.max(1, items.length)
  return {
    ratingAvg: Math.round(avg * 10) / 10,
    reviewCount: items.length,
  }
}

app.get('/v1/reviews/work', (c) => {
  const contentId = String(c.req.query('content_id') ?? '').trim()
  if (!contentId) return c.json({ error: 'content_id is required' }, 400)
  const items = Array.isArray(WORK_REVIEWS[contentId]) ? WORK_REVIEWS[contentId] : []
  const fallback = MOCK_WORK_REVIEW_SUMMARY[contentId] ?? { ratingAvg: 4.5, reviewCount: 0 }
  const summary = buildSummaryFromItems(items, fallback)
  return c.json({ summary })
})

app.post('/v1/reviews/work', async (c) => {
  type Body = { contentId?: string; rating?: number; comment?: string }
  const body = (await c.req.json().catch((): Body => ({}))) as Body
  const contentId = String(body.contentId ?? '').trim()
  const rating = Number(body.rating)
  const comment = String(body.comment ?? '').trim()

  if (!contentId) return c.json({ error: 'contentId is required' }, 400)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return c.json({ error: 'rating must be 1..5' }, 400)
  if (comment.length > 500) return c.json({ error: 'comment is too long' }, 400)

  const item: ReviewItem = {
    id: crypto.randomUUID(),
    rating,
    comment,
    createdAt: new Date().toISOString(),
  }

  WORK_REVIEWS[contentId] = [item, ...(WORK_REVIEWS[contentId] ?? [])]
  return c.json({ ok: true, item }, 201)
})

app.get('/v1/reviews/cast', (c) => {
  const castId = String(c.req.query('cast_id') ?? '').trim()
  if (!castId) return c.json({ error: 'cast_id is required' }, 400)
  const items = Array.isArray(CAST_REVIEWS[castId]) ? CAST_REVIEWS[castId] : []
  const fallback = MOCK_CAST_REVIEW_SUMMARY[castId] ?? { ratingAvg: 4.5, reviewCount: 0 }
  const summary = buildSummaryFromItems(items, fallback)
  return c.json({ summary })
})

app.post('/v1/reviews/cast', async (c) => {
  type Body = { castId?: string; rating?: number; comment?: string }
  const body = (await c.req.json().catch((): Body => ({}))) as Body
  const castId = String(body.castId ?? '').trim()
  const rating = Number(body.rating)
  const comment = String(body.comment ?? '').trim()

  if (!castId) return c.json({ error: 'castId is required' }, 400)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return c.json({ error: 'rating must be 1..5' }, 400)
  if (comment.length > 500) return c.json({ error: 'comment is too long' }, 400)

  const item: ReviewItem = {
    id: crypto.randomUUID(),
    rating,
    comment,
    createdAt: new Date().toISOString(),
  }

  CAST_REVIEWS[castId] = [item, ...(CAST_REVIEWS[castId] ?? [])]
  return c.json({ ok: true, item }, 201)
})

app.post('/v1/comments', async (c) => {
  type Body = { contentId?: string; episodeId?: string; author?: string; body?: string }
  const body = (await c.req.json().catch((): Body => ({}))) as Body
  const contentId = String(body.contentId ?? '').trim()
  const episodeId = String(body.episodeId ?? '').trim()
  const author = String(body.author ?? '').trim()
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
    'INSERT INTO comments (id, content_id, episode_id, author, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, contentId, episodeId || null, author, trimmed, status, createdAt)
    .run()

  return c.json({ id, contentId, episodeId: episodeId || null, status, createdAt }, 201)
})

app.get('/v1/works', (c) => {
  const q = normalizeQuery(String(c.req.query('q') ?? ''))
  const categoryId = String(c.req.query('category_id') ?? '').trim()
  const tag = normalizeQuery(String(c.req.query('tag') ?? ''))

  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') ?? 20) || 20))
  const cursorRaw = String(c.req.query('cursor') ?? '').trim()
  const offset = cursorRaw ? Math.max(0, Number(cursorRaw) || 0) : 0

  let items = MOCK_WORKS
  if (q) {
    items = items.filter((w) => normalizeQuery(w.title).includes(q))
  }
  if (categoryId) {
    items = items.filter((w) => w.categoryId === categoryId)
  }
  if (tag) {
    items = items.filter((w) => w.tags.some((t) => normalizeQuery(t) === tag))
  }

  const page = items.slice(offset, offset + limit)
  const nextCursor = offset + limit < items.length ? String(offset + limit) : null

  return c.json({
    items: page.map((w) => ({
      id: w.id,
      title: w.title,
      ratingAvg: w.ratingAvg,
      reviewCount: w.reviewCount,
      priceCoin: w.priceCoin,
      thumbnailUrl: w.thumbnailUrl,
      tags: w.tags,
    })),
    nextCursor,
  })
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

// -----------------------------
// Auth (email + SMS)
// -----------------------------

function d1LikelyNotMigratedError(err: unknown) {
  const msg = String((err as any)?.message ?? err)
  return /no such table/i.test(msg) || /SQLITE_ERROR/i.test(msg)
}

function jsonD1SetupError(c: any, err: unknown) {
  const detail = String((err as any)?.message ?? err).slice(0, 300)
  return c.json(
    {
      error: 'db_not_migrated',
      message: 'D1 schema is missing. Run `npm run db:migrate:local` (or remote) in apps/api before calling DB-backed endpoints.',
      detail: shouldReturnDebugCodes(c.env) ? detail : undefined,
    },
    500
  )
}

app.post('/v1/auth/signup/start', async (c) => {
  type Body = { email?: string; password?: string }
  const body = await c.req.json<Body>().catch((): Body => ({}))
  const email = normalizeEmail(body.email ?? '')
  const password = String(body.password ?? '')
  if (!email) return c.json({ error: 'email is required' }, 400)
  if (!password.trim()) return c.json({ error: 'password is required' }, 400)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const now = new Date().toISOString()

  let existing: any
  try {
    existing = await c.env.DB.prepare('SELECT id, email_verified FROM users WHERE email = ?').bind(email).first<any>()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  if (existing && Number(existing.email_verified) === 1) {
    return c.json({ error: 'already_registered' }, 409)
  }

  const { saltB64, hashB64 } = await hashPasswordForStorage(password)
  const userId = existing?.id ? String(existing.id) : crypto.randomUUID()

  if (existing?.id) {
    try {
      await c.env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
        .bind(hashB64, saltB64, now, userId)
        .run()
    } catch (err) {
      if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
      throw err
    }
  } else {
    try {
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, email_verified, phone, phone_verified, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, 0, NULL, 0, ?, ?, ?, ?)'
      )
        .bind(userId, email, hashB64, saltB64, now, now)
        .run()
    } catch (err) {
      if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
      throw err
    }
  }

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const code = makeRandomDigits(6)
  const codeHash = await hashVerificationCode(code, pepper)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  try {
    await c.env.DB.prepare(
      'INSERT INTO verification_codes (id, user_id, kind, target, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(crypto.randomUUID(), userId, 'email', email, codeHash, expiresAt, now)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const mailRes = await sendEmailViaMailChannels(
    c.env,
    email,
    '【推しドラ】認証コード',
    `認証コード: ${code}\n\n有効期限: 10分\n`
  )

  const debugCode = shouldReturnDebugCodes(c.env) ? code : undefined
  if (!mailRes.ok) {
    if (debugCode) {
      return c.json({ ok: true, email, debugCode, warning: mailRes.error })
    }
    return c.json({ error: mailRes.error, debugCode }, (mailRes.status ?? 502) as any)
  }
  return c.json({ ok: true, email, debugCode })
})

app.post('/v1/auth/signup/email/resend', async (c) => {
  type Body = { email?: string }
  const body = await c.req.json<Body>().catch((): Body => ({}))
  const email = normalizeEmail(body.email ?? '')
  if (!email) return c.json({ error: 'email is required' }, 400)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const user = await c.env.DB.prepare('SELECT id, email_verified FROM users WHERE email = ?').bind(email).first<any>()
  if (!user) return c.json({ error: 'not_found' }, 404)
  if (Number(user.email_verified) === 1) return c.json({ error: 'already_verified' }, 409)

  const now = new Date().toISOString()
  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const code = makeRandomDigits(6)
  const codeHash = await hashVerificationCode(code, pepper)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO verification_codes (id, user_id, kind, target, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(crypto.randomUUID(), String(user.id), 'email', email, codeHash, expiresAt, now)
    .run()

  const mailRes = await sendEmailViaMailChannels(
    c.env,
    email,
    '【推しドラ】認証コード（再送）',
    `認証コード: ${code}\n\n有効期限: 10分\n`
  )

  const debugCode = shouldReturnDebugCodes(c.env) ? code : undefined
  if (!mailRes.ok) {
    if (debugCode) {
      return c.json({ ok: true, debugCode, warning: mailRes.error })
    }
    return c.json({ error: mailRes.error, debugCode }, (mailRes.status ?? 502) as any)
  }
  return c.json({ ok: true, debugCode })
})

app.post('/v1/auth/signup/email/verify', async (c) => {
  type Body = { email?: string; code?: string }
  const body = await c.req.json<Body>().catch((): Body => ({}))
  const email = normalizeEmail(body.email ?? '')
  const code = digitsOnly(String(body.code ?? ''))
  if (!email) return c.json({ error: 'email is required' }, 400)
  if (code.length !== 6) return c.json({ error: 'code must be 6 digits' }, 400)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<any>()
  if (!user) return c.json({ error: 'not_found' }, 404)

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const codeHash = await hashVerificationCode(code, pepper)
  const nowIso = new Date().toISOString()

  const row = await c.env.DB.prepare(
    "SELECT id, expires_at, consumed_at FROM verification_codes WHERE kind = 'email' AND target = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(email)
    .first<any>()

  if (!row) return c.json({ error: 'code_not_found' }, 400)
  if (row.consumed_at) return c.json({ error: 'code_already_used' }, 400)
  if (String(row.expires_at) < nowIso) return c.json({ error: 'code_expired' }, 400)

  const ok = await c.env.DB.prepare('SELECT id FROM verification_codes WHERE id = ? AND code_hash = ?')
    .bind(String(row.id), codeHash)
    .first<any>()
  if (!ok) {
    await c.env.DB.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').bind(String(row.id)).run()
    return c.json({ error: 'invalid_code' }, 400)
  }

  await c.env.DB.prepare('UPDATE verification_codes SET consumed_at = ? WHERE id = ?').bind(nowIso, String(row.id)).run()
  await c.env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?')
    .bind(nowIso, String(user.id))
    .run()

  const secret = (c.env.AUTH_JWT_SECRET ?? '').trim()
  if (!secret) return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 500)
  const token = await makeJwtHs256(secret, { userId: String(user.id), stage: 'needs_phone' }, 60 * 30)
  return c.json({ ok: true, token, stage: 'needs_phone' })
})

app.post('/v1/auth/login/start', async (c) => {
  type Body = { email?: string; password?: string }
  const body = await c.req.json<Body>().catch((): Body => ({}))
  const email = normalizeEmail(body.email ?? '')
  const password = String(body.password ?? '')
  if (!email) return c.json({ error: 'email is required' }, 400)
  if (!password.trim()) return c.json({ error: 'password is required' }, 400)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const user = await c.env.DB.prepare(
    'SELECT id, email_verified, phone, phone_verified, password_hash, password_salt FROM users WHERE email = ?'
  )
    .bind(email)
    .first<any>()

  if (!user) return c.json({ error: 'invalid_credentials' }, 401)
  if (Number(user.email_verified) !== 1) return c.json({ error: 'email_not_verified' }, 403)

  const passOk = await verifyPassword(password, String(user.password_salt), String(user.password_hash))
  if (!passOk) return c.json({ error: 'invalid_credentials' }, 401)

  const secret = (c.env.AUTH_JWT_SECRET ?? '').trim()
  if (!secret) return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 500)
  const stage = 'needs_sms'
  const token = await makeJwtHs256(secret, { userId: String(user.id), stage }, 60 * 30)
  const phoneMasked = user.phone ? String(user.phone).replace(/.(?=.{4})/g, '*') : null
  return c.json({ ok: true, token, stage, phoneMasked, phoneRequired: true })
})

app.post('/v1/auth/sms/send', async (c) => {
  type Body = { phone?: string }
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  const body = await c.req.json<Body>().catch((): Body => ({}))
  const phoneDigits = normalizePhoneDigitsForJP(String(body.phone ?? ''))
  if (phoneDigits.length < 10 || phoneDigits.length > 20) return c.json({ error: 'invalid_phone' }, 400)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const user = await c.env.DB.prepare('SELECT phone, phone_verified FROM users WHERE id = ?')
    .bind(auth.userId)
    .first<any>()
  if (!user) return c.json({ error: 'not_found' }, 404)

  if (Number(user.phone_verified) === 1) {
    const registeredDigits = normalizePhoneDigitsForJP(String(user.phone ?? ''))
    if (registeredDigits && registeredDigits !== phoneDigits) {
      return c.json({ error: 'phone_mismatch' }, 400)
    }
  }

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const codeLength = auth.stage === 'needs_sms' ? 6 : 4
  const code = makeRandomDigits(codeLength)
  const codeHash = await hashVerificationCode(code, pepper)
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO verification_codes (id, user_id, kind, target, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(crypto.randomUUID(), auth.userId, 'sms', phoneDigits, codeHash, expiresAt, now)
    .run()

  const smsRes = await sendSmsViaTwilio(c.env, `+${phoneDigits}`, `【推しドラ】認証コード: ${code}`)
  const debugCode = shouldReturnDebugCodes(c.env) ? code : undefined
  if (!smsRes.ok) {
    if (debugCode) {
      return c.json({ ok: true, debugCode, warning: smsRes.error })
    }
    return c.json({ error: smsRes.error, debugCode }, (smsRes.status ?? 502) as any)
  }
  return c.json({ ok: true, debugCode })
})

app.post('/v1/auth/sms/verify', async (c) => {
  type Body = { phone?: string; code?: string }
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  const body = await c.req.json<Body>().catch((): Body => ({}))
  const phoneDigits = normalizePhoneDigitsForJP(String(body.phone ?? ''))
  const code = digitsOnly(String(body.code ?? ''))
  if (phoneDigits.length < 10 || phoneDigits.length > 20) return c.json({ error: 'invalid_phone' }, 400)
  if (code.length < 4 || code.length > 6) return c.json({ error: 'code must be 4-6 digits' }, 400)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const codeHash = await hashVerificationCode(code, pepper)
  const nowIso = new Date().toISOString()

  const row = await c.env.DB.prepare(
    "SELECT id, expires_at, consumed_at FROM verification_codes WHERE kind = 'sms' AND target = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(phoneDigits, auth.userId)
    .first<any>()

  if (!row) return c.json({ error: 'code_not_found' }, 400)
  if (row.consumed_at) return c.json({ error: 'code_already_used' }, 400)
  if (String(row.expires_at) < nowIso) return c.json({ error: 'code_expired' }, 400)

  const ok = await c.env.DB.prepare('SELECT id FROM verification_codes WHERE id = ? AND code_hash = ?')
    .bind(String(row.id), codeHash)
    .first<any>()
  if (!ok) {
    await c.env.DB.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').bind(String(row.id)).run()
    return c.json({ error: 'invalid_code' }, 400)
  }

  await c.env.DB.prepare('UPDATE verification_codes SET consumed_at = ? WHERE id = ?').bind(nowIso, String(row.id)).run()
  await c.env.DB.prepare('UPDATE users SET phone = ?, phone_verified = 1, updated_at = ? WHERE id = ?')
    .bind(phoneDigits, nowIso, auth.userId)
    .run()

  const secret = (c.env.AUTH_JWT_SECRET ?? '').trim()
  if (!secret) return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 500)
  const token = await makeJwtHs256(secret, { userId: auth.userId, stage: 'full' })
  return c.json({ ok: true, token, stage: 'full' })
})

export default app
