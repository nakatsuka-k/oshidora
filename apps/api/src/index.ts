import { Hono } from 'hono'

type Env = {
  Bindings: {
    DB: D1Database
    // Optional R2 binding (preferred over S3 signed requests).
    BUCKET?: R2Bucket
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
    // Optional base URL for links in CMS password reset emails.
    // Example: https://admin.example.com
    CMS_PUBLIC_BASE_URL?: string
    CLOUDFLARE_STREAM_API_TOKEN?: string
    CLOUDFLARE_STREAM_SIGNING_KEY_ID?: string
    // Cloudflare Stream Signed URLs require an RSA signing key.
    // Store the *private* JWK returned by Cloudflare (data.result.jwk) as a secret.
    // For backward compat, we also accept it via CLOUDFLARE_STREAM_SIGNING_KEY_SECRET.
    CLOUDFLARE_STREAM_SIGNING_KEY_JWK?: string
    CLOUDFLARE_STREAM_SIGNING_KEY_SECRET?: string
    CLOUDFLARE_STREAM_SIGNING_SECRET?: string
    CLOUDFLARE_ACCOUNT_ID_FOR_STREAM?: string

    // Stripe (subscription)
    STRIPE_SECRET_KEY?: string
    STRIPE_WEBHOOK_SECRET?: string
    STRIPE_SUBSCRIPTION_PRICE_ID?: string
    STRIPE_CHECKOUT_SUCCESS_URL?: string
    STRIPE_CHECKOUT_CANCEL_URL?: string
    STRIPE_PORTAL_RETURN_URL?: string
  }
}

function isD1LikelyMissingTable(err: unknown) {
  const msg = String((err as any)?.message ?? err)
  return /no such table/i.test(msg) || /SQLITE_ERROR/i.test(msg)
}

async function optionalAuthUserId(c: any): Promise<string | null> {
  try {
    const secret = getAuthJwtSecret(c.env)
    if (!secret) return null
    const h = String(c.req.header('Authorization') ?? '')
    const m = h.match(/^Bearer\s+(.+)$/i)
    const token = m ? m[1].trim() : ''
    if (!token) return null
    const payload = await verifyJwtHs256(secret, token)
    const userId = typeof (payload as any)?.userId === 'string' ? String((payload as any).userId) : ''
    return userId || null
  } catch {
    return null
  }
}

async function tryLogVideoPlay(params: { db: D1Database | null; videoId: string; userId: string | null }) {
  if (!params.db) return
  const now = nowIso()
  try {
    await params.db
      .prepare('INSERT INTO video_play_events (id, video_id, user_id, created_at) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), params.videoId, params.userId, now)
      .run()
  } catch (err) {
    // Swallow errors so playback endpoints never fail due to analytics.
    if (isD1LikelyMissingTable(err)) return
  }
}

async function runScheduledVideoPublishing(env: Env['Bindings']) {
  if (!env.DB) return { ok: false as const, error: 'DB is not configured' as const }
  const db = env.DB as D1Database
  const now = nowIso()

  // Publish videos whose scheduled time has arrived.
  // After publishing, clear scheduled_at so they no longer appear in the scheduled list.
  let rows: any[] = []
  try {
    const out = await db
      .prepare(
        `SELECT id
         FROM videos
         WHERE published = 0
           AND scheduled_at IS NOT NULL
           AND scheduled_status = 'scheduled'
           AND scheduled_at <= ?
           AND COALESCE(approval_status, 'approved') = 'approved'
         ORDER BY scheduled_at ASC
         LIMIT 100`
      )
      .bind(now)
      .all()
    rows = (out.results ?? []) as any[]
  } catch (err) {
    if (isD1LikelyMissingTable(err)) return { ok: false as const, error: 'db_not_migrated' as const }
    throw err
  }

  if (!rows.length) return { ok: true as const, published: 0 }

  // D1 doesn't support multi-statement transactions reliably across all environments; do per-row updates.
  let published = 0
  for (const r of rows) {
    const id = String(r.id ?? '').trim()
    if (!id) continue
    try {
      await db
        .prepare('UPDATE videos SET published = 1, scheduled_at = NULL, updated_at = ? WHERE id = ?')
        .bind(now, id)
        .run()
      published++
    } catch (err) {
      if (isD1LikelyMissingTable(err)) continue
      throw err
    }
  }

  return { ok: true as const, published }
}

function toAsOfIsoFromDate(dateYmd: string) {
  return `${dateYmd}T00:00:00.000Z`
}

async function runCmsRankingsDaily(env: Env['Bindings']) {
  if (!env.DB) return { ok: false as const, error: 'DB is not configured' as const }
  const db = env.DB as D1Database

  // Compute rankings for the previous UTC day to avoid partial-day data.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const asOf = toAsOfIsoFromDate(yesterday)

  const topN = 20

  async function replaceRankings(type: string, items: Array<{ entityId: string; label: string; value: number }>) {
    await db.prepare('DELETE FROM cms_rankings WHERE type = ? AND as_of = ?').bind(type, asOf).run()
    let rank = 1
    for (const it of items.slice(0, topN)) {
      await db
        .prepare('INSERT INTO cms_rankings (type, as_of, rank, entity_id, label, value) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(type, asOf, rank, it.entityId, it.label, Math.trunc(it.value))
        .run()
      rank++
    }
  }

  try {
    // videos: by plays (count of play events)
    const videoRows = await d1All(
      db,
      `SELECT e.video_id AS id, v.title AS title, COUNT(*) AS n
       FROM video_play_events e
       LEFT JOIN videos v ON v.id = e.video_id
       WHERE substr(e.created_at, 1, 10) = ?
       GROUP BY e.video_id
       ORDER BY n DESC
       LIMIT ?`,
      [yesterday, topN]
    )
    await replaceRankings(
      'videos',
      videoRows.map((r: any) => ({
        entityId: String(r.id ?? ''),
        label: String(r.title ?? ''),
        value: Number(r.n ?? 0),
      }))
    )

    // coins: by coin spend (sum)
    const coinRows = await d1All(
      db,
      `SELECT e.video_id AS id, v.title AS title, COALESCE(SUM(e.amount), 0) AS n
       FROM coin_spend_events e
       LEFT JOIN videos v ON v.id = e.video_id
       WHERE substr(e.created_at, 1, 10) = ?
       GROUP BY e.video_id
       ORDER BY n DESC
       LIMIT ?`,
      [yesterday, topN]
    )
    await replaceRankings(
      'coins',
      coinRows
        .filter((r: any) => String(r.id ?? '').trim())
        .map((r: any) => ({
          entityId: String(r.id ?? ''),
          label: String(r.title ?? ''),
          value: Number(r.n ?? 0),
        }))
    )

    async function rankCastsByRole(type: 'actors' | 'directors' | 'writers', roleLike: string) {
      const rows = await d1All(
        db,
        `SELECT c.id AS id, c.name AS name, COUNT(*) AS n
         FROM video_play_events e
         JOIN video_casts vc ON vc.video_id = e.video_id
         JOIN casts c ON c.id = vc.cast_id
         WHERE substr(e.created_at, 1, 10) = ?
           AND c.role LIKE ?
         GROUP BY c.id
         ORDER BY n DESC
         LIMIT ?`,
        [yesterday, roleLike, topN]
      )
      await replaceRankings(
        type,
        rows.map((r: any) => ({
          entityId: String(r.id ?? ''),
          label: String(r.name ?? ''),
          value: Number(r.n ?? 0),
        }))
      )
    }

    await rankCastsByRole('actors', '%出演%')
    await rankCastsByRole('directors', '%監督%')
    await rankCastsByRole('writers', '%脚本%')

    return { ok: true as const, asOf }
  } catch (err) {
    if (isD1LikelyMissingTable(err)) return { ok: false as const, error: 'db_not_migrated' as const }
    throw err
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

  // 2) Base64/Base64URL encoded JSON
  // Accept both base64 and base64url alphabets, with optional padding.
  if (/^[A-Za-z0-9_\-+/=]+$/.test(trimmed) && trimmed.length >= 32) {
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
      // ignore
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

const ALLOWED_ORIGINS = new Set([
  'https://oshidra.com',
  'https://www.oshidra.com',
  'https://oshidra-web.pages.dev',
  'https://admin.oshidra.com',
  'http://localhost:3000',
  'http://localhost:5173',
])

function getAllowedOrigin(origin: string | null) {
  if (!origin) return null
  const trimmed = origin.trim()
  return ALLOWED_ORIGINS.has(trimmed) ? trimmed : null
}

// In local dev we sometimes don't set AUTH_JWT_SECRET. When debug codes are enabled, we fall back to
// an in-memory secret so login can proceed (tokens become invalid after server restart).
let DEV_FALLBACK_JWT_SECRET: string | null = null

function getDevFallbackJwtSecret() {
  if (DEV_FALLBACK_JWT_SECRET) return DEV_FALLBACK_JWT_SECRET
  // Must not generate random values in global scope (Cloudflare Workers restriction).
  DEV_FALLBACK_JWT_SECRET = crypto.randomUUID()
  return DEV_FALLBACK_JWT_SECRET
}

function isMockRequest(c: any) {
  // Safety: only allow mock mode when explicitly enabled for debugging.
  if (!shouldReturnDebugCodes(c.env)) return false
  const h = String(c.req.header('x-mock') ?? '').trim().toLowerCase()
  if (h === '1' || h === 'true') return true
  const q = String(c.req.query('mock') ?? '').trim().toLowerCase()
  return q === '1' || q === 'true'
}

// Client-side mock toggle (mobile debug). This is intentionally NOT tied to ALLOW_DEBUG_RETURN_CODES
// so we can enable mock data without exposing other debug-only response fields.
function isClientMockRequest(c: any) {
  const h = String(c.req.header('x-mock') ?? '').trim().toLowerCase()
  if (h === '1' || h === 'true') return true
  const q = String(c.req.query('mock') ?? '').trim().toLowerCase()
  return q === '1' || q === 'true'
}

function getAuthJwtSecret(env: Env['Bindings']): string | null {
  const explicit = String(env.AUTH_JWT_SECRET ?? '').trim()
  if (explicit) return explicit
  // Fallback secret so auth can still function in misconfigured environments.
  // NOTE: Tokens will become invalid after a worker restart. Set AUTH_JWT_SECRET in production.
  return getDevFallbackJwtSecret()
}

const MOCK_CMS_FEATURED_SLOTS: Record<string, string[]> = {
  recommend: [],
  pickup: [],
}

app.use('*', async (c, next) => {
  const origin = getAllowedOrigin(c.req.header('Origin') ?? null)
  if (c.req.method === 'OPTIONS') {
    const res = new Response(null, { status: 204 })
    if (origin) {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Vary', 'Origin')
      res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key, X-Mock')
      res.headers.set('Access-Control-Max-Age', '86400')
    }
    return res as any
  }

  await next()

  if (origin) {
    c.res.headers.set('Access-Control-Allow-Origin', origin)
    c.res.headers.set('Vary', 'Origin')
    c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key, X-Mock')
    c.res.headers.set('Access-Control-Max-Age', '86400')
  }
})

app.get('/health', (c) => c.text('ok'))

// ---- CMS (Admin) ----

app.post('/cms/auth/login', async (c) => {
  if (isMockRequest(c)) {
    const token = await makeJwtHs256(getDevFallbackJwtSecret(), {
      kind: 'cms',
      role: 'Admin',
      adminId: 'mock-admin',
      email: 'mock-admin@example.com',
      name: 'Mock Admin',
      stage: 'cms',
      userId: 'mock-admin',
    })
    return c.json({ token, mock: true })
  }

  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { email?: unknown; password?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')

  if (!email) return c.json({ error: 'email is required' }, 400)
  if (!password) return c.json({ error: 'password is required' }, 400)

  let row: any = null
  try {
    row = await db
      .prepare('SELECT id, email, name, role, password_hash, password_salt, disabled FROM cms_admins WHERE lower(email) = ?')
      .bind(email)
      .first<any>()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  if (!row) return c.json({ error: 'メールアドレスまたはパスワードが違います' }, 401)
  if (Number(row.disabled ?? 0) === 1) return c.json({ error: 'account_disabled' }, 403)

  const ok = await verifyPassword(password, String(row.password_salt ?? ''), String(row.password_hash ?? ''))
  if (!ok) return c.json({ error: 'メールアドレスまたはパスワードが違います' }, 401)

  const secret = getAuthJwtSecret(c.env)
  if (!secret) return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 500)

  const token = await makeJwtHs256(secret, {
    kind: 'cms',
    role: 'Admin',
    adminId: String(row.id ?? ''),
    email: String(row.email ?? ''),
    name: String(row.name ?? ''),
    stage: 'cms',
    userId: String(row.id ?? ''),
  })

  return c.json({ token })
})

app.post('/cms/auth/request-password-reset', async (c) => {
  // Intentionally unauthenticated.
  if (isMockRequest(c)) {
    return c.json({ ok: true })
  }

  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { email?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email) return c.json({ error: 'email is required' }, 400)

  const db = c.env.DB as D1Database
  let adminRow: any = null
  try {
    adminRow = await db
      .prepare('SELECT id, email, name, disabled FROM cms_admins WHERE lower(email) = ? LIMIT 1')
      .bind(email)
      .first<any>()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  // Always return ok: true to avoid account enumeration.
  if (!adminRow || Number(adminRow.disabled ?? 0) === 1) {
    return c.json({ ok: true })
  }

  const tokenRaw = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256Base64Url(tokenRaw)
  const now = nowIso()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
  const resetId = uuidOrFallback('cms_reset')

  try {
    await db
      .prepare(
        'INSERT INTO cms_admin_password_resets (id, admin_id, token_hash, expires_at, created_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)'
      )
      .bind(resetId, String(adminRow.id ?? ''), tokenHash, expiresAt, now)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const publicBase = (c.env.CMS_PUBLIC_BASE_URL ?? '').trim()
  const link = publicBase
    ? `${publicBase.replace(/\/$/, '')}/password-reset?token=${encodeURIComponent(tokenRaw)}`
    : `/password-reset?token=${encodeURIComponent(tokenRaw)}`

  const subject = '【推しドラ管理】パスワード再設定'
  const text = `パスワード再設定のリクエストを受け付けました。\n\n以下のリンクから再設定してください（有効期限: 1時間）。\n${link}\n\n心当たりがない場合は、このメールを破棄してください。`
  const html = `<!doctype html><html><body><p>パスワード再設定のリクエストを受け付けました。</p><p>以下のリンクから再設定してください（有効期限: 1時間）。</p><p><a href="${escapeHtml(link)}">パスワードを再設定する</a></p><p>心当たりがない場合は、このメールを破棄してください。</p></body></html>`

  const emailRes = await sendEmailViaMailChannels(c.env, String(adminRow.email ?? ''), subject, text, html)
  if (!emailRes.ok) {
    // Still return ok, but tell the client the system isn't configured.
    return c.json({ ok: true, warning: emailRes.error, ...(shouldReturnDebugCodes(c.env) ? { debugToken: tokenRaw, debugLink: link } : {}) })
  }

  return c.json({ ok: true, ...(shouldReturnDebugCodes(c.env) ? { debugToken: tokenRaw, debugLink: link } : {}) })
})

app.post('/cms/auth/reset-password', async (c) => {
  // Intentionally unauthenticated.
  if (isMockRequest(c)) {
    return c.json({ ok: true })
  }

  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { token?: unknown; newPassword?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const tokenRaw = String(body.token ?? '').trim()
  const newPassword = String(body.newPassword ?? '')
  if (!tokenRaw) return c.json({ error: 'token is required' }, 400)
  if (!newPassword || newPassword.length < 8) return c.json({ error: 'password_too_short' }, 400)

  const tokenHash = await sha256Base64Url(tokenRaw)
  const now = nowIso()

  let row: any = null
  try {
    row = await db
      .prepare(
        'SELECT id, admin_id, expires_at, used_at FROM cms_admin_password_resets WHERE token_hash = ? LIMIT 1'
      )
      .bind(tokenHash)
      .first<any>()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  if (!row) return c.json({ error: 'invalid_token' }, 400)
  if (String(row.used_at ?? '')) return c.json({ error: 'invalid_token' }, 400)
  if (String(row.expires_at ?? '') && String(row.expires_at) < now) return c.json({ error: 'invalid_token' }, 400)

  const { saltB64, hashB64 } = await hashPasswordForStorage(newPassword)
  const adminId = String(row.admin_id ?? '').trim()
  if (!adminId) return c.json({ error: 'invalid_token' }, 400)

  try {
    await db.batch([
      db
        .prepare('UPDATE cms_admins SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
        .bind(hashB64, saltB64, now, adminId),
      db
        .prepare('UPDATE cms_admin_password_resets SET used_at = ? WHERE id = ?')
        .bind(now, String(row.id ?? '')),
    ])
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true })
})

// Categories
app.get('/cms/categories', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  let rows: any[] = []
  try {
    rows = await d1All(db, 'SELECT id, name, enabled, parent_id, created_at, updated_at FROM categories ORDER BY name ASC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    enabled: Number(r.enabled ?? 0) === 1,
    parentId: r.parent_id === null || r.parent_id === undefined ? '' : String(r.parent_id ?? ''),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }))
  return c.json({ items })
})

app.get('/cms/categories/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  try {
    const row = await d1First(db, 'SELECT id, name, enabled, parent_id, created_at, updated_at FROM categories WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        name: String((row as any).name ?? ''),
        enabled: Number((row as any).enabled ?? 0) === 1,
        parentId: (row as any).parent_id === null || (row as any).parent_id === undefined ? '' : String((row as any).parent_id ?? ''),
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/categories', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { name?: unknown; enabled?: unknown; parentId?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = clampText(body.name, 80)
  const enabled = body.enabled === undefined ? 1 : parseBool01(body.enabled)
  const parentId = body.parentId === undefined ? '' : clampText(body.parentId, 80)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const createdAt = nowIso()
  const id = uuidOrFallback('cat')
  try {
    await db
      .prepare('INSERT INTO categories (id, name, enabled, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, name, enabled, parentId || null, createdAt, createdAt)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true, id })
})

app.put('/cms/categories/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { name?: unknown; enabled?: unknown; parentId?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = body.name === undefined ? null : clampText(body.name, 80)
  const enabled = body.enabled === undefined ? null : parseBool01(body.enabled)
  const parentId = body.parentId === undefined ? null : clampText(body.parentId, 80)
  const updatedAt = nowIso()
  try {
    const nextParent = parentId === null ? null : parentId || null
    await db
      .prepare('UPDATE categories SET name = COALESCE(?, name), enabled = COALESCE(?, enabled), parent_id = COALESCE(?, parent_id), updated_at = ? WHERE id = ?')
      .bind(name, enabled, nextParent, updatedAt, id)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true })
})

// Category -> videos (CMS)
app.get('/cms/categories/:id/videos', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  let rows: any[] = []
  try {
    rows = await d1All(
      db,
      `SELECT v.id, v.work_id, COALESCE(w.title, '') AS work_title, v.title, v.thumbnail_url, v.created_at
       FROM video_categories vc
       JOIN videos v ON v.id = vc.video_id
       LEFT JOIN works w ON w.id = v.work_id
       WHERE vc.category_id = ?
       ORDER BY vc.sort_order ASC, v.created_at DESC
       LIMIT 500`,
      [id]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({
    items: rows.map((r) => ({
      id: String(r.id ?? ''),
      workId: String(r.work_id ?? ''),
      workTitle: String(r.work_title ?? ''),
      title: String(r.title ?? ''),
      thumbnailUrl: String(r.thumbnail_url ?? ''),
      createdAt: String(r.created_at ?? ''),
    })),
  })
})

app.put('/cms/categories/:id/videos', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { videoIds?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const videoIds = parseIdList(body.videoIds)

  try {
    await replaceLinks(db, { table: 'video_categories', leftKey: 'category_id', leftId: id, rightKey: 'video_id', rightIds: videoIds })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true })
})

// Tags
app.get('/cms/tags', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  let rows: any[] = []
  try {
    rows = await d1All(db, 'SELECT id, name, category_id, created_at, updated_at FROM tags ORDER BY name ASC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    categoryId: String(r.category_id ?? ''),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }))
  return c.json({ items })
})

app.get('/cms/tags/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  try {
    const row = await d1First(db, 'SELECT id, name, category_id, created_at, updated_at FROM tags WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        name: String((row as any).name ?? ''),
        categoryId: String((row as any).category_id ?? ''),
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Dashboard (CMS)
app.get('/cms/dashboard/summary', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      usersTotal: 123,
      usersToday: 4,
      worksPublished: 12,
      videosPublished: 34,
      playsToday: 0,
      coinsSpentToday: 0,
    })
  }

  const db = c.env.DB as D1Database
  const today = nowIso().slice(0, 10)
  try {
    const usersTotalRow = await d1First(db, 'SELECT COUNT(*) AS n FROM users')
    const usersTodayRow = await d1First(db, 'SELECT COUNT(*) AS n FROM users WHERE substr(created_at, 1, 10) = ?', [today])
    const worksPublishedRow = await d1First(db, 'SELECT COUNT(*) AS n FROM works WHERE published = 1')
    const videosPublishedRow = await d1First(db, 'SELECT COUNT(*) AS n FROM videos WHERE published = 1')

    const playsTodayRow = await d1First(db, 'SELECT COUNT(*) AS n FROM video_play_events WHERE substr(created_at, 1, 10) = ?', [today])
    const coinsSpentTodayRow = await d1First(
      db,
      'SELECT COALESCE(SUM(amount), 0) AS n FROM coin_spend_events WHERE substr(created_at, 1, 10) = ? AND amount > 0',
      [today]
    )

    return c.json({
      usersTotal: Number((usersTotalRow as any)?.n ?? 0),
      usersToday: Number((usersTodayRow as any)?.n ?? 0),
      worksPublished: Number((worksPublishedRow as any)?.n ?? 0),
      videosPublished: Number((videosPublishedRow as any)?.n ?? 0),
      playsToday: Number((playsTodayRow as any)?.n ?? 0),
      coinsSpentToday: Number((coinsSpentTodayRow as any)?.n ?? 0),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Scheduled videos (CMS)
app.get('/cms/videos/scheduled', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      items: [
        { id: 'V0001', title: '配信予定：作品A 第1話', scheduledAt: '2026-01-15T20:00:00.000Z', status: 'scheduled' },
        { id: 'V0002', title: '配信予定：作品B 第2話', scheduledAt: '2026-01-16T21:30:00.000Z', status: 'scheduled' },
      ],
    })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(
      db,
      `SELECT v.id, v.title, v.scheduled_at, v.scheduled_status
       FROM videos v
       WHERE v.scheduled_at IS NOT NULL
       ORDER BY v.scheduled_at ASC
       LIMIT 200`
    )
    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        scheduledAt: r.scheduled_at === null || r.scheduled_at === undefined ? null : String(r.scheduled_at ?? ''),
        status: String(r.scheduled_status ?? 'scheduled'),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/videos/scheduled/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ item: { id, title: `配信予定(${id})`, scheduledAt: '2026-01-15T20:00:00.000Z', status: 'scheduled' } })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(db, 'SELECT id, title, scheduled_at, scheduled_status FROM videos WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        title: String((row as any).title ?? ''),
        scheduledAt:
          (row as any).scheduled_at === null || (row as any).scheduled_at === undefined ? null : String((row as any).scheduled_at ?? ''),
        status: String((row as any).scheduled_status ?? 'scheduled'),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.put('/cms/videos/scheduled/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { scheduledAt?: unknown; status?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const scheduledAt = body.scheduledAt === undefined ? null : clampText(body.scheduledAt, 30)
  const status = body.status === undefined ? null : clampText(body.status, 20)
  const allowed = new Set(['scheduled', 'cancelled'])
  if (status !== null && !allowed.has(status)) return c.json({ error: 'invalid_status' }, 400)
  const updatedAt = nowIso()
  const cancelledAt = status === 'cancelled' ? updatedAt : null

  try {
    await c.env.DB
      .prepare(
        'UPDATE videos SET scheduled_at = COALESCE(?, scheduled_at), scheduled_status = COALESCE(?, scheduled_status), scheduled_cancelled_at = COALESCE(?, scheduled_cancelled_at), updated_at = ? WHERE id = ?'
      )
      .bind(scheduledAt, status, cancelledAt, updatedAt, id)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Rankings (CMS)
app.get('/cms/rankings/:type', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const type = String(c.req.param('type') ?? '').trim()
  const allowed = new Set(['videos', 'coins', 'actors', 'directors', 'writers'])
  if (!allowed.has(type)) return c.json({ error: 'invalid_type' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    const baseItems = [
      { rank: 1, entityId: 'X1', label: `${type.toUpperCase()} 1`, value: 100 },
      { rank: 2, entityId: 'X2', label: `${type.toUpperCase()} 2`, value: 80 },
      { rank: 3, entityId: 'X3', label: `${type.toUpperCase()} 3`, value: 60 },
    ]
    return c.json({
      items: baseItems.map((r) => {
        if (type === 'videos' || type === 'coins') {
          return {
            ...r,
            video: {
              id: r.entityId,
              title: r.label,
              description: '',
              thumbnailUrl: '',
            },
          }
        }
        if (type === 'actors' || type === 'directors' || type === 'writers') {
          return {
            ...r,
            cast: {
              id: r.entityId,
              name: r.label,
              role: type,
              thumbnailUrl: '',
            },
          }
        }
        return r
      }),
      asOf: '2026-01-12T00:00:00.000Z',
    })
  }

  const db = c.env.DB as D1Database
  try {
    const asOfRow = await d1First(db, 'SELECT MAX(as_of) AS as_of FROM cms_rankings WHERE type = ?', [type])
    const asOf = String((asOfRow as any)?.as_of ?? '')
    if (!asOf) return c.json({ items: [], asOf: '' })
    const rows = await d1All(db, 'SELECT type, as_of, rank, entity_id, label, value FROM cms_rankings WHERE type = ? AND as_of = ? ORDER BY rank ASC', [
      type,
      asOf,
    ])

    const entityIds = Array.from(
      new Set(
        rows
          .map((r: any) => String(r?.entity_id ?? '').trim())
          .filter((id: string) => Boolean(id))
      )
    )

    const videoById = new Map<string, { id: string; title: string; description: string; thumbnailUrl: string }>()
    const castById = new Map<string, { id: string; name: string; role: string; thumbnailUrl: string }>()

    if ((type === 'videos' || type === 'coins') && entityIds.length) {
      const placeholders = entityIds.map(() => '?').join(',')
      const videos = await d1All(
        db,
        `SELECT id, title, description, thumbnail_url FROM videos WHERE id IN (${placeholders})`,
        entityIds
      )
      for (const v of videos as any[]) {
        const id = String((v as any)?.id ?? '').trim()
        if (!id) continue
        videoById.set(id, {
          id,
          title: String((v as any)?.title ?? ''),
          description: String((v as any)?.description ?? ''),
          thumbnailUrl: String((v as any)?.thumbnail_url ?? ''),
        })
      }
    }

    if ((type === 'actors' || type === 'directors' || type === 'writers') && entityIds.length) {
      const placeholders = entityIds.map(() => '?').join(',')
      const casts = await d1All(db, `SELECT id, name, role, thumbnail_url FROM casts WHERE id IN (${placeholders})`, entityIds)
      for (const v of casts as any[]) {
        const id = String((v as any)?.id ?? '').trim()
        if (!id) continue
        castById.set(id, {
          id,
          name: String((v as any)?.name ?? ''),
          role: String((v as any)?.role ?? ''),
          thumbnailUrl: String((v as any)?.thumbnail_url ?? ''),
        })
      }
    }

    return c.json({
      items: rows.map((r: any) => {
        const entityId = String(r.entity_id ?? '')
        const item: any = {
          rank: Number(r.rank ?? 0),
          entityId,
          label: String(r.label ?? ''),
          value: Number(r.value ?? 0),
        }
        const vid = videoById.get(entityId)
        if (vid) item.video = vid
        const cast = castById.get(entityId)
        if (cast) item.cast = cast
        return item
      }),
      asOf,
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/tags', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  type Body = { name?: unknown; categoryId?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = clampText(body.name, 80)
  const categoryId = clampText(body.categoryId, 64)
  if (!name) return c.json({ error: 'name is required' }, 400)
  const createdAt = nowIso()
  const id = uuidOrFallback('tag')
  try {
    await db
      .prepare('INSERT INTO tags (id, name, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name, categoryId || '', createdAt, createdAt)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true, id })
})

app.put('/cms/tags/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)
  type Body = { name?: unknown; categoryId?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = body.name === undefined ? null : clampText(body.name, 80)
  const categoryId = body.categoryId === undefined ? null : clampText(body.categoryId, 64)
  const updatedAt = nowIso()
  try {
    await db
      .prepare('UPDATE tags SET name = COALESCE(?, name), category_id = COALESCE(?, category_id), updated_at = ? WHERE id = ?')
      .bind(name, categoryId, updatedAt, id)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true })
})

// Notices (CMS)
app.get('/cms/notices', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      items: [
        {
          id: 'N0001',
          subject: 'メンテナンスのお知らせ',
          body: '本文',
          createdBy: { id: 'A0001', email: 'admin@example.com', name: 'Admin' },
          sentAt: '2026-01-12 03:00',
          status: 'scheduled',
          push: true,
          tags: ['maintenance'],
          mailEnabled: true,
          mailFormat: 'text',
          mailSentAt: '',
          pushTitle: '',
          pushBody: '',
          pushSentAt: '',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'N0002',
          subject: '新作公開',
          body: '本文',
          createdBy: { id: 'A0001', email: 'admin@example.com', name: 'Admin' },
          sentAt: '2026-01-10 12:00',
          status: 'sent',
          push: false,
          tags: ['new'],
          mailEnabled: false,
          mailFormat: 'text',
          mailSentAt: '2026-01-10 12:00',
          pushTitle: '',
          pushBody: '',
          pushSentAt: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
    })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(
      db,
      `SELECT n.id, n.subject, n.body, n.sent_at, n.status, n.push,
              n.tags, n.mail_enabled, n.mail_format, n.mail_sent_at, n.push_title, n.push_body, n.push_sent_at,
              n.created_by_admin_id, n.updated_by_admin_id,
              COALESCE(a.email, '') AS created_by_email,
              COALESCE(a.name, '') AS created_by_name,
              n.created_at, n.updated_at
       FROM notices n
       LEFT JOIN cms_admins a ON a.id = n.created_by_admin_id
       ORDER BY (n.sent_at = '') ASC, n.sent_at DESC, n.created_at DESC`
    )
    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        subject: String(r.subject ?? ''),
        body: String(r.body ?? ''),
        createdBy: {
          id: String(r.created_by_admin_id ?? ''),
          email: String(r.created_by_email ?? ''),
          name: String(r.created_by_name ?? ''),
        },
        sentAt: String(r.sent_at ?? ''),
        status: String(r.status ?? 'draft'),
        push: Number(r.push ?? 0) === 1,
        tags: String(r.tags ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        mailEnabled: Number(r.mail_enabled ?? 0) === 1,
        mailFormat: String(r.mail_format ?? 'text') || 'text',
        mailSentAt: String(r.mail_sent_at ?? ''),
        pushTitle: String(r.push_title ?? ''),
        pushBody: String(r.push_body ?? ''),
        pushSentAt: String(r.push_sent_at ?? ''),
        createdAt: String(r.created_at ?? ''),
        updatedAt: String(r.updated_at ?? ''),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/notices/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      item: {
        id,
        subject: `(${id}) お知らせ件名`,
        body: '',
        sentAt: '',
        status: 'draft',
        push: false,
        tags: ['tag1', 'tag2'],
        mailEnabled: false,
        mailFormat: 'text',
        mailText: '',
        mailHtml: '',
        mailSentAt: '',
        pushTitle: '',
        pushBody: '',
        pushSentAt: '',
      },
    })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(
      db,
      'SELECT id, subject, body, sent_at, status, push, tags, mail_enabled, mail_format, mail_text, mail_html, mail_sent_at, push_title, push_body, push_sent_at, created_at, updated_at FROM notices WHERE id = ? LIMIT 1',
      [id]
    )
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        subject: String((row as any).subject ?? ''),
        body: String((row as any).body ?? ''),
        sentAt: String((row as any).sent_at ?? ''),
        status: String((row as any).status ?? 'draft'),
        push: Number((row as any).push ?? 0) === 1,
        tags: String((row as any).tags ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        mailEnabled: Number((row as any).mail_enabled ?? 0) === 1,
        mailFormat: String((row as any).mail_format ?? 'text') || 'text',
        mailText: String((row as any).mail_text ?? ''),
        mailHtml: String((row as any).mail_html ?? ''),
        mailSentAt: String((row as any).mail_sent_at ?? ''),
        pushTitle: String((row as any).push_title ?? ''),
        pushBody: String((row as any).push_body ?? ''),
        pushSentAt: String((row as any).push_sent_at ?? ''),
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/notices', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = {
    subject?: unknown
    body?: unknown
    sentAt?: unknown
    status?: unknown
    push?: unknown
    tags?: unknown
    mailEnabled?: unknown
    mailFormat?: unknown
    mailText?: unknown
    mailHtml?: unknown
    pushTitle?: unknown
    pushBody?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const subject = clampText(body.subject, 120)
  const text = body.body === undefined ? '' : String(body.body ?? '')
  const sentAt = body.sentAt === undefined ? '' : clampText(body.sentAt, 40)
  const status = body.status === undefined ? 'draft' : clampText(body.status, 20)
  const push = body.push === undefined ? 0 : parseBool01(body.push)
  const tags = (() => {
    if (Array.isArray(body.tags)) return body.tags.map((v) => String(v ?? '').trim()).filter(Boolean).join(',')
    return clampText(body.tags, 500)
  })()
  const mailEnabled = body.mailEnabled === undefined ? 0 : parseBool01(body.mailEnabled)
  const mailFormat = body.mailFormat === undefined ? 'text' : clampText(body.mailFormat, 10) || 'text'
  const mailText = body.mailText === undefined ? '' : String(body.mailText ?? '')
  const mailHtml = body.mailHtml === undefined ? '' : String(body.mailHtml ?? '')
  const pushTitle = body.pushTitle === undefined ? '' : clampText(body.pushTitle, 120)
  const pushBody = body.pushBody === undefined ? '' : String(body.pushBody ?? '')
  if (!subject) return c.json({ error: 'subject is required' }, 400)

  const db = c.env.DB as D1Database
  const id = uuidOrFallback('notice')
  const now = nowIso()
  try {
    await db
      .prepare(
        'INSERT INTO notices (id, subject, body, sent_at, status, push, tags, mail_enabled, mail_format, mail_text, mail_html, mail_sent_at, push_title, push_body, push_sent_at, created_by_admin_id, updated_by_admin_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, subject, text, sentAt, status, push, tags, mailEnabled, mailFormat, mailText, mailHtml, '', pushTitle, pushBody, '', admin.adminId ?? '', admin.adminId ?? '', now, now)
      .run()
    return c.json({ ok: true, id })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.put('/cms/notices/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = {
    subject?: unknown
    body?: unknown
    sentAt?: unknown
    status?: unknown
    push?: unknown
    tags?: unknown
    mailEnabled?: unknown
    mailFormat?: unknown
    mailText?: unknown
    mailHtml?: unknown
    pushTitle?: unknown
    pushBody?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const subject = body.subject === undefined ? null : clampText(body.subject, 120)
  const text = body.body === undefined ? null : String(body.body ?? '')
  const sentAt = body.sentAt === undefined ? null : clampText(body.sentAt, 40)
  const status = body.status === undefined ? null : clampText(body.status, 20)
  const push = body.push === undefined ? null : parseBool01(body.push)
  const tags = body.tags === undefined ? null : (() => {
    if (Array.isArray(body.tags)) return body.tags.map((v) => String(v ?? '').trim()).filter(Boolean).join(',')
    return clampText(body.tags, 500)
  })()
  const mailEnabled = body.mailEnabled === undefined ? null : parseBool01(body.mailEnabled)
  const mailFormat = body.mailFormat === undefined ? null : clampText(body.mailFormat, 10)
  const mailText = body.mailText === undefined ? null : String(body.mailText ?? '')
  const mailHtml = body.mailHtml === undefined ? null : String(body.mailHtml ?? '')
  const pushTitle = body.pushTitle === undefined ? null : clampText(body.pushTitle, 120)
  const pushBody = body.pushBody === undefined ? null : String(body.pushBody ?? '')
  const updatedAt = nowIso()

  try {
    await db
      .prepare(
        'UPDATE notices SET subject = COALESCE(?, subject), body = COALESCE(?, body), sent_at = COALESCE(?, sent_at), status = COALESCE(?, status), push = COALESCE(?, push), tags = COALESCE(?, tags), mail_enabled = COALESCE(?, mail_enabled), mail_format = COALESCE(?, mail_format), mail_text = COALESCE(?, mail_text), mail_html = COALESCE(?, mail_html), push_title = COALESCE(?, push_title), push_body = COALESCE(?, push_body), updated_at = ? WHERE id = ?'
      )
      .bind(subject, text, sentAt, status, push, tags, mailEnabled, mailFormat, mailText, mailHtml, pushTitle, pushBody, updatedAt, id)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/notices/:id/send-email', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { limit?: unknown; dryRun?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50) || 50))
  const dryRun = Boolean(body.dryRun)

  const db = c.env.DB as D1Database
  let notice: any
  try {
    notice = await db
      .prepare('SELECT id, subject, body, mail_enabled, mail_format, mail_text, mail_html FROM notices WHERE id = ? LIMIT 1')
      .bind(id)
      .first<any>()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  if (!notice) return c.json({ error: 'not_found' }, 404)
  if (Number(notice.mail_enabled ?? 0) !== 1) return c.json({ error: 'mail_disabled' }, 400)

  const subject = String(notice.subject ?? '').trim() || 'お知らせ'
  const baseText = String(notice.mail_text ?? '').trim() || String(notice.body ?? '').trim() || '（本文なし）'
  const format = String(notice.mail_format ?? 'text') || 'text'
  const html =
    format === 'html'
      ? String(notice.mail_html ?? '').trim() || `<pre style="white-space:pre-wrap">${escapeHtml(baseText)}</pre>`
      : ''

  let rows: any[] = []
  try {
    rows = await d1All(
      db,
      `SELECT email FROM users WHERE email IS NOT NULL AND trim(email) != '' AND email_verified = 1 ORDER BY created_at DESC LIMIT ?`,
      [limit]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const recipients = rows.map((r) => normalizeEmail(String(r.email ?? ''))).filter(Boolean)
  if (dryRun) {
    return c.json({ ok: true, dryRun: true, recipients: recipients.length, limit })
  }

  let sent = 0
  for (const to of recipients) {
    const res = await sendEmailViaMailChannels(c.env, to, subject, baseText, html)
    if (!res.ok) {
      const now = nowIso()
      try {
        await db
          .prepare('INSERT INTO notice_deliveries (id, notice_id, channel, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(uuidOrFallback('notice_delivery'), id, 'email', 'failed', String(res.error ?? '').slice(0, 1000), now)
          .run()
      } catch {
        // ignore
      }
      return c.json({ error: res.error ?? 'send_failed', sent, recipients: recipients.length }, (res.status ?? 502) as any)
    }
    sent += 1
  }

  const now = nowIso()
  try {
    await db.prepare('UPDATE notices SET mail_sent_at = ?, updated_at = ? WHERE id = ?').bind(now, now, id).run()
    await db
      .prepare('INSERT INTO notice_deliveries (id, notice_id, channel, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(uuidOrFallback('notice_delivery'), id, 'email', 'sent', `sent=${sent}`, now)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true, sent, recipients: recipients.length, limit })
})

app.post('/cms/notices/:id/send-push', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  const db = c.env.DB as D1Database
  const now = nowIso()
  try {
    const row = await db.prepare('SELECT id FROM notices WHERE id = ? LIMIT 1').bind(id).first<any>()
    if (!row) return c.json({ error: 'not_found' }, 404)
    await db.prepare('UPDATE notices SET push_sent_at = ?, updated_at = ? WHERE id = ?').bind(now, now, id).run()
    await db
      .prepare('INSERT INTO notice_deliveries (id, notice_id, channel, status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(uuidOrFallback('notice_delivery'), id, 'push', 'sent', 'push_provider_not_configured', now)
      .run()
    return c.json({ ok: true, warning: 'push_provider_not_configured' })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Coin settings (CMS)
app.get('/cms/coin-settings', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      items: [
        { id: 'COIN001', priceYen: 480, place: 'アプリ', target: '全ユーザー', period: '常時', createdAt: '', updatedAt: '' },
        { id: 'COIN002', priceYen: 1200, place: 'アプリ', target: '全ユーザー', period: '常時', createdAt: '', updatedAt: '' },
      ],
    })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(db, 'SELECT id, price_yen, place, target, period, created_at, updated_at FROM coin_settings ORDER BY price_yen ASC, created_at DESC')
    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        priceYen: Number(r.price_yen ?? 0),
        place: String(r.place ?? ''),
        target: String(r.target ?? ''),
        period: String(r.period ?? ''),
        createdAt: String(r.created_at ?? ''),
        updatedAt: String(r.updated_at ?? ''),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/coin-settings/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ item: { id, priceYen: 480, place: 'アプリ', target: '全ユーザー', period: '常時' } })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(db, 'SELECT id, price_yen, place, target, period, created_at, updated_at FROM coin_settings WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        priceYen: Number((row as any).price_yen ?? 0),
        place: String((row as any).place ?? ''),
        target: String((row as any).target ?? ''),
        period: String((row as any).period ?? ''),
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/coin-settings', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { priceYen?: unknown; place?: unknown; target?: unknown; period?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const priceYen = Math.max(0, Math.floor(Number(body.priceYen ?? 0)))
  const place = clampText(body.place, 40)
  const target = clampText(body.target, 40)
  const period = clampText(body.period, 80)
  if (!Number.isFinite(priceYen) || priceYen <= 0) return c.json({ error: 'priceYen is required' }, 400)

  const id = uuidOrFallback('coin')
  const now = nowIso()
  try {
    await db
      .prepare('INSERT INTO coin_settings (id, price_yen, place, target, period, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, priceYen, place || '', target || '', period || '', now, now)
      .run()
    return c.json({ ok: true, id })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.put('/cms/coin-settings/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { priceYen?: unknown; place?: unknown; target?: unknown; period?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const priceYen = body.priceYen === undefined ? null : Math.max(0, Math.floor(Number(body.priceYen ?? 0)))
  const place = body.place === undefined ? null : clampText(body.place, 40)
  const target = body.target === undefined ? null : clampText(body.target, 40)
  const period = body.period === undefined ? null : clampText(body.period, 80)
  const updatedAt = nowIso()

  try {
    await db
      .prepare('UPDATE coin_settings SET price_yen = COALESCE(?, price_yen), place = COALESCE(?, place), target = COALESCE(?, target), period = COALESCE(?, period), updated_at = ? WHERE id = ?')
      .bind(priceYen, place, target, period, updatedAt, id)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Admin accounts (CMS)
app.get('/cms/admins', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ items: [{ id: 'A0001', name: '運営管理者', email: 'admin@example.com', role: 'Admin', disabled: false, createdAt: '', updatedAt: '' }] })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(db, 'SELECT id, email, name, role, disabled, created_at, updated_at FROM cms_admins ORDER BY created_at DESC')
    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        email: String(r.email ?? ''),
        name: String(r.name ?? ''),
        role: String(r.role ?? 'Admin'),
        disabled: Number(r.disabled ?? 0) === 1,
        createdAt: String(r.created_at ?? ''),
        updatedAt: String(r.updated_at ?? ''),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/admins/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ item: { id, name: '運営管理者', email: 'admin@example.com', role: 'Admin', disabled: false } })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(db, 'SELECT id, email, name, role, disabled, created_at, updated_at FROM cms_admins WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        email: String((row as any).email ?? ''),
        name: String((row as any).name ?? ''),
        role: String((row as any).role ?? 'Admin'),
        disabled: Number((row as any).disabled ?? 0) === 1,
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/admins', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { email?: unknown; name?: unknown; role?: unknown; password?: unknown; disabled?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = clampText(body.email, 120)
  const name = clampText(body.name, 80)
  const role = body.role === undefined ? 'Admin' : clampText(body.role, 30)
  const password = clampText(body.password, 200)
  const disabled = body.disabled === undefined ? 0 : parseBool01(body.disabled)
  if (!email) return c.json({ error: 'email is required' }, 400)
  if (!name) return c.json({ error: 'name is required' }, 400)
  if (!password) return c.json({ error: 'password is required' }, 400)

  const { saltB64, hashB64 } = await hashPasswordForStorage(password)
  const id = uuidOrFallback('admin')
  const now = nowIso()
  try {
    await c.env.DB
      .prepare('INSERT INTO cms_admins (id, email, name, role, password_hash, password_salt, disabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, email, name, role || 'Admin', hashB64, saltB64, disabled, now, now)
      .run()
    return c.json({ ok: true, id })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.put('/cms/admins/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { email?: unknown; name?: unknown; role?: unknown; password?: unknown; disabled?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = body.email === undefined ? null : clampText(body.email, 120)
  const name = body.name === undefined ? null : clampText(body.name, 80)
  const role = body.role === undefined ? null : clampText(body.role, 30)
  const disabled = body.disabled === undefined ? null : parseBool01(body.disabled)
  const password = body.password === undefined ? null : clampText(body.password, 200)
  const updatedAt = nowIso()

  try {
    if (password) {
      const { saltB64, hashB64 } = await hashPasswordForStorage(password)
      await db
        .prepare(
          'UPDATE cms_admins SET email = COALESCE(?, email), name = COALESCE(?, name), role = COALESCE(?, role), disabled = COALESCE(?, disabled), password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?'
        )
        .bind(email, name, role, disabled, hashB64, saltB64, updatedAt, id)
        .run()
    } else {
      await db
        .prepare('UPDATE cms_admins SET email = COALESCE(?, email), name = COALESCE(?, name), role = COALESCE(?, role), disabled = COALESCE(?, disabled), updated_at = ? WHERE id = ?')
        .bind(email, name, role, disabled, updatedAt, id)
        .run()
    }

    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Users (CMS)
app.get('/cms/users', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  const q = normalizeQuery(String(c.req.query('q') ?? ''))
  const kind = String(c.req.query('kind') ?? '').trim() // '' | 'user' | 'cast'
  const sort = String(c.req.query('sort') ?? '').trim() // '' | 'createdAt' | 'kind'
  const kindAllowed = new Set(['', 'user', 'cast'])
  if (!kindAllowed.has(kind)) return c.json({ error: 'invalid_kind' }, 400)
  const sortAllowed = new Set(['', 'createdAt', 'kind'])
  if (!sortAllowed.has(sort)) return c.json({ error: 'invalid_sort' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    const base = [
      { id: 'U0001', email: 'usera@example.com', emailVerified: true, phone: '', phoneVerified: false, createdAt: '2026-01-10T00:00:00.000Z', kind: 'user' },
      { id: 'U0002', email: 'castb@example.com', emailVerified: false, phone: '', phoneVerified: false, createdAt: '2026-01-09T00:00:00.000Z', kind: 'cast' },
    ].filter((u) => (!q ? true : normalizeQuery(u.email).includes(q)))

    const filtered = kind ? base.filter((u) => u.kind === kind) : base
    const sorted = sort === 'kind'
      ? filtered.slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'cast' ? -1 : 1))
      : filtered

    return c.json({ items: sorted })
  }

  const db = c.env.DB as D1Database
  try {
    const clauses: string[] = []
    const binds: any[] = []

    if (q) {
      clauses.push('lower(u.email) LIKE ?')
      binds.push(`%${q}%`)
    }

    // kind = 'cast' means approved cast profile exists.
    if (kind === 'cast') {
      clauses.push(`EXISTS (SELECT 1 FROM cast_profile_requests cpr WHERE cpr.user_id = u.id AND cpr.status = 'approved')`)
    }
    if (kind === 'user') {
      clauses.push(`NOT EXISTS (SELECT 1 FROM cast_profile_requests cpr WHERE cpr.user_id = u.id AND cpr.status = 'approved')`)
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const orderBy = sort === 'kind'
      ? `ORDER BY is_cast DESC, u.created_at DESC`
      : `ORDER BY u.created_at DESC`

    const rows = await d1All(
      db,
      `SELECT
         u.id, u.email, u.email_verified, u.phone, u.phone_verified, u.created_at, u.updated_at,
         u.sms_auth_skip,
         CASE WHEN EXISTS (SELECT 1 FROM cast_profile_requests cpr WHERE cpr.user_id = u.id AND cpr.status = 'approved') THEN 1 ELSE 0 END AS is_cast
       FROM users u
       ${where}
       ${orderBy}
       LIMIT 200`,
      binds
    )

    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        email: String(r.email ?? ''),
        emailVerified: Number(r.email_verified ?? 0) === 1,
        phone: r.phone === null || r.phone === undefined ? '' : String(r.phone ?? ''),
        phoneVerified: Number(r.phone_verified ?? 0) === 1,
        smsAuthSkip: Number((r as any).sms_auth_skip ?? 0) === 1,
        kind: Number((r as any).is_cast ?? 0) === 1 ? 'cast' : 'user',
        createdAt: String(r.created_at ?? ''),
        updatedAt: String(r.updated_at ?? ''),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/users/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      item: {
        id,
        email: 'user@example.com',
        emailVerified: true,
        phone: '',
        phoneVerified: false,
        smsAuthSkip: false,
        createdAt: '',
        updatedAt: '',
        isSubscribed: false,
        subscription: {
          status: '',
          startedAt: null,
          endedAt: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
        },
        profile: {
          displayName: '',
          avatarUrl: '',
          fullName: '',
          fullNameKana: '',
          birthDate: '',
          favoriteGenres: [],
        },
        coins: {
          acquiredTotal: null,
          balance: null,
          spentTotal: 0,
        },
        favorites: {
          casts: [],
          videos: [],
        },
        watchHistory: [],
        comments: {
          inferredByAuthorMatch: true,
          items: [],
        },
        castProfile: null,
      },
    })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(
      db,
      `SELECT
         id,
         email,
         email_verified,
         phone,
         phone_verified,
         sms_auth_skip,
         created_at,
         updated_at,
         display_name,
         avatar_url,
         full_name,
         full_name_kana,
         birth_date,
         favorite_genres_json,
         is_subscribed,
         subscription_started_at,
         subscription_ended_at,
         stripe_customer_id,
         stripe_subscription_id,
         subscription_status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [id]
    )
    if (!row) return c.json({ error: 'not_found' }, 404)

    const favoriteGenres = (() => {
      const raw = String((row as any).favorite_genres_json ?? '').trim()
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.map((v) => String(v ?? '').trim()).filter(Boolean)
      } catch {
        return []
      }
    })()

    const [favCastRows, favVideoRows, watchRows, coinsSpentRow, castProfileRow] = await Promise.all([
      d1All(
        db,
        `SELECT fc.cast_id, fc.created_at, COALESCE(c.name, '') AS name, COALESCE(c.role, '') AS role, COALESCE(c.thumbnail_url, '') AS thumbnail_url
         FROM favorite_casts fc
         LEFT JOIN casts c ON c.id = fc.cast_id
         WHERE fc.user_id = ?
         ORDER BY fc.created_at DESC
         LIMIT 200`,
        [id]
      ),
      d1All(
        db,
        `SELECT fv.work_id, fv.created_at, COALESCE(w.title, '') AS work_title, COALESCE(w.thumbnail_url, '') AS thumbnail_url
         FROM favorite_videos fv
         LEFT JOIN works w ON w.id = fv.work_id
         WHERE fv.user_id = ?
         ORDER BY fv.created_at DESC
         LIMIT 200`,
        [id]
      ),
      d1All(
        db,
        `SELECT e.video_id, e.created_at, COALESCE(v.title, '') AS video_title, COALESCE(v.work_id, '') AS work_id, COALESCE(w.title, '') AS work_title
         FROM video_play_events e
         LEFT JOIN videos v ON v.id = e.video_id
         LEFT JOIN works w ON w.id = v.work_id
         WHERE e.user_id = ?
         ORDER BY e.created_at DESC
         LIMIT 200`,
        [id]
      ),
      d1First(db, 'SELECT COALESCE(SUM(amount), 0) AS n FROM coin_spend_events WHERE user_id = ?', [id]),
      d1First(
        db,
        `SELECT id, name, email, draft_json, submitted_at, decided_at, decided_by_admin_id
         FROM cast_profile_requests
         WHERE user_id = ? AND status = 'approved'
         ORDER BY COALESCE(decided_at, submitted_at) DESC
         LIMIT 1`,
        [id]
      ),
    ])

    const comments = await (async () => {
      const candidatesRaw = [
        String((row as any).display_name ?? '').trim(),
        String((row as any).full_name ?? '').trim(),
      ]
      const candidates = Array.from(new Set(candidatesRaw)).filter((s) => s && s.length <= 50)
      if (!candidates.length) return []
      const placeholders = candidates.map(() => '?').join(',')
      return await d1All(
        db,
        `SELECT c.id, c.content_id, c.episode_id, c.author, c.body, c.status, c.created_at, COALESCE(w.title, '') AS content_title
         FROM comments c
         LEFT JOIN works w ON w.id = c.content_id
         WHERE c.author IN (${placeholders})
         ORDER BY c.created_at DESC
         LIMIT 200`,
        candidates
      )
    })()

    let castProfileDraft: unknown = null
    if (castProfileRow) {
      try {
        castProfileDraft = (castProfileRow as any).draft_json ? JSON.parse(String((castProfileRow as any).draft_json)) : null
      } catch {
        castProfileDraft = null
      }
    }

    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        email: String((row as any).email ?? ''),
        emailVerified: Number((row as any).email_verified ?? 0) === 1,
        phone: (row as any).phone === null || (row as any).phone === undefined ? '' : String((row as any).phone ?? ''),
        phoneVerified: Number((row as any).phone_verified ?? 0) === 1,
        smsAuthSkip: Number((row as any).sms_auth_skip ?? 0) === 1,
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
        isSubscribed: Number((row as any).is_subscribed ?? 0) === 1,
        subscription: {
          status: String((row as any).subscription_status ?? ''),
          startedAt: (row as any).subscription_started_at ? String((row as any).subscription_started_at) : null,
          endedAt: (row as any).subscription_ended_at ? String((row as any).subscription_ended_at) : null,
          stripeCustomerId: (row as any).stripe_customer_id ? String((row as any).stripe_customer_id) : null,
          stripeSubscriptionId: (row as any).stripe_subscription_id ? String((row as any).stripe_subscription_id) : null,
        },
        profile: {
          displayName: String((row as any).display_name ?? ''),
          avatarUrl: String((row as any).avatar_url ?? ''),
          fullName: String((row as any).full_name ?? ''),
          fullNameKana: String((row as any).full_name_kana ?? ''),
          birthDate: String((row as any).birth_date ?? ''),
          favoriteGenres,
        },
        coins: {
          acquiredTotal: null,
          balance: null,
          spentTotal: Number((coinsSpentRow as any)?.n ?? 0),
        },
        favorites: {
          casts: (favCastRows ?? []).map((r: any) => ({
            castId: String(r.cast_id ?? ''),
            name: String(r.name ?? ''),
            role: String(r.role ?? ''),
            thumbnailUrl: String(r.thumbnail_url ?? ''),
            favoritedAt: String(r.created_at ?? ''),
          })),
          videos: (favVideoRows ?? []).map((r: any) => ({
            workId: String(r.work_id ?? ''),
            title: String(r.work_title ?? ''),
            thumbnailUrl: String(r.thumbnail_url ?? ''),
            favoritedAt: String(r.created_at ?? ''),
          })),
        },
        watchHistory: (watchRows ?? []).map((r: any) => ({
          videoId: String(r.video_id ?? ''),
          videoTitle: String(r.video_title ?? ''),
          workId: String(r.work_id ?? ''),
          workTitle: String(r.work_title ?? ''),
          watchedAt: String(r.created_at ?? ''),
        })),
        comments: {
          inferredByAuthorMatch: true,
          items: (comments ?? []).map((r: any) => ({
            id: String(r.id ?? ''),
            contentId: String(r.content_id ?? ''),
            contentTitle: String(r.content_title ?? ''),
            episodeId: r.episode_id === null || r.episode_id === undefined ? '' : String(r.episode_id ?? ''),
            author: String(r.author ?? ''),
            body: String(r.body ?? ''),
            status: String(r.status ?? ''),
            createdAt: String(r.created_at ?? ''),
          })),
        },
        castProfile:
          castProfileRow
            ? {
                requestId: String((castProfileRow as any).id ?? ''),
                name: String((castProfileRow as any).name ?? ''),
                email: String((castProfileRow as any).email ?? ''),
                submittedAt: String((castProfileRow as any).submitted_at ?? ''),
                decidedAt: (castProfileRow as any).decided_at ? String((castProfileRow as any).decided_at) : null,
                decidedByAdminId: (castProfileRow as any).decided_by_admin_id ? String((castProfileRow as any).decided_by_admin_id) : null,
                draft: castProfileDraft,
              }
            : null,
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Create end-user account (CMS)
app.post('/cms/users', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { email?: unknown; password?: unknown; phone?: unknown; emailVerified?: unknown; smsAuthSkip?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = normalizeEmail(String(body.email ?? ''))
  const password = String(body.password ?? '')
  const phoneRaw = String(body.phone ?? '').trim()
  const phone = phoneRaw ? clampText(phoneRaw, 30) : null
  const emailVerified = (() => {
    const v = (body as any).emailVerified
    if (v === true) return true
    if (v === 1) return true
    if (v === '1') return true
    if (v === 'true') return true
    return false
  })()
  const smsAuthSkip = parseBool01((body as any).smsAuthSkip) === 1
  if (!email) return c.json({ error: 'email is required' }, 400)
  if (!password || password.length < 8) return c.json({ error: 'password_too_short' }, 400)

  const { saltB64, hashB64 } = await hashPasswordForStorage(password)
  const id = uuidOrFallback('usr')
  const now = nowIso()

  try {
    await db
      .prepare(
        'INSERT INTO users (id, email, email_verified, phone, phone_verified, password_hash, password_salt, sms_auth_skip, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)'
      )
      .bind(id, email, emailVerified ? 1 : 0, phone, hashB64, saltB64, smsAuthSkip ? 1 : 0, now, now)
      .run()
    return c.json({ ok: true, id })
  } catch (err: any) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    // best-effort unique conflict
    const msg = String(err?.message ?? '')
    if (msg.includes('UNIQUE') || msg.toLowerCase().includes('unique')) return c.json({ error: 'email_already_exists' }, 409)
    throw err
  }
})

// Update end-user account (CMS)
app.put('/cms/users/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = {
    email?: unknown
    emailVerified?: unknown
    phone?: unknown
    phoneVerified?: unknown
    smsAuthSkip?: unknown
    profile?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body

  const sets: string[] = []
  const binds: any[] = []

  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    const email = normalizeEmail(String((body as any).email ?? ''))
    if (!email) return c.json({ error: 'email is required' }, 400)
    sets.push('email = ?')
    binds.push(email)
  }

  if (Object.prototype.hasOwnProperty.call(body, 'emailVerified')) {
    sets.push('email_verified = ?')
    binds.push(parseBool01((body as any).emailVerified))
  }

  if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
    const phoneRaw = String((body as any).phone ?? '').trim()
    const phone = phoneRaw ? clampText(phoneRaw, 30) : null
    sets.push('phone = ?')
    binds.push(phone)
  }

  if (Object.prototype.hasOwnProperty.call(body, 'phoneVerified')) {
    sets.push('phone_verified = ?')
    binds.push(parseBool01((body as any).phoneVerified))
  }

  if (Object.prototype.hasOwnProperty.call(body, 'smsAuthSkip')) {
    sets.push('sms_auth_skip = ?')
    binds.push(parseBool01((body as any).smsAuthSkip))
  }

  if (Object.prototype.hasOwnProperty.call(body, 'profile')) {
    const p = (body as any).profile && typeof (body as any).profile === 'object' ? (body as any).profile : {}

    if (Object.prototype.hasOwnProperty.call(p, 'displayName')) {
      sets.push('display_name = ?')
      binds.push(clampText(p.displayName, 80) ?? '')
    }
    if (Object.prototype.hasOwnProperty.call(p, 'avatarUrl')) {
      sets.push('avatar_url = ?')
      binds.push(clampText(p.avatarUrl, 500) ?? '')
    }
    if (Object.prototype.hasOwnProperty.call(p, 'fullName')) {
      sets.push('full_name = ?')
      binds.push(clampText(p.fullName, 120) ?? '')
    }
    if (Object.prototype.hasOwnProperty.call(p, 'fullNameKana')) {
      sets.push('full_name_kana = ?')
      binds.push(clampText(p.fullNameKana, 120) ?? '')
    }
    if (Object.prototype.hasOwnProperty.call(p, 'birthDate')) {
      sets.push('birth_date = ?')
      binds.push(clampText(p.birthDate, 30) ?? '')
    }
    if (Object.prototype.hasOwnProperty.call(p, 'favoriteGenres')) {
      const fav = (p as any).favoriteGenres
      const arr = Array.isArray(fav) ? fav : []
      const normalized = arr
        .map((v: any) => String(v ?? '').trim())
        .filter(Boolean)
        .slice(0, 50)
      const json = normalized.length ? JSON.stringify(normalized) : ''
      sets.push('favorite_genres_json = ?')
      binds.push(json)
    }
  }

  if (sets.length === 0) return c.json({ error: 'no_fields' }, 400)

  const now = nowIso()
  sets.push('updated_at = ?')
  binds.push(now)
  binds.push(id)

  try {
    await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
    return c.json({ ok: true })
  } catch (err: any) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    const msg = String(err?.message ?? '')
    if (msg.includes('UNIQUE') || msg.toLowerCase().includes('unique')) return c.json({ error: 'email_already_exists' }, 409)
    throw err
  }
})

// Comments moderation (CMS)
app.get('/cms/comments', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  const status = String(c.req.query('status') ?? '').trim()
  const contentId = String(c.req.query('contentId') ?? '').trim()
  const episodeId = String(c.req.query('episodeId') ?? '').trim()

  if (isMockRequest(c) || !c.env.DB) {
    const base = [
      { id: 'C0001', contentId: 'content-1', contentTitle: '作品A', episodeId: '1', author: '匿名', body: 'めちゃくちゃ続きが気になる…！', createdAt: '2026-01-10T12:00:00.000Z', status: 'pending', deleted: false },
      { id: 'C0009', contentId: 'content-2', contentTitle: '作品B', episodeId: '2', author: 'ユーザーB', body: 'ラストの展開が予想外で鳥肌…！！！', createdAt: '2026-01-09T10:15:00.000Z', status: 'approved', deleted: false },
    ]
    return c.json({ items: status ? base.filter((c) => c.status === status) : base })
  }

  const db = c.env.DB as D1Database
  try {
    const binds: any[] = []
    let where = 'WHERE c.deleted = 0'
    if (status) {
      where += ' AND c.status = ?'
      binds.push(status)
    }
    if (contentId) {
      where += ' AND c.content_id = ?'
      binds.push(contentId)
    }
    if (episodeId) {
      where += ' AND c.episode_id = ?'
      binds.push(episodeId)
    }

    const rows = await d1All(
      db,
      `SELECT c.id, c.content_id, c.episode_id, c.author, c.body, c.status, c.created_at, c.approved_at, c.deleted, c.moderation_note, c.moderated_at,
              COALESCE(w.title, '') AS content_title
       FROM comments c
       LEFT JOIN works w ON w.id = c.content_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT 200`,
      binds
    )

    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        contentId: String(r.content_id ?? ''),
        contentTitle: String(r.content_title ?? ''),
        episodeId: r.episode_id === null || r.episode_id === undefined ? '' : String(r.episode_id ?? ''),
        author: String(r.author ?? ''),
        body: String(r.body ?? ''),
        status: String(r.status ?? ''),
        createdAt: String(r.created_at ?? ''),
        approvedAt: r.approved_at === null || r.approved_at === undefined ? null : String(r.approved_at ?? ''),
        deleted: Number(r.deleted ?? 0) === 1,
        moderationNote: String(r.moderation_note ?? ''),
        moderatedAt: r.moderated_at === null || r.moderated_at === undefined ? null : String(r.moderated_at ?? ''),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Genres (CMS)
app.get('/cms/genres', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  let rows: any[] = []
  try {
    rows = await d1All(db, 'SELECT id, name, enabled, created_at, updated_at FROM genres ORDER BY name ASC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({
    items: rows.map((r) => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      enabled: Number(r.enabled ?? 0) === 1,
      createdAt: String(r.created_at ?? ''),
      updatedAt: String(r.updated_at ?? ''),
    })),
  })
})

app.get('/cms/genres/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  try {
    const row = await d1First(db, 'SELECT id, name, enabled, created_at, updated_at FROM genres WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        name: String((row as any).name ?? ''),
        enabled: Number((row as any).enabled ?? 0) === 1,
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/genres', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { name?: unknown; enabled?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = clampText(body.name, 80)
  const enabled = body.enabled === undefined ? 1 : parseBool01(body.enabled)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const createdAt = nowIso()
  const id = uuidOrFallback('genre')
  try {
    await db.prepare('INSERT INTO genres (id, name, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, name, enabled, createdAt, createdAt).run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true, id })
})

app.put('/cms/genres/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { name?: unknown; enabled?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = body.name === undefined ? null : clampText(body.name, 80)
  const enabled = body.enabled === undefined ? null : parseBool01(body.enabled)
  const updatedAt = nowIso()

  try {
    await db.prepare('UPDATE genres SET name = COALESCE(?, name), enabled = COALESCE(?, enabled), updated_at = ? WHERE id = ?').bind(name, enabled, updatedAt, id).run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/comments/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ item: { id, contentId: 'content-1', contentTitle: '作品A', episodeId: '1', author: '匿名', body: '本文', status: 'pending', createdAt: '', moderationNote: '' } })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(
      db,
      `SELECT c.id, c.content_id, c.episode_id, c.author, c.body, c.status, c.created_at, c.approved_at, c.deleted, c.moderation_note, c.moderated_at,
              COALESCE(w.title, '') AS content_title
       FROM comments c
       LEFT JOIN works w ON w.id = c.content_id
       WHERE c.id = ?
       LIMIT 1`,
      [id]
    )
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        contentId: String((row as any).content_id ?? ''),
        contentTitle: String((row as any).content_title ?? ''),
        episodeId: (row as any).episode_id === null || (row as any).episode_id === undefined ? '' : String((row as any).episode_id ?? ''),
        author: String((row as any).author ?? ''),
        body: String((row as any).body ?? ''),
        status: String((row as any).status ?? ''),
        createdAt: String((row as any).created_at ?? ''),
        approvedAt: (row as any).approved_at === null || (row as any).approved_at === undefined ? null : String((row as any).approved_at ?? ''),
        deleted: Number((row as any).deleted ?? 0) === 1,
        moderationNote: String((row as any).moderation_note ?? ''),
        moderatedAt: (row as any).moderated_at === null || (row as any).moderated_at === undefined ? null : String((row as any).moderated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/comments/:id/approve', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { note?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const note = body.note === undefined ? '' : clampText(body.note, 500)
  const now = nowIso()
  try {
    await c.env.DB
      .prepare("UPDATE comments SET status = 'approved', approved_at = ?, moderation_note = ?, moderated_at = ?, moderated_by_admin_id = ? WHERE id = ?")
      .bind(now, note, now, (admin as any).adminId ?? '', id)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/comments/:id/reject', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { note?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const note = body.note === undefined ? '' : clampText(body.note, 500)
  const now = nowIso()
  try {
    await c.env.DB
      .prepare("UPDATE comments SET status = 'rejected', approved_at = NULL, moderation_note = ?, moderated_at = ?, moderated_by_admin_id = ? WHERE id = ?")
      .bind(note, now, (admin as any).adminId ?? '', id)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.put('/cms/comments/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { status?: unknown; deleted?: unknown; note?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const status = body.status === undefined ? null : clampText(body.status, 20)
  const deleted = body.deleted === undefined ? null : parseBool01(body.deleted)
  const note = body.note === undefined ? null : clampText(body.note, 500)
  const now = nowIso()

  try {
    await c.env.DB
      .prepare(
        'UPDATE comments SET status = COALESCE(?, status), deleted = COALESCE(?, deleted), moderation_note = COALESCE(?, moderation_note), moderated_at = ?, moderated_by_admin_id = ? WHERE id = ?'
      )
      .bind(status, deleted, note, now, (admin as any).adminId ?? '', id)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Inquiries (CMS)
app.get('/cms/inquiries', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ items: [{ id: 'IQ0001', subject: 'お問い合わせ（サンプル）', status: 'open', createdAt: '2026-01-10T00:00:00.000Z' }] })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(db, 'SELECT id, subject, status, created_at, updated_at FROM inquiries ORDER BY created_at DESC LIMIT 200')
    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        subject: String(r.subject ?? ''),
        status: String(r.status ?? 'open'),
        createdAt: String(r.created_at ?? ''),
        updatedAt: String(r.updated_at ?? ''),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/inquiries/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ item: { id, subject: 'お問い合わせ（サンプル）', body: '本文', status: 'open', createdAt: '', updatedAt: '' } })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(db, 'SELECT id, subject, body, status, created_at, updated_at FROM inquiries WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        subject: String((row as any).subject ?? ''),
        body: String((row as any).body ?? ''),
        status: String((row as any).status ?? 'open'),
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.put('/cms/inquiries/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { status?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const status = body.status === undefined ? null : clampText(body.status, 20)
  const updatedAt = nowIso()
  try {
    await c.env.DB.prepare('UPDATE inquiries SET status = COALESCE(?, status), updated_at = ? WHERE id = ?').bind(status, updatedAt, id).run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Settings (CMS)
app.get('/cms/settings', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ maintenanceMode: false, maintenanceMessage: '' })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(db, 'SELECT key, value FROM app_settings')
    const map = new Map<string, string>()
    for (const r of rows) map.set(String((r as any).key ?? ''), String((r as any).value ?? ''))
    return c.json({
      maintenanceMode: map.get('maintenance_mode') === '1',
      maintenanceMessage: map.get('maintenance_message') ?? '',
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.put('/cms/settings', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { maintenanceMode?: unknown; maintenanceMessage?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const maintenanceMode = body.maintenanceMode === undefined ? null : parseBool01(body.maintenanceMode)
  const maintenanceMessage = body.maintenanceMessage === undefined ? null : clampText(body.maintenanceMessage, 500)
  const now = nowIso()

  try {
    if (maintenanceMode !== null) {
      await db
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
        )
        .bind('maintenance_mode', maintenanceMode ? '1' : '0', now)
        .run()
    }
    if (maintenanceMessage !== null) {
      await db
        .prepare(
          'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
        )
        .bind('maintenance_message', maintenanceMessage, now)
        .run()
    }
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Dev-only: D1 schema inspection for local development
app.get('/dev/d1-schema', async (c) => {
  if (!shouldReturnDebugCodes(c.env)) return c.json({ error: 'dev_only' }, 404)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const db = c.env.DB as D1Database
  const isSqliteAuth = (err: unknown) => /SQLITE_AUTH/i.test(String((err as any)?.message ?? err))
  try {
    let listRes: { results?: any[] } = { results: [] }
    try {
      listRes = await db.prepare('PRAGMA table_list').all<any>()
    } catch (err) {
      if (!isSqliteAuth(err)) throw err
      listRes = await db.prepare('SELECT name, schema, type FROM pragma_table_list').all<any>()
    }
    const tables: Array<{ name: string; sql: string | null; columns: any[] }> = []
    const rows = (listRes.results ?? []) as any[]
    const quoteId = (name: string) => `"${String(name).replace(/"/g, '""')}"`

    for (const row of rows) {
      const name = String(row?.name ?? row?.tbl_name ?? '').trim()
      const type = String(row?.type ?? '').trim().toLowerCase()
      const schema = String(row?.schema ?? '').trim().toLowerCase()
      if (!name || type && type !== 'table') continue
      if (schema && schema !== 'main') continue
      if (name.startsWith('sqlite_')) continue

      let colsRes: { results?: any[] } = { results: [] }
      try {
        colsRes = await db.prepare(`PRAGMA table_info(${quoteId(name)})`).all<any>()
      } catch (err) {
        if (!isSqliteAuth(err)) throw err
        try {
          colsRes = await db.prepare('SELECT * FROM pragma_table_info(?)').bind(name).all<any>()
        } catch (err2) {
          if (!isSqliteAuth(err2)) throw err2
          colsRes = { results: [] }
        }
      }
      const columns = (colsRes.results ?? []) as any[]
      tables.push({ name, sql: null, columns })
    }

    return c.json({ tables })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    const detail = String((err as any)?.message ?? err)
    if (isSqliteAuth(err)) {
      return c.json(
        {
          error: 'd1_schema_not_authorized',
          message: 'D1 schema introspection is not authorized in this runtime.',
          detail: shouldReturnDebugCodes(c.env) ? detail : undefined,
        },
        500
      )
    }
    return c.json(
      {
        error: 'd1_schema_failed',
        message: 'Failed to read D1 schema.',
        detail: shouldReturnDebugCodes(c.env) ? detail : undefined,
      },
      500
    )
  }
})

// Casts
app.get('/cms/casts', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  let rows: any[] = []
  try {
    rows = await d1All(db, 'SELECT id, name, role, thumbnail_url, category_id, created_at, updated_at FROM casts ORDER BY name ASC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    role: String(r.role ?? ''),
    thumbnailUrl: String(r.thumbnail_url ?? ''),
    categoryId: r.category_id === null || r.category_id === undefined ? '' : String(r.category_id ?? ''),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }))
  return c.json({ items })
})

app.get('/cms/casts/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  let row: any = null
  try {
    row = await d1First(db, 'SELECT id, name, role, thumbnail_url, category_id, created_at, updated_at FROM casts WHERE id = ?', [id])
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  if (!row) return c.json({ error: 'not_found' }, 404)

  let favoritesCount = 0
  let worksCount = 0
  let videosCount = 0
  let works: any[] = []
  let videos: any[] = []

  try {
    const [favRow, workCountRow, videoCountRow, workRows, videoRows] = await Promise.all([
      d1First(db, 'SELECT COUNT(*) AS cnt FROM favorite_casts WHERE cast_id = ?', [id]),
      d1First(db, 'SELECT COUNT(*) AS cnt FROM work_casts WHERE cast_id = ?', [id]),
      d1First(db, 'SELECT COUNT(*) AS cnt FROM video_casts WHERE cast_id = ?', [id]),
      d1All(
        db,
        `SELECT w.id, w.title, wc.role_name
         FROM work_casts wc
         JOIN works w ON w.id = wc.work_id
         WHERE wc.cast_id = ?
         ORDER BY wc.sort_order ASC, w.created_at DESC
         LIMIT 50`,
        [id]
      ),
      d1All(
        db,
        `SELECT v.id, v.title, v.work_id, COALESCE(w.title, '') AS work_title, vc.role_name
         FROM video_casts vc
         JOIN videos v ON v.id = vc.video_id
         LEFT JOIN works w ON w.id = v.work_id
         WHERE vc.cast_id = ?
         ORDER BY vc.sort_order ASC, v.created_at DESC
         LIMIT 50`,
        [id]
      ),
    ])

    favoritesCount = Number((favRow as any)?.cnt ?? 0)
    worksCount = Number((workCountRow as any)?.cnt ?? 0)
    videosCount = Number((videoCountRow as any)?.cnt ?? 0)
    works = Array.isArray(workRows) ? workRows : []
    videos = Array.isArray(videoRows) ? videoRows : []
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({
    item: {
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      role: String(row.role ?? ''),
      thumbnailUrl: String(row.thumbnail_url ?? ''),
      categoryId: row.category_id === null || row.category_id === undefined ? '' : String(row.category_id ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
    },
    stats: {
      favoritesCount,
      worksCount,
      videosCount,
    },
    works: works.map((r) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      roleName: String(r.role_name ?? ''),
    })),
    videos: videos.map((r) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      workId: String(r.work_id ?? ''),
      workTitle: String(r.work_title ?? ''),
      roleName: String(r.role_name ?? ''),
    })),
  })
})

app.post('/cms/casts', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { name?: unknown; role?: unknown; thumbnailUrl?: unknown; categoryId?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = clampText(body.name, 120)
  const role = clampText(body.role, 80)
  const thumbnailUrl = clampText(body.thumbnailUrl, 500)
  const categoryId = clampText(body.categoryId, 80)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const createdAt = nowIso()
  const id = uuidOrFallback('cast')
  try {
    await db
      .prepare('INSERT INTO casts (id, name, role, thumbnail_url, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, name, role, thumbnailUrl, categoryId || null, createdAt, createdAt)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true, id })
})

app.put('/cms/casts/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { name?: unknown; role?: unknown; thumbnailUrl?: unknown; categoryId?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = body.name === undefined ? null : clampText(body.name, 120)
  const role = body.role === undefined ? null : clampText(body.role, 80)
  const thumbnailUrl = body.thumbnailUrl === undefined ? null : clampText(body.thumbnailUrl, 500)
  const categoryId = body.categoryId === undefined ? null : clampText(body.categoryId, 80)
  const updatedAt = nowIso()
  try {
    await db
      .prepare('UPDATE casts SET name = COALESCE(?, name), role = COALESCE(?, role), thumbnail_url = COALESCE(?, thumbnail_url), category_id = COALESCE(?, category_id), updated_at = ? WHERE id = ?')
      .bind(name, role, thumbnailUrl, categoryId || null, updatedAt, id)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true })
})

// ---- CMS: Cast/staff registration (creates a login account + public cast record) ----

type CmsCastStaffItem = {
  castId: string
  userId: string | null
  displayName: string
  nameKana: string
  nameEn: string
  role: string
  profileImageUrl: string
  profileImages: string[]
  faceImageUrl: string
  email: string
  phone: string
  birthDate: string
  // Private fields (not public)
  realName: string
  privateBirthDate: string
  bloodType: string
  birthplace: string
  residence: string
  education: string
  heightCm: string
  weightKg: string
  bustCm: string
  waistCm: string
  hipCm: string
  shoeCm: string
  qualifications: string
  skillsHobbies: string
  hobbies: string
  specialSkills: string
  sns: Array<{ label: string; url: string }>
  bio: string
  career: string
  privatePdfUrl: string
  contactEmail: string
  contactPhone: string
  appearances: string
  castCategoryId: string
  videoContentUrl: string
  createdAt: string
  updatedAt: string
}

function safeJsonStringify(v: any, fallback: string, maxLen: number): string {
  try {
    const s = JSON.stringify(v ?? JSON.parse(fallback))
    if (!s || s.length > maxLen) return fallback
    return s
  } catch {
    return fallback
  }
}

function safeJsonParseArray<T>(s: string, map: (v: any) => T, max: number): T[] {
  try {
    const parsed = JSON.parse(String(s ?? ''))
    if (!Array.isArray(parsed)) return []
    const out: T[] = []
    for (const item of parsed) {
      out.push(map(item))
      if (out.length >= max) break
    }
    return out
  } catch {
    return []
  }
}

function safeIsoDate(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  // Accept YYYY-MM-DD only (UI uses <input type="date">).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  return s
}

async function upsertApprovedCastProfileRequest(params: {
  db: D1Database
  adminId: string
  userId: string
  email: string
  name: string
  draft: any
}) {
  const { db, adminId, userId, email, name, draft } = params
  const now = nowIso()
  const draftJson = (() => {
    try {
      return JSON.stringify(draft ?? {})
    } catch {
      return '{}'
    }
  })()

  // Ensure the user is treated as a cast account by CMS and internal logic.
  await db
    .prepare(
      `INSERT INTO cast_profile_requests
        (id, user_id, email, name, draft_json, status, submitted_at, decided_at, decided_by_admin_id, rejection_reason)
       VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, '')`
    )
    .bind(uuidOrFallback('cpr'), userId, email, name, draftJson, now, now, adminId)
    .run()
}

app.get('/cms/cast-staff/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const db = c.env.DB as D1Database
  const castId = String(c.req.param('id') ?? '').trim()
  if (!castId) return c.json({ error: 'id is required' }, 400)

  try {
    const castRow = await d1First(
      db,
      'SELECT id, name, role, thumbnail_url, category_id, created_at, updated_at FROM casts WHERE id = ? LIMIT 1',
      [castId]
    )
    if (!castRow) return c.json({ error: 'not_found' }, 404)

    const profileRow = await d1First(
      db,
      `SELECT cast_id, user_id, appearances, video_url,
              name_kana, name_en,
              profile_images_json, sns_json,
              face_image_url, private_pdf_url,
              hobbies, special_skills, bio, career,
              real_name, private_birth_date, blood_type, birthplace, residence, education,
              height_cm, weight_kg, bust_cm, waist_cm, hip_cm, shoe_cm,
              qualifications, skills_hobbies,
              contact_email, contact_phone,
              created_at, updated_at
         FROM cast_staff_profiles
        WHERE cast_id = ?
        LIMIT 1`,
      [castId]
    )

    const userId = profileRow ? String((profileRow as any).user_id ?? '') : ''
    const userRow = userId
      ? await d1First(
          db,
          'SELECT id, email, phone, display_name, avatar_url, birth_date, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
          [userId]
        )
      : null

    const item: CmsCastStaffItem = {
      castId: String((castRow as any).id ?? ''),
      userId: userRow ? String((userRow as any).id ?? '') : null,
      displayName: String((castRow as any).name ?? ''),
      nameKana: profileRow ? String((profileRow as any).name_kana ?? '') : '',
      nameEn: profileRow ? String((profileRow as any).name_en ?? '') : '',
      role: String((castRow as any).role ?? ''),
      profileImageUrl: String((castRow as any).thumbnail_url ?? ''),
      profileImages: profileRow
        ? safeJsonParseArray<string>(String((profileRow as any).profile_images_json ?? '[]'), (v) => String(v ?? '').trim(), 10).filter(Boolean)
        : [],
      faceImageUrl: profileRow ? String((profileRow as any).face_image_url ?? '') : '',
      email: userRow ? String((userRow as any).email ?? '') : '',
      phone:
        userRow && (userRow as any).phone !== null && (userRow as any).phone !== undefined ? String((userRow as any).phone ?? '') : '',
      birthDate: userRow ? String((userRow as any).birth_date ?? '') : '',
      realName: profileRow ? String((profileRow as any).real_name ?? '') : '',
      privateBirthDate: profileRow ? String((profileRow as any).private_birth_date ?? '') : '',
      bloodType: profileRow ? String((profileRow as any).blood_type ?? '') : '',
      birthplace: profileRow ? String((profileRow as any).birthplace ?? '') : '',
      residence: profileRow ? String((profileRow as any).residence ?? '') : '',
      education: profileRow ? String((profileRow as any).education ?? '') : '',
      heightCm: profileRow ? String((profileRow as any).height_cm ?? '') : '',
      weightKg: profileRow ? String((profileRow as any).weight_kg ?? '') : '',
      bustCm: profileRow ? String((profileRow as any).bust_cm ?? '') : '',
      waistCm: profileRow ? String((profileRow as any).waist_cm ?? '') : '',
      hipCm: profileRow ? String((profileRow as any).hip_cm ?? '') : '',
      shoeCm: profileRow ? String((profileRow as any).shoe_cm ?? '') : '',
      qualifications: profileRow ? String((profileRow as any).qualifications ?? '') : '',
      skillsHobbies: profileRow ? String((profileRow as any).skills_hobbies ?? '') : '',
      hobbies: profileRow ? String((profileRow as any).hobbies ?? '') : '',
      specialSkills: profileRow ? String((profileRow as any).special_skills ?? '') : '',
      sns: profileRow
        ? safeJsonParseArray<{ label: string; url: string }>(
            String((profileRow as any).sns_json ?? '[]'),
            (v) => ({ label: String(v?.label ?? '').trim(), url: String(v?.url ?? '').trim() }),
            20
          ).filter((v) => v.label || v.url)
        : [],
      bio: profileRow ? String((profileRow as any).bio ?? '') : '',
      career: profileRow ? String((profileRow as any).career ?? '') : '',
      privatePdfUrl: profileRow ? String((profileRow as any).private_pdf_url ?? '') : '',
      contactEmail: profileRow ? String((profileRow as any).contact_email ?? '') : '',
      contactPhone: profileRow ? String((profileRow as any).contact_phone ?? '') : '',
      appearances: profileRow ? String((profileRow as any).appearances ?? '') : '',
      castCategoryId:
        (castRow as any).category_id === null || (castRow as any).category_id === undefined ? '' : String((castRow as any).category_id ?? ''),
      videoContentUrl: profileRow ? String((profileRow as any).video_url ?? '') : '',
      createdAt: String((castRow as any).created_at ?? ''),
      updatedAt: String((castRow as any).updated_at ?? ''),
    }

    return c.json({ item })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/cast-staff', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = {
    displayName?: unknown
    nameKana?: unknown
    nameEn?: unknown
    role?: unknown
    profileImageUrl?: unknown
    profileImages?: unknown
    faceImageUrl?: unknown
    hobbies?: unknown
    specialSkills?: unknown
    sns?: unknown
    bio?: unknown
    career?: unknown
    privatePdfUrl?: unknown
    email?: unknown
    password?: unknown
    phone?: unknown
    birthDate?: unknown
    realName?: unknown
    privateBirthDate?: unknown
    bloodType?: unknown
    birthplace?: unknown
    residence?: unknown
    education?: unknown
    heightCm?: unknown
    weightKg?: unknown
    bustCm?: unknown
    waistCm?: unknown
    hipCm?: unknown
    shoeCm?: unknown
    qualifications?: unknown
    skillsHobbies?: unknown
    contactEmail?: unknown
    contactPhone?: unknown
    appearances?: unknown
    castCategoryId?: unknown
    videoContentUrl?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body

  const displayName = clampText(body.displayName, 120)
  const nameKana = clampText(body.nameKana, 120)
  const nameEn = clampText(body.nameEn, 120)
  const role = clampText(body.role, 80)
  const profileImageUrl = clampText(body.profileImageUrl, 500)

  const profileImagesJson = safeJsonStringify(
    Array.isArray(body.profileImages)
      ? (body.profileImages as any[])
          .map((v) => clampText(String(v ?? '').trim(), 500))
          .filter(Boolean)
          .slice(0, 10)
      : [],
    '[]',
    20000
  )

  const faceImageUrl = clampText(body.faceImageUrl, 500)
  const hobbies = clampText(body.hobbies, 200)
  const specialSkills = clampText(body.specialSkills, 200)
  const snsJson = safeJsonStringify(
    Array.isArray(body.sns)
      ? (body.sns as any[])
          .map((v) => ({
            label: clampText(String(v?.label ?? '').trim(), 40),
            url: clampText(String(v?.url ?? '').trim(), 500),
          }))
          .filter((v) => v.label || v.url)
          .slice(0, 20)
      : [],
    '[]',
    20000
  )

  const bio = clampText(body.bio, 10000)
  const career = clampText(body.career, 10000)
  const privatePdfUrl = clampText(body.privatePdfUrl, 500)
  const email = normalizeEmail(String(body.email ?? ''))
  const password = String(body.password ?? '')
  const phoneRaw = String(body.phone ?? '').trim()
  const phone = phoneRaw ? clampText(phoneRaw, 30) : null
  const birthDate = safeIsoDate(body.birthDate)

  const realName = clampText(body.realName, 120)
  const privateBirthDate = safeIsoDate(body.privateBirthDate)
  const bloodType = clampText(body.bloodType, 10)
  const birthplace = clampText(body.birthplace, 120)
  const residence = clampText(body.residence, 120)
  const education = clampText(body.education, 200)

  const heightCm = clampText(body.heightCm, 20)
  const weightKg = clampText(body.weightKg, 20)
  const bustCm = clampText(body.bustCm, 20)
  const waistCm = clampText(body.waistCm, 20)
  const hipCm = clampText(body.hipCm, 20)
  const shoeCm = clampText(body.shoeCm, 20)

  const qualifications = clampText(body.qualifications, 5000)
  const skillsHobbies = clampText(body.skillsHobbies, 5000)

  const contactEmail = normalizeEmail(String(body.contactEmail ?? ''))
  const contactPhoneRaw = String(body.contactPhone ?? '').trim()
  const contactPhone = contactPhoneRaw ? clampText(contactPhoneRaw, 30) : ''
  const appearances = clampText(body.appearances, 5000)
  const castCategoryId = clampText(body.castCategoryId, 80)
  const videoContentUrl = clampText(body.videoContentUrl, 500)

  if (!displayName) return c.json({ error: 'displayName is required' }, 400)
  if (!email) return c.json({ error: 'email is required' }, 400)
  if (!password || password.length < 8) return c.json({ error: 'password_too_short' }, 400)

  const now = nowIso()
  const userId = uuidOrFallback('usr')
  const castId = uuidOrFallback('cast')

  const { saltB64, hashB64 } = await hashPasswordForStorage(password)

  try {
    await db
      .prepare(
        'INSERT INTO users (id, email, email_verified, phone, phone_verified, password_hash, password_salt, display_name, avatar_url, birth_date, created_at, updated_at) VALUES (?, ?, 1, ?, 0, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(userId, email, phone, hashB64, saltB64, displayName, profileImageUrl, birthDate, now, now)
      .run()

    await db
      .prepare('INSERT INTO casts (id, name, role, thumbnail_url, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(castId, displayName, role, profileImageUrl, castCategoryId || null, now, now)
      .run()

    await db
      .prepare(
        `INSERT INTO cast_staff_profiles (
           cast_id, user_id, appearances, video_url,
           name_kana, name_en,
           profile_images_json, sns_json,
           face_image_url, private_pdf_url,
           hobbies, special_skills, bio, career,
           real_name, private_birth_date, blood_type, birthplace, residence, education,
           height_cm, weight_kg, bust_cm, waist_cm, hip_cm, shoe_cm,
           qualifications, skills_hobbies,
           contact_email, contact_phone,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        castId,
        userId,
        appearances,
        videoContentUrl,
        nameKana,
        nameEn,
        profileImagesJson,
        snsJson,
        faceImageUrl,
        privatePdfUrl,
        hobbies,
        specialSkills,
        bio,
        career,
        realName,
        privateBirthDate,
        bloodType,
        birthplace,
        residence,
        education,
        heightCm,
        weightKg,
        bustCm,
        waistCm,
        hipCm,
        shoeCm,
        qualifications,
        skillsHobbies,
        contactEmail,
        contactPhone,
        now,
        now
      )
      .run()

    await upsertApprovedCastProfileRequest({
      db,
      adminId: String((admin as any).adminId ?? ''),
      userId,
      email,
      name: displayName,
      draft: {
        displayName,
        role,
        profileImageUrl,
        birthDate,
        phone: phone ?? '',
        appearances,
        castCategoryId,
        videoContentUrl,
        createdBy: 'cms',
      },
    })

    return c.json({ ok: true, castId, userId })
  } catch (err: any) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    const msg = String(err?.message ?? '')
    if (msg.includes('UNIQUE') || msg.toLowerCase().includes('unique')) return c.json({ error: 'email_already_exists' }, 409)
    throw err
  }
})

app.put('/cms/cast-staff/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const castId = String(c.req.param('id') ?? '').trim()
  if (!castId) return c.json({ error: 'id is required' }, 400)

  type Body = {
    displayName?: unknown
    nameKana?: unknown
    nameEn?: unknown
    role?: unknown
    profileImageUrl?: unknown
    profileImages?: unknown
    faceImageUrl?: unknown
    hobbies?: unknown
    specialSkills?: unknown
    sns?: unknown
    bio?: unknown
    career?: unknown
    privatePdfUrl?: unknown
    email?: unknown
    password?: unknown
    phone?: unknown
    birthDate?: unknown
    realName?: unknown
    privateBirthDate?: unknown
    bloodType?: unknown
    birthplace?: unknown
    residence?: unknown
    education?: unknown
    heightCm?: unknown
    weightKg?: unknown
    bustCm?: unknown
    waistCm?: unknown
    hipCm?: unknown
    shoeCm?: unknown
    qualifications?: unknown
    skillsHobbies?: unknown
    contactEmail?: unknown
    contactPhone?: unknown
    appearances?: unknown
    castCategoryId?: unknown
    videoContentUrl?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body

  const displayName = body.displayName === undefined ? null : clampText(body.displayName, 120)
  const nameKana = body.nameKana === undefined ? null : clampText(body.nameKana, 120)
  const nameEn = body.nameEn === undefined ? null : clampText(body.nameEn, 120)
  const role = body.role === undefined ? null : clampText(body.role, 80)
  const profileImageUrl = body.profileImageUrl === undefined ? null : clampText(body.profileImageUrl, 500)

  const profileImagesJson =
    body.profileImages === undefined
      ? null
      : safeJsonStringify(
          Array.isArray(body.profileImages)
            ? (body.profileImages as any[])
                .map((v) => clampText(String(v ?? '').trim(), 500))
                .filter(Boolean)
                .slice(0, 10)
            : [],
          '[]',
          20000
        )

  const faceImageUrl = body.faceImageUrl === undefined ? null : clampText(body.faceImageUrl, 500)
  const hobbies = body.hobbies === undefined ? null : clampText(body.hobbies, 200)
  const specialSkills = body.specialSkills === undefined ? null : clampText(body.specialSkills, 200)
  const snsJson =
    body.sns === undefined
      ? null
      : safeJsonStringify(
          Array.isArray(body.sns)
            ? (body.sns as any[])
                .map((v) => ({
                  label: clampText(String(v?.label ?? '').trim(), 40),
                  url: clampText(String(v?.url ?? '').trim(), 500),
                }))
                .filter((v) => v.label || v.url)
                .slice(0, 20)
            : [],
          '[]',
          20000
        )

  const bio = body.bio === undefined ? null : clampText(body.bio, 10000)
  const career = body.career === undefined ? null : clampText(body.career, 10000)
  const privatePdfUrl = body.privatePdfUrl === undefined ? null : clampText(body.privatePdfUrl, 500)
  const email = body.email === undefined ? null : normalizeEmail(String(body.email ?? ''))
  const password = body.password === undefined ? null : String(body.password ?? '')
  const phoneRaw = body.phone === undefined ? null : String(body.phone ?? '').trim()
  const phone = phoneRaw === null ? null : phoneRaw ? clampText(phoneRaw, 30) : ''
  const birthDate = body.birthDate === undefined ? null : safeIsoDate(body.birthDate)

  const realName = body.realName === undefined ? null : clampText(body.realName, 120)
  const privateBirthDate = body.privateBirthDate === undefined ? null : safeIsoDate(body.privateBirthDate)
  const bloodType = body.bloodType === undefined ? null : clampText(body.bloodType, 10)
  const birthplace = body.birthplace === undefined ? null : clampText(body.birthplace, 120)
  const residence = body.residence === undefined ? null : clampText(body.residence, 120)
  const education = body.education === undefined ? null : clampText(body.education, 200)

  const heightCm = body.heightCm === undefined ? null : clampText(body.heightCm, 20)
  const weightKg = body.weightKg === undefined ? null : clampText(body.weightKg, 20)
  const bustCm = body.bustCm === undefined ? null : clampText(body.bustCm, 20)
  const waistCm = body.waistCm === undefined ? null : clampText(body.waistCm, 20)
  const hipCm = body.hipCm === undefined ? null : clampText(body.hipCm, 20)
  const shoeCm = body.shoeCm === undefined ? null : clampText(body.shoeCm, 20)

  const qualifications = body.qualifications === undefined ? null : clampText(body.qualifications, 5000)
  const skillsHobbies = body.skillsHobbies === undefined ? null : clampText(body.skillsHobbies, 5000)

  const contactEmail = body.contactEmail === undefined ? null : normalizeEmail(String(body.contactEmail ?? ''))
  const contactPhoneRaw = body.contactPhone === undefined ? null : String(body.contactPhone ?? '').trim()
  const contactPhone = contactPhoneRaw === null ? null : contactPhoneRaw ? clampText(contactPhoneRaw, 30) : ''
  const appearances = body.appearances === undefined ? null : clampText(body.appearances, 5000)
  const castCategoryId = body.castCategoryId === undefined ? null : clampText(body.castCategoryId, 80)
  const videoContentUrl = body.videoContentUrl === undefined ? null : clampText(body.videoContentUrl, 500)

  if (email !== null && !email) return c.json({ error: 'email is required' }, 400)
  if (password !== null && password && password.length < 8) return c.json({ error: 'password_too_short' }, 400)

  const now = nowIso()

  try {
    const castRow = await d1First(db, 'SELECT id FROM casts WHERE id = ? LIMIT 1', [castId])
    if (!castRow) return c.json({ error: 'not_found' }, 404)

    const profileRow = await d1First(db, 'SELECT cast_id, user_id FROM cast_staff_profiles WHERE cast_id = ? LIMIT 1', [castId])
    const existingUserId = profileRow ? String((profileRow as any).user_id ?? '') : ''

    let userId = existingUserId

    // If no user is linked yet and admin provided email+password, create a new user and link.
    if (!userId && email && password) {
      const newUserId = uuidOrFallback('usr')
      const { saltB64, hashB64 } = await hashPasswordForStorage(password)

      await db
        .prepare(
          'INSERT INTO users (id, email, email_verified, phone, phone_verified, password_hash, password_salt, display_name, avatar_url, birth_date, created_at, updated_at) VALUES (?, ?, 1, ?, 0, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          newUserId,
          email,
          phone === null ? null : phone,
          hashB64,
          saltB64,
          (displayName ?? '').trim(),
          (profileImageUrl ?? '').trim(),
          birthDate ?? '',
          now,
          now
        )
        .run()

      userId = newUserId

      await db
        .prepare(
          'INSERT INTO cast_staff_profiles (cast_id, user_id, appearances, video_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(cast_id) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at'
        )
        .bind(castId, userId, appearances ?? '', videoContentUrl ?? '', now, now)
        .run()

      await upsertApprovedCastProfileRequest({
        db,
        adminId: String((admin as any).adminId ?? ''),
        userId,
        email,
        name: (displayName ?? '').trim() || castId,
        draft: {
          displayName: (displayName ?? '').trim(),
          role: (role ?? '').trim(),
          profileImageUrl: (profileImageUrl ?? '').trim(),
          birthDate: birthDate ?? '',
          phone: phone ?? '',
          appearances: (appearances ?? '').trim(),
          castCategoryId: (castCategoryId ?? '').trim(),
          videoContentUrl: (videoContentUrl ?? '').trim(),
          createdBy: 'cms',
        },
      })
    }

    // Update cast public info
    await db
      .prepare(
        'UPDATE casts SET name = COALESCE(?, name), role = COALESCE(?, role), thumbnail_url = COALESCE(?, thumbnail_url), category_id = COALESCE(?, category_id), updated_at = ? WHERE id = ?'
      )
      .bind(displayName, role, profileImageUrl, castCategoryId === null ? null : castCategoryId || null, now, castId)
      .run()

    // Upsert profile row (store long text + URL). Keep user_id if already linked.
    await db
      .prepare(
        `INSERT INTO cast_staff_profiles (
           cast_id, user_id, appearances, video_url,
           name_kana, name_en,
           profile_images_json, sns_json,
           face_image_url, private_pdf_url,
           hobbies, special_skills, bio, career,
           real_name, private_birth_date, blood_type, birthplace, residence, education,
           height_cm, weight_kg, bust_cm, waist_cm, hip_cm, shoe_cm,
           qualifications, skills_hobbies,
           contact_email, contact_phone,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cast_id) DO UPDATE SET
           user_id = COALESCE(excluded.user_id, cast_staff_profiles.user_id),
           appearances = COALESCE(?, cast_staff_profiles.appearances),
           video_url = COALESCE(?, cast_staff_profiles.video_url),
           name_kana = COALESCE(?, cast_staff_profiles.name_kana),
           name_en = COALESCE(?, cast_staff_profiles.name_en),
           profile_images_json = COALESCE(?, cast_staff_profiles.profile_images_json),
           sns_json = COALESCE(?, cast_staff_profiles.sns_json),
           face_image_url = COALESCE(?, cast_staff_profiles.face_image_url),
           private_pdf_url = COALESCE(?, cast_staff_profiles.private_pdf_url),
           hobbies = COALESCE(?, cast_staff_profiles.hobbies),
           special_skills = COALESCE(?, cast_staff_profiles.special_skills),
           bio = COALESCE(?, cast_staff_profiles.bio),
           career = COALESCE(?, cast_staff_profiles.career),
           real_name = COALESCE(?, cast_staff_profiles.real_name),
           private_birth_date = COALESCE(?, cast_staff_profiles.private_birth_date),
           blood_type = COALESCE(?, cast_staff_profiles.blood_type),
           birthplace = COALESCE(?, cast_staff_profiles.birthplace),
           residence = COALESCE(?, cast_staff_profiles.residence),
           education = COALESCE(?, cast_staff_profiles.education),
           height_cm = COALESCE(?, cast_staff_profiles.height_cm),
           weight_kg = COALESCE(?, cast_staff_profiles.weight_kg),
           bust_cm = COALESCE(?, cast_staff_profiles.bust_cm),
           waist_cm = COALESCE(?, cast_staff_profiles.waist_cm),
           hip_cm = COALESCE(?, cast_staff_profiles.hip_cm),
           shoe_cm = COALESCE(?, cast_staff_profiles.shoe_cm),
           qualifications = COALESCE(?, cast_staff_profiles.qualifications),
           skills_hobbies = COALESCE(?, cast_staff_profiles.skills_hobbies),
           contact_email = COALESCE(?, cast_staff_profiles.contact_email),
           contact_phone = COALESCE(?, cast_staff_profiles.contact_phone),
           updated_at = ?`
      )
      .bind(
        castId,
        userId || null,
        appearances ?? '',
        videoContentUrl ?? '',
        (nameKana ?? '') as any,
        (nameEn ?? '') as any,
        (profileImagesJson ?? '[]') as any,
        (snsJson ?? '[]') as any,
        (faceImageUrl ?? '') as any,
        (privatePdfUrl ?? '') as any,
        (hobbies ?? '') as any,
        (specialSkills ?? '') as any,
        (bio ?? '') as any,
        (career ?? '') as any,
        realName ?? '',
        privateBirthDate ?? '',
        bloodType ?? '',
        birthplace ?? '',
        residence ?? '',
        education ?? '',
        heightCm ?? '',
        weightKg ?? '',
        bustCm ?? '',
        waistCm ?? '',
        hipCm ?? '',
        shoeCm ?? '',
        qualifications ?? '',
        skillsHobbies ?? '',
        contactEmail ?? '',
        contactPhone ?? '',
        now,
        now,
        appearances,
        videoContentUrl,
        nameKana,
        nameEn,
        profileImagesJson,
        snsJson,
        faceImageUrl,
        privatePdfUrl,
        hobbies,
        specialSkills,
        bio,
        career,
        realName,
        privateBirthDate,
        bloodType,
        birthplace,
        residence,
        education,
        heightCm,
        weightKg,
        bustCm,
        waistCm,
        hipCm,
        shoeCm,
        qualifications,
        skillsHobbies,
        contactEmail,
        contactPhone,
        now
      )
      .run()

    // Update linked user if present
    if (userId) {
      if (password !== null && password) {
        const { saltB64, hashB64 } = await hashPasswordForStorage(password)
        await db
          .prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
          .bind(hashB64, saltB64, now, userId)
          .run()
      }

      await db
        .prepare(
          `UPDATE users SET
             email = COALESCE(?, email),
             phone = COALESCE(?, phone),
             display_name = COALESCE(?, display_name),
             avatar_url = COALESCE(?, avatar_url),
             birth_date = COALESCE(?, birth_date),
             updated_at = ?
           WHERE id = ?`
        )
        .bind(
          email,
          phone === null ? null : phone,
          displayName,
          profileImageUrl,
          birthDate,
          now,
          userId
        )
        .run()
    }

    return c.json({ ok: true, castId, userId: userId || null })
  } catch (err: any) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    const msg = String(err?.message ?? '')
    if (msg.includes('UNIQUE') || msg.toLowerCase().includes('unique')) return c.json({ error: 'email_already_exists' }, 409)
    throw err
  }
})

// Cast categories (CMS)
app.get('/cms/cast-categories', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  let rows: any[] = []
  try {
    rows = await d1All(db, 'SELECT id, name, enabled, created_at, updated_at FROM cast_categories ORDER BY name ASC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({
    items: rows.map((r) => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      enabled: Number(r.enabled ?? 0) === 1,
      createdAt: String(r.created_at ?? ''),
      updatedAt: String(r.updated_at ?? ''),
    })),
  })
})

app.get('/cms/cast-categories/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  try {
    const row = await d1First(db, 'SELECT id, name, enabled, created_at, updated_at FROM cast_categories WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        name: String((row as any).name ?? ''),
        enabled: Number((row as any).enabled ?? 0) === 1,
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/cast-categories', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { name?: unknown; enabled?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = clampText(body.name, 80)
  const enabled = body.enabled === undefined ? 1 : parseBool01(body.enabled)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const createdAt = nowIso()
  const id = uuidOrFallback('cast_cat')
  try {
    await db
      .prepare('INSERT INTO cast_categories (id, name, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name, enabled, createdAt, createdAt)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true, id })
})

app.put('/cms/cast-categories/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { name?: unknown; enabled?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = body.name === undefined ? null : clampText(body.name, 80)
  const enabled = body.enabled === undefined ? null : parseBool01(body.enabled)
  const updatedAt = nowIso()

  try {
    await db
      .prepare('UPDATE cast_categories SET name = COALESCE(?, name), enabled = COALESCE(?, enabled), updated_at = ? WHERE id = ?')
      .bind(name, enabled, updatedAt, id)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Works
app.get('/cms/works', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  let rows: any[] = []
  try {
    rows = await d1All(db, 'SELECT id, title, description, thumbnail_url, published, created_at, updated_at FROM works ORDER BY created_at DESC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    thumbnailUrl: String(r.thumbnail_url ?? ''),
    published: Number(r.published ?? 0) === 1,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }))
  return c.json({ items })
})

app.get('/cms/works/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  let row: any = null
  try {
    row = await d1First(db, 'SELECT id, title, description, thumbnail_url, published, created_at, updated_at FROM works WHERE id = ?', [id])
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  if (!row) return c.json({ error: 'not_found' }, 404)

  const categoryIds = (await d1All(db, 'SELECT category_id FROM work_categories WHERE work_id = ? ORDER BY sort_order ASC', [id])).map((r) => String(r.category_id ?? '')).filter(Boolean)
  const tagIds = (await d1All(db, 'SELECT tag_id FROM work_tags WHERE work_id = ? ORDER BY created_at ASC', [id])).map((r) => String(r.tag_id ?? '')).filter(Boolean)
  const castIds = (await d1All(db, 'SELECT cast_id FROM work_casts WHERE work_id = ? ORDER BY sort_order ASC', [id])).map((r) => String(r.cast_id ?? '')).filter(Boolean)

  return c.json({
    item: {
      id: String(row.id ?? ''),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      thumbnailUrl: String(row.thumbnail_url ?? ''),
      published: Number(row.published ?? 0) === 1,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      categoryIds,
      tagIds,
      castIds,
    },
  })
})

app.post('/cms/works', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = {
    title?: unknown
    description?: unknown
    thumbnailUrl?: unknown
    published?: unknown
    categoryIds?: unknown
    tagIds?: unknown
    castIds?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const title = clampText(body.title, 200)
  const description = clampText(body.description, 5000)
  const thumbnailUrl = clampText(body.thumbnailUrl, 500)
  const published = body.published === undefined ? 0 : parseBool01(body.published)
  const categoryIds = parseIdList(body.categoryIds)
  const tagIds = parseIdList(body.tagIds)
  const castIds = parseIdList(body.castIds)
  if (!title) return c.json({ error: 'title is required' }, 400)

  const createdAt = nowIso()
  const id = uuidOrFallback('work')
  try {
    await db
      .prepare('INSERT INTO works (id, title, description, thumbnail_url, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, title, description, thumbnailUrl, published, createdAt, createdAt)
      .run()

    await replaceLinks(db, { table: 'work_categories', leftKey: 'work_id', leftId: id, rightKey: 'category_id', rightIds: categoryIds })
    await replaceLinks(db, { table: 'work_tags', leftKey: 'work_id', leftId: id, rightKey: 'tag_id', rightIds: tagIds })
    await replaceCastLinks(db, { table: 'work_casts', leftKey: 'work_id', leftId: id, castIds })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true, id })
})

app.put('/cms/works/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = {
    title?: unknown
    description?: unknown
    thumbnailUrl?: unknown
    published?: unknown
    categoryIds?: unknown
    tagIds?: unknown
    castIds?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body

  const title = body.title === undefined ? undefined : clampText(body.title, 200)
  const description = body.description === undefined ? undefined : clampText(body.description, 5000)
  const thumbnailUrl = body.thumbnailUrl === undefined ? undefined : clampText(body.thumbnailUrl, 500)
  const published = body.published === undefined ? undefined : parseBool01(body.published)
  const updatedAt = nowIso()

  const sets: string[] = []
  const binds: any[] = []
  if (title !== undefined) {
    sets.push('title = ?')
    binds.push(title)
  }
  if (description !== undefined) {
    sets.push('description = ?')
    binds.push(description)
  }
  if (thumbnailUrl !== undefined) {
    sets.push('thumbnail_url = ?')
    binds.push(thumbnailUrl)
  }
  if (published !== undefined) {
    sets.push('published = ?')
    binds.push(published)
  }
  sets.push('updated_at = ?')
  binds.push(updatedAt)

  try {
    if (sets.length) {
      await db.prepare(`UPDATE works SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run()
    }

    if (body.categoryIds !== undefined) {
      const categoryIds = parseIdList(body.categoryIds)
      await replaceLinks(db, { table: 'work_categories', leftKey: 'work_id', leftId: id, rightKey: 'category_id', rightIds: categoryIds })
    }
    if (body.tagIds !== undefined) {
      const tagIds = parseIdList(body.tagIds)
      await replaceLinks(db, { table: 'work_tags', leftKey: 'work_id', leftId: id, rightKey: 'tag_id', rightIds: tagIds })
    }
    if (body.castIds !== undefined) {
      const castIds = parseIdList(body.castIds)
      await replaceCastLinks(db, { table: 'work_casts', leftKey: 'work_id', leftId: id, castIds })
    }
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true })
})

// Videos
app.get('/cms/videos', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const q = String(c.req.query('q') ?? '').trim()
  const workId = String(c.req.query('workId') ?? '').trim()
  const publishedRaw = String(c.req.query('published') ?? '').trim()
  const categoryId = String(c.req.query('categoryId') ?? '').trim()
  const tagId = String(c.req.query('tagId') ?? '').trim()
  const castId = String(c.req.query('castId') ?? '').trim()
  const genreId = String(c.req.query('genreId') ?? '').trim()
  const sort = String(c.req.query('sort') ?? '').trim() // created_desc (default), created_asc, scheduled_asc, title_asc

  const limitRaw = String(c.req.query('limit') ?? '').trim()
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 200
  const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 1), 500) : 200

  const where: string[] = ['1=1']
  const binds: any[] = []

  if (q) {
    const like = `%${q}%`
    where.push('(v.title LIKE ? OR v.description LIKE ? OR COALESCE(w.title, \'\') LIKE ?)')
    binds.push(like, like, like)
  }
  if (workId) {
    where.push('v.work_id = ?')
    binds.push(workId)
  }
  if (publishedRaw === '1' || publishedRaw === '0') {
    where.push('v.published = ?')
    binds.push(publishedRaw === '1' ? 1 : 0)
  }
  if (categoryId) {
    where.push('EXISTS (SELECT 1 FROM video_categories vc WHERE vc.video_id = v.id AND vc.category_id = ?)')
    binds.push(categoryId)
  }
  if (tagId) {
    where.push('EXISTS (SELECT 1 FROM video_tags vt WHERE vt.video_id = v.id AND vt.tag_id = ?)')
    binds.push(tagId)
  }
  if (castId) {
    where.push('EXISTS (SELECT 1 FROM video_casts vca WHERE vca.video_id = v.id AND vca.cast_id = ?)')
    binds.push(castId)
  }
  if (genreId) {
    where.push('EXISTS (SELECT 1 FROM video_genres vg WHERE vg.video_id = v.id AND vg.genre_id = ?)')
    binds.push(genreId)
  }

  const orderBy = (() => {
    switch (sort) {
      case 'created_asc':
        return 'v.created_at ASC'
      case 'scheduled_asc':
        return 'CASE WHEN v.scheduled_at IS NULL OR v.scheduled_at = \'\' THEN 1 ELSE 0 END ASC, v.scheduled_at ASC, v.created_at DESC'
      case 'title_asc':
        return 'v.title ASC, v.created_at DESC'
      case 'created_desc':
      default:
        return 'v.created_at DESC'
    }
  })()

  let rows: any[] = []
  try {
    rows = await d1All(
      db,
      `SELECT
         v.id, v.work_id, COALESCE(w.title, '') AS work_title,
         v.title, v.description,
         v.stream_video_id, COALESCE(v.stream_video_id_clean, '') AS stream_video_id_clean, COALESCE(v.stream_video_id_subtitled, '') AS stream_video_id_subtitled,
         v.thumbnail_url,
         v.published,
         v.scheduled_at,
         v.episode_no,
         COALESCE(v.rating_avg, 0) AS rating_avg,
         COALESCE(v.review_count, 0) AS review_count,
         COALESCE((SELECT group_concat(DISTINCT c.name)
                   FROM video_casts vc
                   JOIN casts c ON c.id = vc.cast_id
                   WHERE vc.video_id = v.id), '') AS cast_names,
         COALESCE((SELECT group_concat(DISTINCT cat.name)
                   FROM video_categories vcat
                   JOIN categories cat ON cat.id = vcat.category_id
                   WHERE vcat.video_id = v.id), '') AS category_names,
         COALESCE((SELECT group_concat(DISTINCT t.name)
                   FROM video_tags vt
                   JOIN tags t ON t.id = vt.tag_id
                   WHERE vt.video_id = v.id), '') AS tag_names,
         COALESCE((SELECT group_concat(DISTINCT g.name)
                   FROM video_genres vg
                   JOIN genres g ON g.id = vg.genre_id
                   WHERE vg.video_id = v.id), '') AS genre_names,
         v.created_at, v.updated_at
       FROM videos v
       LEFT JOIN works w ON w.id = v.work_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ?`,
      [...binds, limit]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    workId: String(r.work_id ?? ''),
    workTitle: String(r.work_title ?? ''),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    streamVideoId: String(r.stream_video_id ?? ''),
    streamVideoIdClean: String(r.stream_video_id_clean ?? ''),
    streamVideoIdSubtitled: String(r.stream_video_id_subtitled ?? ''),
    thumbnailUrl: String(r.thumbnail_url ?? ''),
    published: Number(r.published ?? 0) === 1,
    scheduledAt: r.scheduled_at === null || r.scheduled_at === undefined ? null : String(r.scheduled_at ?? ''),
    episodeNo: r.episode_no === null || r.episode_no === undefined ? null : Number(r.episode_no ?? 0),
    ratingAvg: Number(r.rating_avg ?? 0) || 0,
    reviewCount: Number(r.review_count ?? 0) || 0,
    castNames: String(r.cast_names ?? ''),
    categoryNames: String(r.category_names ?? ''),
    tagNames: String(r.tag_names ?? ''),
    genreNames: String(r.genre_names ?? ''),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }))
  return c.json({ items, limit })
})

app.get('/cms/videos/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  // Guard against route shadowing: depending on router ordering, `/cms/videos/unapproved`
  // can be interpreted as this `:id` route. In that case, return the unapproved list.
  if (id === 'unapproved') {
    let rows: any[] = []
    try {
      rows = await d1All(
        db,
        "SELECT v.id, v.title, v.scheduled_at, v.approval_status, v.approval_requested_at, v.submitted_by_user_id, u.email AS submitter_email FROM videos v LEFT JOIN users u ON u.id = v.submitted_by_user_id WHERE v.approval_status = 'pending' ORDER BY COALESCE(v.approval_requested_at, v.created_at) DESC"
      )
    } catch (err) {
      if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
      throw err
    }

    const items = rows.map((r) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      approvalRequestedAt:
        r.approval_requested_at === null || r.approval_requested_at === undefined ? null : String(r.approval_requested_at ?? ''),
      scheduledAt: r.scheduled_at === null || r.scheduled_at === undefined ? null : String(r.scheduled_at ?? ''),
      submitterUserId: String(r.submitted_by_user_id ?? ''),
      submitterEmail: String(r.submitter_email ?? ''),
      status: 'pending' as const,
    }))

    return c.json({ items })
  }

  let row: any = null
  try {
    row = await d1First(
      db,
      'SELECT v.id, v.work_id, w.title AS work_title, v.title, v.description, v.stream_video_id, COALESCE(v.stream_video_id_clean, \'\') AS stream_video_id_clean, COALESCE(v.stream_video_id_subtitled, \'\') AS stream_video_id_subtitled, v.thumbnail_url, v.published, v.scheduled_at, v.episode_no, COALESCE(v.rating_avg, 0) AS rating_avg, COALESCE(v.review_count, 0) AS review_count, v.created_at, v.updated_at FROM videos v LEFT JOIN works w ON w.id = v.work_id WHERE v.id = ?',
      [id]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  if (!row) return c.json({ error: 'not_found' }, 404)

  const [categoryIds, tagIds, castIds, genreIds, playsRow, coinsRow, commentsRow] = await Promise.all([
    d1All(db, 'SELECT category_id FROM video_categories WHERE video_id = ? ORDER BY sort_order ASC', [id]),
    d1All(db, 'SELECT tag_id FROM video_tags WHERE video_id = ? ORDER BY created_at ASC', [id]),
    d1All(db, 'SELECT cast_id FROM video_casts WHERE video_id = ? ORDER BY sort_order ASC', [id]),
    d1All(db, 'SELECT genre_id FROM video_genres WHERE video_id = ? ORDER BY created_at ASC', [id]),
    d1First(db, 'SELECT COUNT(*) AS n FROM video_play_events WHERE video_id = ?', [id]),
    d1First(db, 'SELECT COALESCE(SUM(amount), 0) AS n FROM coin_spend_events WHERE video_id = ? AND amount > 0', [id]),
    d1First(
      db,
      'SELECT COUNT(*) AS n FROM comments WHERE deleted = 0 AND content_id = ? AND (episode_id = ? OR episode_id = ?)',
      [String((row as any).work_id ?? ''), id, String((row as any).episode_no ?? '')]
    ),
  ])

  const categoryIdList = (categoryIds as any[]).map((r) => String((r as any).category_id ?? '')).filter(Boolean)
  const tagIdList = (tagIds as any[]).map((r) => String((r as any).tag_id ?? '')).filter(Boolean)
  const castIdList = (castIds as any[]).map((r) => String((r as any).cast_id ?? '')).filter(Boolean)
  const genreIdList = (genreIds as any[]).map((r) => String((r as any).genre_id ?? '')).filter(Boolean)

  const playsCount = Number((playsRow as any)?.n ?? 0)
  const coinsSpent = Number((coinsRow as any)?.n ?? 0)
  const commentsCount = Number((commentsRow as any)?.n ?? 0)

  return c.json({
    item: {
      id: String(row.id ?? ''),
      workId: String(row.work_id ?? ''),
      workTitle: String(row.work_title ?? ''),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      streamVideoId: String(row.stream_video_id ?? ''),
      streamVideoIdClean: String((row as any).stream_video_id_clean ?? ''),
      streamVideoIdSubtitled: String((row as any).stream_video_id_subtitled ?? ''),
      thumbnailUrl: String(row.thumbnail_url ?? ''),
      published: Number(row.published ?? 0) === 1,
      scheduledAt: row.scheduled_at === null || row.scheduled_at === undefined ? null : String(row.scheduled_at ?? ''),
      episodeNo: (row as any).episode_no === null || (row as any).episode_no === undefined ? null : Number((row as any).episode_no ?? 0),
      ratingAvg: Number((row as any).rating_avg ?? 0) || 0,
      reviewCount: Number((row as any).review_count ?? 0) || 0,
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      categoryIds: categoryIdList,
      tagIds: tagIdList,
      castIds: castIdList,
      genreIds: genreIdList,
    },
    stats: {
      playsCount,
      coinsSpent,
      commentsCount,
    },
  })
})

app.post('/cms/videos', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = {
    workId?: unknown
    title?: unknown
    description?: unknown
    streamVideoId?: unknown
    streamVideoIdClean?: unknown
    streamVideoIdSubtitled?: unknown
    thumbnailUrl?: unknown
    published?: unknown
    scheduledAt?: unknown
    episodeNo?: unknown
    categoryIds?: unknown
    tagIds?: unknown
    castIds?: unknown
    genreIds?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const workId = String(body.workId ?? '').trim()
  const title = clampText(body.title, 200)
  const description = clampText(body.description, 5000)
  const streamVideoId = clampText(body.streamVideoId, 120)
  const streamVideoIdClean = clampText(body.streamVideoIdClean, 120)
  const streamVideoIdSubtitled = clampText(body.streamVideoIdSubtitled, 120)
  const thumbnailUrl = clampText(body.thumbnailUrl, 500)
  const published = body.published === undefined ? 0 : parseBool01(body.published)
  const scheduledAtRaw = body.scheduledAt === undefined ? undefined : String(body.scheduledAt ?? '').trim()
  const scheduledAt = scheduledAtRaw === undefined ? null : scheduledAtRaw || null
  const episodeNo = body.episodeNo === undefined ? null : Number(body.episodeNo)
  const categoryIds = parseIdList(body.categoryIds)
  const tagIds = parseIdList(body.tagIds)
  const castIds = parseIdList(body.castIds)
  const genreIds = parseIdList(body.genreIds)

  if (!workId) return c.json({ error: 'workId is required' }, 400)
  if (!title) return c.json({ error: 'title is required' }, 400)

  const createdAt = nowIso()
  const id = uuidOrFallback('vid')
  try {
    await db
      .prepare('INSERT INTO videos (id, work_id, title, description, stream_video_id, stream_video_id_clean, stream_video_id_subtitled, thumbnail_url, published, scheduled_at, episode_no, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, workId, title, description, streamVideoId, streamVideoIdClean, streamVideoIdSubtitled, thumbnailUrl, published, scheduledAt, Number.isFinite(episodeNo as any) ? episodeNo : null, createdAt, createdAt)
      .run()

    await replaceLinks(db, { table: 'video_categories', leftKey: 'video_id', leftId: id, rightKey: 'category_id', rightIds: categoryIds })
    await replaceLinks(db, { table: 'video_tags', leftKey: 'video_id', leftId: id, rightKey: 'tag_id', rightIds: tagIds })
    await replaceCastLinks(db, { table: 'video_casts', leftKey: 'video_id', leftId: id, castIds })
    await replaceLinks(db, { table: 'video_genres', leftKey: 'video_id', leftId: id, rightKey: 'genre_id', rightIds: genreIds })

    // Keep work publish state consistent: if a video is published, its work should be visible to the app.
    if (published === 1) {
      await db.prepare('UPDATE works SET published = 1, updated_at = ? WHERE id = ?').bind(createdAt, workId).run()
    }
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true, id })
})

app.put('/cms/videos/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = {
    workId?: unknown
    title?: unknown
    description?: unknown
    streamVideoId?: unknown
    streamVideoIdClean?: unknown
    streamVideoIdSubtitled?: unknown
    thumbnailUrl?: unknown
    published?: unknown
    scheduledAt?: unknown
    episodeNo?: unknown
    categoryIds?: unknown
    tagIds?: unknown
    castIds?: unknown
    genreIds?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body

  const updatedAt = nowIso()
  const sets: string[] = []
  const binds: any[] = []

  if (body.workId !== undefined) {
    const workId = String(body.workId ?? '').trim()
    if (!workId) return c.json({ error: 'workId is required' }, 400)
    sets.push('work_id = ?')
    binds.push(workId)
  }
  if (body.title !== undefined) {
    const title = clampText(body.title, 200)
    if (!title) return c.json({ error: 'title is required' }, 400)
    sets.push('title = ?')
    binds.push(title)
  }
  if (body.description !== undefined) {
    sets.push('description = ?')
    binds.push(clampText(body.description, 5000))
  }
  if (body.streamVideoId !== undefined) {
    sets.push('stream_video_id = ?')
    binds.push(clampText(body.streamVideoId, 120))
  }
  if (body.streamVideoIdClean !== undefined) {
    sets.push('stream_video_id_clean = ?')
    binds.push(clampText(body.streamVideoIdClean, 120))
  }
  if (body.streamVideoIdSubtitled !== undefined) {
    sets.push('stream_video_id_subtitled = ?')
    binds.push(clampText(body.streamVideoIdSubtitled, 120))
  }
  if (body.thumbnailUrl !== undefined) {
    sets.push('thumbnail_url = ?')
    binds.push(clampText(body.thumbnailUrl, 500))
  }
  if (body.published !== undefined) {
    sets.push('published = ?')
    binds.push(parseBool01(body.published))
  }
  if (body.scheduledAt !== undefined) {
    const scheduledAtRaw = String(body.scheduledAt ?? '').trim()
    const scheduledAt = scheduledAtRaw ? scheduledAtRaw : null
    sets.push('scheduled_at = ?')
    binds.push(scheduledAt)
  }
  if (body.episodeNo !== undefined) {
    const n = Number(body.episodeNo)
    sets.push('episode_no = ?')
    binds.push(Number.isFinite(n) ? n : null)
  }

  sets.push('updated_at = ?')
  binds.push(updatedAt)

  try {
    await db.prepare(`UPDATE videos SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run()

    // If this update publishes the video, also publish its work.
    if (body.published !== undefined && parseBool01(body.published) === 1) {
      let targetWorkId = body.workId !== undefined ? String(body.workId ?? '').trim() : ''
      if (!targetWorkId) {
        const row = await d1First(db, 'SELECT work_id FROM videos WHERE id = ? LIMIT 1', [id])
        targetWorkId = String((row as any)?.work_id ?? '').trim()
      }
      if (targetWorkId) {
        await db.prepare('UPDATE works SET published = 1, updated_at = ? WHERE id = ?').bind(updatedAt, targetWorkId).run()
      }
    }

    if (body.categoryIds !== undefined) {
      const categoryIds = parseIdList(body.categoryIds)
      await replaceLinks(db, { table: 'video_categories', leftKey: 'video_id', leftId: id, rightKey: 'category_id', rightIds: categoryIds })
    }
    if (body.tagIds !== undefined) {
      const tagIds = parseIdList(body.tagIds)
      await replaceLinks(db, { table: 'video_tags', leftKey: 'video_id', leftId: id, rightKey: 'tag_id', rightIds: tagIds })
    }
    if (body.castIds !== undefined) {
      const castIds = parseIdList(body.castIds)
      await replaceCastLinks(db, { table: 'video_casts', leftKey: 'video_id', leftId: id, castIds })
    }
    if (body.genreIds !== undefined) {
      const genreIds = parseIdList(body.genreIds)
      await replaceLinks(db, { table: 'video_genres', leftKey: 'video_id', leftId: id, rightKey: 'genre_id', rightIds: genreIds })
    }
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true })
})

// Per-video recommendations (CMS)
app.get('/cms/videos/:id/recommendations', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  let rows: any[] = []
  try {
    rows = await d1All(
      db,
      `SELECT
         vr.recommended_video_id AS id,
         vr.sort_order AS sort_order,
         v.work_id AS work_id,
         COALESCE(w.title, '') AS work_title,
         v.title AS title,
         v.thumbnail_url AS thumbnail_url
       FROM video_recommendations vr
       JOIN videos v ON v.id = vr.recommended_video_id
       LEFT JOIN works w ON w.id = v.work_id
       WHERE vr.video_id = ?
       ORDER BY vr.sort_order ASC, vr.created_at ASC`,
      [id]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({
    videoId: id,
    items: rows.map((r) => ({
      id: String(r.id ?? ''),
      sortOrder: Number(r.sort_order ?? 0),
      workId: String(r.work_id ?? ''),
      workTitle: String(r.work_title ?? ''),
      title: String(r.title ?? ''),
      thumbnailUrl: String(r.thumbnail_url ?? ''),
    })),
  })
})

app.put('/cms/videos/:id/recommendations', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { videoIds?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  if (!Array.isArray(body.videoIds)) return c.json({ error: 'videoIds must be an array' }, 400)

  const videoIds = Array.from(
    new Set(
      body.videoIds
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
    )
  )
  if (videoIds.length > 200) return c.json({ error: 'too_many_items' }, 400)

  const createdAt = nowIso()
  try {
    await db.prepare('DELETE FROM video_recommendations WHERE video_id = ?').bind(id).run()
    for (let i = 0; i < videoIds.length; i++) {
      await db
        .prepare('INSERT INTO video_recommendations (video_id, recommended_video_id, sort_order, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, videoIds[i], i, createdAt)
        .run()
    }
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true, videoId: id, count: videoIds.length })
})

// ---- CMS: Featured videos (Recommend/Pickup slots) ----

function isValidFeaturedSlot(slot: string) {
  if (!slot) return false
  if (slot.length > 40) return false
  return /^[a-z0-9_-]+$/i.test(slot)
}

app.get('/cms/featured/videos', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const slot = String(c.req.query('slot') ?? '').trim().toLowerCase()
  if (!isValidFeaturedSlot(slot)) return c.json({ error: 'slot is required' }, 400)

  let rows: any[] = []
  try {
    rows = await d1All(
      db,
      `SELECT
         fv.video_id AS id,
         fv.sort_order AS sort_order,
         v.work_id AS work_id,
         COALESCE(w.title, '') AS work_title,
         v.title AS title,
         v.thumbnail_url AS thumbnail_url,
         COALESCE((SELECT group_concat(DISTINCT c.name)
                   FROM video_casts vc
                   JOIN casts c ON c.id = vc.cast_id
                   WHERE vc.video_id = v.id), '') AS cast_names,
         COALESCE((SELECT group_concat(DISTINCT cat.name)
                   FROM video_categories vcat
                   JOIN categories cat ON cat.id = vcat.category_id
                   WHERE vcat.video_id = v.id), '') AS category_names,
         COALESCE((SELECT group_concat(DISTINCT t.name)
                   FROM video_tags vt
                   JOIN tags t ON t.id = vt.tag_id
                   WHERE vt.video_id = v.id), '') AS tag_names
       FROM cms_featured_videos fv
       JOIN videos v ON v.id = fv.video_id
       LEFT JOIN works w ON w.id = v.work_id
       WHERE fv.slot = ?
       ORDER BY fv.sort_order ASC, fv.created_at ASC`,
      [slot]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({
    slot,
    items: rows.map((r) => ({
      id: String(r.id ?? ''),
      sortOrder: Number(r.sort_order ?? 0),
      workId: String(r.work_id ?? ''),
      workTitle: String(r.work_title ?? ''),
      title: String(r.title ?? ''),
      thumbnailUrl: String(r.thumbnail_url ?? ''),
      castNames: String(r.cast_names ?? ''),
      categoryNames: String(r.category_names ?? ''),
      tagNames: String(r.tag_names ?? ''),
    })),
  })
})

app.post('/cms/featured/videos', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const slot = String(c.req.query('slot') ?? '').trim().toLowerCase()
  if (!isValidFeaturedSlot(slot)) return c.json({ error: 'slot is required' }, 400)

  type Body = { videoIds?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  if (!Array.isArray(body.videoIds)) return c.json({ error: 'videoIds must be an array' }, 400)

  const videoIds = Array.from(
    new Set(
      body.videoIds
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
    )
  )

  if (videoIds.length > 200) return c.json({ error: 'too_many_items' }, 400)

  const createdAt = nowIso()
  try {
    await db.prepare('DELETE FROM cms_featured_videos WHERE slot = ?').bind(slot).run()
    for (let i = 0; i < videoIds.length; i++) {
      const vid = videoIds[i]
      await db
        .prepare('INSERT INTO cms_featured_videos (slot, video_id, sort_order, created_at) VALUES (?, ?, ?, ?)')
        .bind(slot, vid, i, createdAt)
        .run()
    }
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true, slot, count: videoIds.length })
})

// Search videos by title / cast / category / tag
app.get('/cms/videos/search', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  const q = String(c.req.query('q') ?? '').trim()
  const cast = String(c.req.query('cast') ?? '').trim()
  const category = String(c.req.query('category') ?? '').trim()
  const tag = String(c.req.query('tag') ?? '').trim()

  const limitRaw = String(c.req.query('limit') ?? '').trim()
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 50
  const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 1), 200) : 50

  const where: string[] = ['1=1']
  const binds: any[] = []

  if (q) {
    const like = `%${q}%`
    where.push('(v.title LIKE ? OR w.title LIKE ?)')
    binds.push(like, like)
  }
  if (cast) {
    const like = `%${cast}%`
    where.push(
      `EXISTS (
         SELECT 1
         FROM video_casts vc
         JOIN casts c ON c.id = vc.cast_id
         WHERE vc.video_id = v.id AND c.name LIKE ?
       )`
    )
    binds.push(like)
  }
  if (category) {
    const like = `%${category}%`
    where.push(
      `EXISTS (
         SELECT 1
         FROM video_categories vcat
         JOIN categories cat ON cat.id = vcat.category_id
         WHERE vcat.video_id = v.id AND cat.name LIKE ?
       )`
    )
    binds.push(like)
  }
  if (tag) {
    const like = `%${tag}%`
    where.push(
      `EXISTS (
         SELECT 1
         FROM video_tags vt
         JOIN tags t ON t.id = vt.tag_id
         WHERE vt.video_id = v.id AND t.name LIKE ?
       )`
    )
    binds.push(like)
  }

  let rows: any[] = []
  try {
    rows = await d1All(
      db,
      `SELECT
         v.id AS id,
         v.work_id AS work_id,
         COALESCE(w.title, '') AS work_title,
         v.title AS title,
         v.thumbnail_url AS thumbnail_url,
         COALESCE((SELECT group_concat(DISTINCT c.name)
                   FROM video_casts vc
                   JOIN casts c ON c.id = vc.cast_id
                   WHERE vc.video_id = v.id), '') AS cast_names,
         COALESCE((SELECT group_concat(DISTINCT cat.name)
                   FROM video_categories vcat
                   JOIN categories cat ON cat.id = vcat.category_id
                   WHERE vcat.video_id = v.id), '') AS category_names,
         COALESCE((SELECT group_concat(DISTINCT t.name)
                   FROM video_tags vt
                   JOIN tags t ON t.id = vt.tag_id
                   WHERE vt.video_id = v.id), '') AS tag_names
       FROM videos v
       LEFT JOIN works w ON w.id = v.work_id
       WHERE ${where.join(' AND ')}
       ORDER BY v.created_at DESC
       LIMIT ?`,
      [...binds, limit]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({
    items: rows.map((r) => ({
      id: String(r.id ?? ''),
      workId: String(r.work_id ?? ''),
      workTitle: String(r.work_title ?? ''),
      title: String(r.title ?? ''),
      thumbnailUrl: String(r.thumbnail_url ?? ''),
      castNames: String(r.cast_names ?? ''),
      categoryNames: String(r.category_names ?? ''),
      tagNames: String(r.tag_names ?? ''),
    })),
    limit,
  })
})

// ---- CMS: Unapproved videos (future workflow; implemented minimally) ----

app.get('/cms/videos/unapproved', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  let rows: any[] = []
  try {
    rows = await d1All(
      db,
      "SELECT v.id, v.title, v.scheduled_at, v.approval_status, v.approval_requested_at, v.submitted_by_user_id, u.email AS submitter_email FROM videos v LEFT JOIN users u ON u.id = v.submitted_by_user_id WHERE v.approval_status = 'pending' ORDER BY COALESCE(v.approval_requested_at, v.created_at) DESC"
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    approvalRequestedAt:
      r.approval_requested_at === null || r.approval_requested_at === undefined ? null : String(r.approval_requested_at ?? ''),
    scheduledAt: r.scheduled_at === null || r.scheduled_at === undefined ? null : String(r.scheduled_at ?? ''),
    submitterUserId: String(r.submitted_by_user_id ?? ''),
    submitterEmail: String(r.submitter_email ?? ''),
    status: 'pending' as const,
  }))

  return c.json({ items })
})

// ---- CMS: Unapproved cast profile requests (individual actor registration review) ----
app.get('/cms/cast-profiles/unapproved', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      items: [
        {
          id: 'CPR0001',
          name: '俳優 太郎',
          email: 'actor@example.com',
          submittedAt: '2026-01-10T00:00:00.000Z',
          status: 'pending',
        },
      ],
    })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(
      db,
      "SELECT id, name, email, submitted_at, status FROM cast_profile_requests WHERE status = 'pending' ORDER BY submitted_at DESC LIMIT 200"
    )
    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        name: String(r.name ?? ''),
        email: String(r.email ?? ''),
        submittedAt: String(r.submitted_at ?? ''),
        status: String(r.status ?? 'pending'),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/cast-profiles/unapproved/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      item: {
        id,
        name: '俳優 太郎',
        email: 'actor@example.com',
        submittedAt: '2026-01-10T00:00:00.000Z',
        status: 'pending',
        draft: { genres: ['俳優'], affiliation: 'フリー', biography: '', representativeWorks: '', socialLinks: [], selfPr: '' },
        rejectionReason: '',
      },
    })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(
      db,
      'SELECT id, name, email, draft_json, submitted_at, status, rejection_reason FROM cast_profile_requests WHERE id = ? LIMIT 1',
      [id]
    )
    if (!row) return c.json({ error: 'not_found' }, 404)

    let draft: unknown = null
    try {
      draft = (row as any).draft_json ? JSON.parse(String((row as any).draft_json)) : null
    } catch {
      draft = null
    }

    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        name: String((row as any).name ?? ''),
        email: String((row as any).email ?? ''),
        submittedAt: String((row as any).submitted_at ?? ''),
        status: String((row as any).status ?? 'pending'),
        draft,
        rejectionReason: String((row as any).rejection_reason ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/cast-profiles/unapproved/:id/approve', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  const now = nowIso()
  try {
    await c.env.DB
      .prepare(
        "UPDATE cast_profile_requests SET status = 'approved', decided_at = ?, decided_by_admin_id = ?, rejection_reason = '' WHERE id = ? AND status = 'pending'"
      )
      .bind(now, (admin as any).adminId ?? '', id)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/cms/cast-profiles/unapproved/:id/reject', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { reason?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const reason = body.reason === undefined ? '' : clampText(body.reason, 500)
  if (!reason.trim()) return c.json({ error: 'reason is required' }, 400)

  const now = nowIso()
  try {
    await c.env.DB
      .prepare(
        "UPDATE cast_profile_requests SET status = 'rejected', decided_at = ?, decided_by_admin_id = ?, rejection_reason = ? WHERE id = ? AND status = 'pending'"
      )
      .bind(now, (admin as any).adminId ?? '', reason.trim(), id)
      .run()

    // Best-effort: notify submitter by email
    try {
      const row = await c.env.DB.prepare('SELECT email FROM cast_profile_requests WHERE id = ? LIMIT 1').bind(id).first<any>()
      const to = normalizeEmail(String(row?.email ?? ''))
      if (to) {
        const subject = '【推しドラ】キャストプロフィール申請が否認されました'
        const text = `申請が否認されました。\n\n理由: ${reason.trim()}\n\n必要に応じて内容を修正し、再申請してください。\n`
        const mailRes = await sendEmailViaMailChannels(c.env, to, subject, text)
        if (!mailRes.ok) {
          return c.json({ ok: true, warning: mailRes.error })
        }
      }
    } catch {
      // ignore notification failure
    }

    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/cms/videos/unapproved/:id', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  let row: any = null
  try {
    row = await d1First(
      db,
      "SELECT v.id, v.title, v.description, v.stream_video_id, v.thumbnail_url, v.scheduled_at, v.approval_status, v.approval_requested_at, v.submitted_by_user_id, u.email AS submitter_email, v.rejection_reason FROM videos v LEFT JOIN users u ON u.id = v.submitted_by_user_id WHERE v.id = ?",
      [id]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  if (!row) return c.json({ error: 'not_found' }, 404)
  if (String(row.approval_status ?? '') !== 'pending') return c.json({ error: 'not_pending' }, 409)

  return c.json({
    item: {
      id: String(row.id ?? ''),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      streamVideoId: String(row.stream_video_id ?? ''),
      thumbnailUrl: String(row.thumbnail_url ?? ''),
      approvalRequestedAt:
        row.approval_requested_at === null || row.approval_requested_at === undefined ? null : String(row.approval_requested_at ?? ''),
      scheduledAt: row.scheduled_at === null || row.scheduled_at === undefined ? null : String(row.scheduled_at ?? ''),
      submitterUserId: String(row.submitted_by_user_id ?? ''),
      submitterEmail: String(row.submitter_email ?? ''),
      rejectionReason: String(row.rejection_reason ?? ''),
      status: 'pending' as const,
    },
  })
})

app.post('/cms/videos/unapproved/:id/approve', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  const decidedAt = nowIso()
  try {
    const res = await db
      .prepare(
        "UPDATE videos SET approval_status = 'approved', approval_decided_at = ?, approval_decided_by_admin_id = ?, rejection_reason = '' WHERE id = ? AND approval_status = 'pending'"
      )
      .bind(decidedAt, admin.adminId, id)
      .run()

    if ((res as any)?.meta?.changes === 0) return c.json({ error: 'not_pending' }, 409)
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true })
})

app.post('/cms/videos/unapproved/:id/reject', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  type Body = { reason?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const reason = clampText(body.reason, 500)
  if (!reason) return c.json({ error: 'reason is required' }, 400)

  const decidedAt = nowIso()
  try {
    const res = await db
      .prepare(
        "UPDATE videos SET approval_status = 'rejected', approval_decided_at = ?, approval_decided_by_admin_id = ?, rejection_reason = ? WHERE id = ? AND approval_status = 'pending'"
      )
      .bind(decidedAt, admin.adminId, reason, id)
      .run()

    if ((res as any)?.meta?.changes === 0) return c.json({ error: 'not_pending' }, 409)
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true })
})

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

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function getStripeSecretKey(env: Env['Bindings']) {
  const key = String(env.STRIPE_SECRET_KEY ?? '').trim()
  return key || null
}

function getStripePriceId(env: Env['Bindings']) {
  const id = String(env.STRIPE_SUBSCRIPTION_PRICE_ID ?? '').trim()
  return id || null
}

function getStripeWebhookSecret(env: Env['Bindings']) {
  const s = String(env.STRIPE_WEBHOOK_SECRET ?? '').trim()
  return s || null
}

function getStripeCheckoutUrls(env: Env['Bindings']) {
  const successUrl = String(env.STRIPE_CHECKOUT_SUCCESS_URL ?? '').trim()
  const cancelUrl = String(env.STRIPE_CHECKOUT_CANCEL_URL ?? '').trim()
  return {
    successUrl: successUrl || null,
    cancelUrl: cancelUrl || null,
  }
}

function getStripePortalReturnUrl(env: Env['Bindings']) {
  const u = String(env.STRIPE_PORTAL_RETURN_URL ?? '').trim()
  return u || null
}

async function stripePostForm<T>(secretKey: string, path: string, params: URLSearchParams, opts?: { idempotencyKey?: string }) {
  const url = `https://api.stripe.com/v1${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (opts?.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
  const res = await fetch(url, { method: 'POST', headers, body: params.toString() })
  const json = (await res.json().catch(() => null)) as any
  if (!res.ok) {
    const msg = String(json?.error?.message ?? '').slice(0, 300)
    throw new Error(msg ? `stripe_error: ${msg}` : `stripe_error_http_${res.status}`)
  }
  return json as T
}

async function stripeVerifyWebhookSignature(params: { rawBody: string; signatureHeader: string; secret: string }) {
  const header = String(params.signatureHeader ?? '').trim()
  if (!header) return false
  const parts = header.split(',').map((p) => p.trim()).filter(Boolean)
  const tPart = parts.find((p) => p.startsWith('t='))
  const v1Parts = parts.filter((p) => p.startsWith('v1='))
  const t = tPart ? tPart.slice(2) : ''
  if (!t || !v1Parts.length) return false

  const signedPayload = `${t}.${params.rawBody}`
  const sigBytes = await hmacSha256(new TextEncoder().encode(params.secret), signedPayload)
  const expected = toHex(sigBytes.buffer)
  for (const v1 of v1Parts) {
    const provided = v1.slice(3)
    if (provided && timingSafeEqualHex(expected, provided)) return true
  }
  return false
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

// Cloudflare Workers currently rejects PBKDF2 iteration counts above 100,000.
async function pbkdf2HashPassword(password: string, saltBytes: Uint8Array, iterations = 100_000) {
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

async function sendEmailViaMailChannels(env: Env['Bindings'], to: string, subject: string, text: string, html?: string) {
  const from = (env.MAIL_FROM ?? '').trim()
  const fromName = (env.MAIL_FROM_NAME ?? 'Oshidora').trim() || 'Oshidora'
  if (!from) {
    return {
      ok: false,
      error: 'Email is not configured. Set MAIL_FROM (e.g. no-reply@your-domain).',
      status: 501,
    }
  }

  const content = [{ type: 'text/plain', value: text }]
  if (html && String(html).trim()) {
    content.push({ type: 'text/html', value: String(html) })
  }

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: fromName },
    subject,
    content,
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

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function requireAuth(c: any) {
  // In debug mock mode, allow calls without authentication.
  if (isMockRequest(c)) {
    return {
      ok: true as const,
      userId: 'mock-user' as const,
      stage: 'mock' as const,
      payload: {
        userId: 'mock-user',
        stage: 'mock',
        kind: 'cms',
        role: 'Admin',
        adminId: 'mock-admin',
      },
    } as const
  }

  const auth = c.req.header('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  const token = m?.[1] || ''

  // If there's no Bearer token at all, treat as unauthenticated.
  // This keeps public/unauthenticated calls from failing just because the secret isn't configured.
  if (!token) return { ok: false as const, status: 401 as const, error: 'Unauthorized' as const }

  const secret = getAuthJwtSecret(c.env)
  if (!secret) return { ok: false as const, status: 500 as const, error: 'AUTH_JWT_SECRET is not configured' as const }
  const payload = await verifyJwtHs256(secret, token)
  if (!payload) return { ok: false as const, status: 401 as const, error: 'Unauthorized' as const }
  const userId = typeof payload.userId === 'string' ? payload.userId : ''
  const stage = typeof payload.stage === 'string' ? payload.stage : ''
  if (!userId) return { ok: false as const, status: 401 as const, error: 'Unauthorized' as const }
  return { ok: true, userId, stage, payload } as const
}

async function requireAdmin(c: any) {
  const auth = await requireAuth(c)
  if (!auth.ok) return auth

  const expected = (c.env.ADMIN_API_KEY ?? '').trim()
  if (!expected) return { ok: false as const, status: 500 as const, error: 'ADMIN_API_KEY is not configured' as const }

  const provided = (c.req.header('x-admin-key') ?? '').trim()
  if (!provided || provided !== expected) return { ok: false as const, status: 403 as const, error: 'Forbidden' as const }

  return auth
}

async function requireCmsAdmin(c: any) {
  if (isMockRequest(c)) {
    return {
      ok: true as const,
      userId: 'mock-user',
      stage: 'cms',
      payload: {
        kind: 'cms',
        role: 'Admin',
        adminId: 'mock-admin',
        email: 'mock-admin@example.com',
        name: 'Mock Admin',
        stage: 'cms',
        userId: 'mock-admin',
      },
      adminId: 'mock-admin',
      role: 'Admin' as const,
      kind: 'cms' as const,
    } as const
  }

  const auth = await requireAuth(c)
  if (!auth.ok) return auth
  const role = typeof auth.payload?.role === 'string' ? String(auth.payload.role) : ''
  const kind = typeof auth.payload?.kind === 'string' ? String(auth.payload.kind) : ''
  const adminId = typeof auth.payload?.adminId === 'string' ? String(auth.payload.adminId) : ''
  if (kind !== 'cms' || role !== 'Admin' || !adminId) return { ok: false as const, status: 403 as const, error: 'Forbidden' as const }
  return {
    ok: true as const,
    userId: auth.userId,
    stage: auth.stage,
    payload: auth.payload,
    adminId,
    role: 'Admin' as const,
    kind: 'cms' as const,
  }
}

function nowIso() {
  return new Date().toISOString()
}

function uuidOrFallback(prefix: string) {
  const hasUuid = Boolean((globalThis as any).crypto?.randomUUID)
  const id = hasUuid ? crypto.randomUUID() : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
  return id
}

async function sha256Base64Url(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(String(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return base64UrlEncode(digest)
}

function clampText(value: unknown, maxLen: number) {
  const s = String(value ?? '').trim()
  if (s.length > maxLen) return s.slice(0, maxLen)
  return s
}

function parseBool01(value: unknown) {
  if (value === true) return 1
  if (value === false) return 0
  const s = String(value ?? '').trim().toLowerCase()
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return 1
  return 0
}

function parseIdList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean)
  const s = String(value ?? '').trim()
  if (!s) return []
  return s
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

async function d1All(db: D1Database, sql: string, binds: any[] = []) {
  const res = await db.prepare(sql).bind(...binds).all<any>()
  return (res.results ?? []) as any[]
}

async function d1First(db: D1Database, sql: string, binds: any[] = []) {
  return await db.prepare(sql).bind(...binds).first<any>()
}

async function replaceLinks(db: D1Database, opts: { table: string; leftKey: string; leftId: string; rightKey: string; rightIds: string[] }) {
  const createdAt = nowIso()
  await db.prepare(`DELETE FROM ${opts.table} WHERE ${opts.leftKey} = ?`).bind(opts.leftId).run()
  for (let i = 0; i < opts.rightIds.length; i++) {
    const rid = opts.rightIds[i]
    if (!rid) continue
    if (opts.table.endsWith('_categories')) {
      await db
        .prepare(`INSERT INTO ${opts.table} (${opts.leftKey}, ${opts.rightKey}, sort_order, created_at) VALUES (?, ?, ?, ?)`)
        .bind(opts.leftId, rid, i, createdAt)
        .run()
    } else {
      await db
        .prepare(`INSERT INTO ${opts.table} (${opts.leftKey}, ${opts.rightKey}, created_at) VALUES (?, ?, ?)`)
        .bind(opts.leftId, rid, createdAt)
        .run()
    }
  }
}

async function replaceCastLinks(
  db: D1Database,
  opts: { table: 'work_casts' | 'video_casts'; leftKey: string; leftId: string; castIds: string[] }
) {
  const createdAt = nowIso()
  await db.prepare(`DELETE FROM ${opts.table} WHERE ${opts.leftKey} = ?`).bind(opts.leftId).run()
  for (let i = 0; i < opts.castIds.length; i++) {
    const castId = opts.castIds[i]
    if (!castId) continue
    await db
      .prepare(`INSERT INTO ${opts.table} (${opts.leftKey}, cast_id, role_name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(opts.leftId, castId, '', i, createdAt)
      .run()
  }
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

// CMS: Cloudflare Stream captions (WebVTT)
// Upload/list captions for previewing subtitles in the admin.
app.get('/cms/stream/captions/:videoId', async (c) => {
  const auth = await requireCmsAdmin(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)

  const videoId = c.req.param('videoId')?.trim()
  if (!videoId) return c.json({ error: 'videoId is required' }, 400)

  const accountId = (c.env.CLOUDFLARE_ACCOUNT_ID_FOR_STREAM || c.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  const token = (c.env.CLOUDFLARE_STREAM_API_TOKEN || '').trim()
  if (!accountId || !token) {
    return c.json(
      {
        error: 'Cloudflare Stream is not configured',
        required: ['CLOUDFLARE_ACCOUNT_ID(_FOR_STREAM)', 'CLOUDFLARE_STREAM_API_TOKEN'],
      },
      500
    )
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/captions`
  let resp: Response
  try {
    resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    return c.json(
      {
        error: 'Failed to list Stream captions',
        details: String((err as any)?.message ?? err).slice(0, 500),
      },
      502
    )
  }

  const data = (await resp.json().catch(() => null)) as
    | {
        success: boolean
        result?: any
        errors?: any[]
      }
    | null

  if (!resp.ok || !data?.success) {
    const status = (resp.status >= 400 && resp.status <= 599 ? resp.status : 502) as any
    return c.json(
      {
        error: 'Failed to list Stream captions',
        status: resp.status,
        errors: data?.errors ?? [],
      },
      status
    )
  }

  return c.json({ videoId, items: data?.result ?? [] })
})

app.post('/cms/stream/captions/:videoId', async (c) => {
  const auth = await requireCmsAdmin(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)

  const videoId = c.req.param('videoId')?.trim()
  if (!videoId) return c.json({ error: 'videoId is required' }, 400)

  const accountId = (c.env.CLOUDFLARE_ACCOUNT_ID_FOR_STREAM || c.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  const token = (c.env.CLOUDFLARE_STREAM_API_TOKEN || '').trim()
  if (!accountId || !token) {
    return c.json(
      {
        error: 'Cloudflare Stream is not configured',
        required: ['CLOUDFLARE_ACCOUNT_ID(_FOR_STREAM)', 'CLOUDFLARE_STREAM_API_TOKEN'],
      },
      500
    )
  }

  let form: FormData
  try {
    form = await c.req.raw.formData()
  } catch {
    return c.json({ error: 'multipart/form-data is required' }, 400)
  }

  const file = (form.get('file') || form.get('vtt')) as unknown
  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400)
  }

  const languageRaw = String(form.get('language') ?? form.get('lang') ?? 'ja').trim()
  const labelRaw = String(form.get('label') ?? '日本語').trim()
  const isDefaultRaw = String(form.get('default') ?? '').trim().toLowerCase()
  const isDefault = isDefaultRaw === '1' || isDefaultRaw === 'true' || isDefaultRaw === 'yes' || isDefaultRaw === 'on'

  const language = clampText(languageRaw || 'ja', 32)
  const label = clampText(labelRaw || language, 64)

  // Best-effort: require .vtt extension (Cloudflare expects WebVTT).
  const name = String(file.name || 'captions.vtt')
  if (!name.toLowerCase().endsWith('.vtt')) {
    return c.json({ error: 'WebVTT (.vtt) file is required' }, 400)
  }

  // Cloudflare Stream captions API expects a URL to a WebVTT file.
  // Upload the VTT to R2 first, then register the caption in Stream.

  const bodyBytes = await file.arrayBuffer()
  if (bodyBytes.byteLength > 10 * 1024 * 1024) return c.json({ error: 'file too large (max 10MB)' }, 413)

  const keyRaw = `captions/${videoId}/${crypto.randomUUID()}.vtt`
  const contentType = 'text/vtt'

  // Stream captions API requires a URL. We serve the uploaded VTT via this API with
  // an HMAC-signed, time-limited URL so we don't depend on public R2 bucket access.
  const secret = getAuthJwtSecret(c.env)
  if (!secret) return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 500)
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24h
  const unsigned = `captions:${keyRaw}:${exp}`
  const sig = await hs256Sign(secret, unsigned)
  const origin = new URL(c.req.url).origin
  const publicUrl = `${origin}/v1/public/captions?key=${encodeURIComponent(keyRaw)}&exp=${exp}&sig=${encodeURIComponent(sig)}`

  // Prefer R2 binding if available (more reliable; no access keys required).
  if (c.env.BUCKET) {
    try {
      await c.env.BUCKET.put(keyRaw, bodyBytes, {
        httpMetadata: {
          contentType,
        },
      })
    } catch (err) {
      return c.json(
        {
          error: 'Failed to upload captions file to R2',
          details: String((err as any)?.message ?? err).slice(0, 1000),
        },
        502
      )
    }
  } else {
    // Fallback: server-side signed PUT to the R2 S3 API.
    const r2AccountId = (c.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
    const accessKeyId = (c.env.R2_ACCESS_KEY_ID || '').trim()
    const secretAccessKey = (c.env.R2_SECRET_ACCESS_KEY || '').trim()
    const bucket = (c.env.R2_BUCKET || 'assets').trim() || 'assets'

    if (!r2AccountId) return c.json({ error: 'CLOUDFLARE_ACCOUNT_ID is required for R2 upload' }, 500)
    if (!accessKeyId || !secretAccessKey) {
      return c.json({ error: 'R2 credentials are not configured (and BUCKET binding is missing)' }, 501)
    }

    const key = awsEncodePathPreserveSlash(keyRaw)
    const host = `${r2AccountId}.r2.cloudflarestorage.com`
    const canonicalUri = `/${bucket}/${key}`
    const targetUrl = `https://${host}${canonicalUri}`

    const amzDate = amzDateNow()
    const dateStamp = amzDate.slice(0, 8)
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

    let r2Resp: Response
    try {
      r2Resp = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-amz-date': amzDate,
          'x-amz-content-sha256': payloadHash,
          Authorization: authorization,
        },
        body: bodyBytes,
      })
    } catch (err) {
      return c.json(
        {
          error: 'Failed to upload captions file to R2',
          details: String((err as any)?.message ?? err).slice(0, 1000),
        },
        502
      )
    }

    if (!r2Resp.ok) {
      const text = await r2Resp.text().catch(() => '')
      const status = (r2Resp.status >= 400 && r2Resp.status <= 599 ? r2Resp.status : 502) as any
      return c.json(
        {
          error: 'Failed to upload captions file to R2',
          status: r2Resp.status,
          details: text.slice(0, 1000),
        },
        status
      )
    }
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/captions`
  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: publicUrl,
        language,
        label,
        default: isDefault,
      }),
    })
  } catch (err) {
    return c.json(
      {
        error: 'Failed to upload Stream captions',
        details: String((err as any)?.message ?? err).slice(0, 500),
      },
      502
    )
  }

  const data = (await resp.json().catch(() => null)) as
    | {
        success: boolean
        result?: any
        errors?: any[]
      }
    | null

  if (!resp.ok || !data?.success) {
    const status = (resp.status >= 400 && resp.status <= 599 ? resp.status : 502) as any
    return c.json(
      {
        error: 'Failed to upload Stream captions',
        status: resp.status,
        errors: data?.errors ?? [],
        hint: 'If errors mention fetching the VTT URL, confirm this API is publicly reachable and not blocked by IP allowlists.',
      },
      status
    )
  }

  return c.json({ videoId, result: data?.result ?? null })
})

// Public (signed) WebVTT fetch for Cloudflare Stream captions ingest.
app.get('/v1/public/captions', async (c) => {
  const key = String(c.req.query('key') ?? '').trim()
  const expRaw = String(c.req.query('exp') ?? '').trim()
  const sig = String(c.req.query('sig') ?? '').trim()

  if (!key || !expRaw || !sig) return c.json({ error: 'key, exp, sig are required' }, 400)
  if (!key.startsWith('captions/')) return c.json({ error: 'invalid key' }, 400)

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= 0) return c.json({ error: 'invalid exp' }, 400)
  const now = Math.floor(Date.now() / 1000)
  if (now > exp) return c.json({ error: 'expired' }, 410)

  const secret = getAuthJwtSecret(c.env)
  if (!secret) return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 500)

  const unsigned = `captions:${key}:${exp}`
  const expected = await hs256Sign(secret, unsigned)
  if (expected !== sig) return c.json({ error: 'forbidden' }, 403)

  if (!c.env.BUCKET) return c.json({ error: 'BUCKET is not configured' }, 500)
  const obj = await c.env.BUCKET.get(key)
  if (!obj) return c.json({ error: 'not_found' }, 404)

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'text/vtt',
      'Cache-Control': 'public, max-age=600',
    },
  })
})

app.get('/v1/stream/playback/:videoId', async (c) => {
  const videoId = c.req.param('videoId')?.trim()
  if (!videoId) return c.json({ error: 'videoId is required' }, 400)

  // Best-effort analytics: record a play event (never blocks playback).
  try {
    const userId = await optionalAuthUserId(c)
    await tryLogVideoPlay({ db: c.env.DB ?? null, videoId, userId })
  } catch {
    // ignore
  }

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

// Cloudflare Stream RS256 署名付き再生トークン（/token エンドポイント）
// Cloudflare が RS256 署名トークンを生成
app.get('/v1/stream/hmac-signed-playback/:videoId', async (c) => {
  const videoId = c.req.param('videoId')?.trim()
  if (!videoId) return c.json({ error: 'videoId is required' }, 400)

  // Best-effort analytics: record a play event (never blocks playback).
  try {
    const userId = await optionalAuthUserId(c)
    await tryLogVideoPlay({ db: c.env.DB ?? null, videoId, userId })
  } catch {
    // ignore
  }

  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID
  const token = c.env.CLOUDFLARE_STREAM_API_TOKEN

  if (!accountId || !token) {
    return c.json(
      {
        error: 'Cloudflare Stream API is not configured',
        required: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_STREAM_API_TOKEN'],
      },
      500
    )
  }

  try {
    // Step 1: ビデオのメタデータを取得（ホスト情報を含む）
    const videoInfoUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`
    const videoInfoResp = await fetch(videoInfoUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const videoData = (await videoInfoResp.json().catch(() => null)) as
      | {
          success: boolean
          result?: { playback?: { hls?: string } }
          errors?: any[]
        }
      | null

    if (!videoInfoResp.ok || !videoData?.success) {
      console.error('Video info fetch failed:', videoInfoResp.status, videoData?.errors)
      return c.json(
        {
          error: 'Failed to fetch video info',
          status: videoInfoResp.status,
          errors: videoData?.errors ?? [],
        },
        502
      )
    }

    // ホスト情報をHLS URLから抽出（例：https://customer-{HASH}.cloudflarestream.com/{VIDEO_ID}/manifest/video.m3u8）
    const hlsUrl = videoData.result?.playback?.hls
    if (!hlsUrl) {
      return c.json(
        {
          error: 'Video is not ready or playback URL not available',
        },
        503
      )
    }

    // ホスト名を抽出（customer-XXXX.cloudflarestream.com）
    const hostMatch = hlsUrl.match(/https:\/\/(customer-[a-z0-9]+\.cloudflarestream\.com)\//)
    if (!hostMatch) {
      console.error('Failed to extract host from HLS URL:', hlsUrl)
      return c.json(
        {
          error: 'Failed to parse Cloudflare Stream host',
        },
        500
      )
    }
    const host = hostMatch[1]

    // Step 2: Cloudflare の /token エンドポイントで RS256 署名トークンを生成
    const expiresInSeconds = 24 * 60 * 60
    
    const tokenUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/token`
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ttl: expiresInSeconds,
      }),
    })

    const tokenData = (await tokenResp.json().catch(() => null)) as
      | {
          success: boolean
          result?: { token?: string }
          errors?: any[]
        }
      | null

    if (!tokenResp.ok || !tokenData?.success || !tokenData?.result?.token) {
      console.error('Token generation failed:', tokenResp.status, tokenData?.errors)
      return c.json(
        {
          error: 'Failed to generate Cloudflare Stream token',
          status: tokenResp.status,
          errors: tokenData?.errors ?? [],
        },
        502
      )
    }

    const signedToken = tokenData.result.token
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds

    // Step 3: 正しいホスト名でトークン付きURLを構築
    const baseUrl = `https://${host}/${signedToken}`

    return c.json({
      videoId,
      token: signedToken,
      expiresAt: new Date(exp * 1000).toISOString(),
      expiresAtUnix: exp,
      iframeUrl: `${baseUrl}/iframe`,
      hlsUrl: `${baseUrl}/manifest/video.m3u8`,
      dashUrl: `${baseUrl}/manifest/video.mpd`,
      mp4Url: `${baseUrl}/downloads/default.mp4`,
    })
  } catch (err) {
    console.error('Token request error:', err)
    return c.json(
      {
        error: 'Failed to generate signed token',
        message: err instanceof Error ? err.message : String(err),
      },
      500
    )
  }
})

// Private playback (Signed URLs)
app.get('/v1/stream/signed-playback/:videoId', async (c) => {
  const videoId = c.req.param('videoId')?.trim()
  if (!videoId) return c.json({ error: 'videoId is required' }, 400)

  // Best-effort analytics: record a play event (never blocks playback).
  try {
    const userId = await optionalAuthUserId(c)
    await tryLogVideoPlay({ db: c.env.DB ?? null, videoId, userId })
  } catch {
    // ignore
  }

  const keyId = c.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim()
  const jwkRaw =
    c.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK ??
    c.env.CLOUDFLARE_STREAM_SIGNING_KEY_SECRET ??
    c.env.CLOUDFLARE_STREAM_SIGNING_SECRET
  const jwkSource =
    c.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK != null
      ? 'CLOUDFLARE_STREAM_SIGNING_KEY_JWK'
      : c.env.CLOUDFLARE_STREAM_SIGNING_KEY_SECRET != null
        ? 'CLOUDFLARE_STREAM_SIGNING_KEY_SECRET'
        : c.env.CLOUDFLARE_STREAM_SIGNING_SECRET != null
          ? 'CLOUDFLARE_STREAM_SIGNING_SECRET'
          : null

  const keyJwk = jwkRaw ? tryParseJwkFromString(jwkRaw) : null

  if (!keyId || !keyJwk) {
    const missing: string[] = []
    const invalid: string[] = []
    if (!keyId) missing.push('CLOUDFLARE_STREAM_SIGNING_KEY_ID')
    if (!jwkRaw) {
      missing.push(
        'CLOUDFLARE_STREAM_SIGNING_KEY_JWK (or CLOUDFLARE_STREAM_SIGNING_KEY_SECRET / CLOUDFLARE_STREAM_SIGNING_SECRET)'
      )
    } else if (!keyJwk && jwkSource) {
      invalid.push(jwkSource)
    }

    return c.json(
      {
        error: 'Cloudflare Stream Signed URL is not configured',
        required: [
          'CLOUDFLARE_STREAM_SIGNING_KEY_ID',
          'CLOUDFLARE_STREAM_SIGNING_KEY_JWK (or CLOUDFLARE_STREAM_SIGNING_KEY_SECRET / CLOUDFLARE_STREAM_SIGNING_SECRET)',
        ],
        missing,
        invalid,
        note: 'Use the private JWK returned by Cloudflare (data.result.jwk). JSON or base64/base64url-encoded JSON is accepted.',
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

app.get('/v1/top', async (c) => {
  if (isClientMockRequest(c) || !c.env.DB) {
    const toItem = (w: MockWork) => ({
      id: w.id,
      title: w.title,
      thumbnailUrl: w.thumbnailUrl ?? '',
    })

    const mockCasts = [
      { id: 'cast-1', name: '山下美月', thumbnailUrl: '' },
      { id: 'cast-2', name: '本田翼', thumbnailUrl: '' },
      { id: 'cast-3', name: '高石あかり', thumbnailUrl: '' },
      { id: 'cast-4', name: '木戸大聖', thumbnailUrl: '' },
      { id: 'cast-5', name: '森山未来', thumbnailUrl: '' },
    ]

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
      popularCasts: mockCasts,
    })
  }

  const db = c.env.DB as D1Database

  // IMPORTANT: The mobile/web app expects these items to be *works* (content).
  // The home screen opens work detail with the returned `id`.
  const toWorkItem = (r: any) => ({
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    thumbnailUrl: String(r.thumbnail_url ?? ''),
  })

  const toCastItem = (r: any) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    thumbnailUrl: String(r.thumbnail_url ?? ''),
  })

  try {
    const pickupRows = await d1All(
      db,
      `
      SELECT
        w.id,
        w.title,
        MAX(CASE WHEN w.thumbnail_url != '' THEN w.thumbnail_url ELSE v.thumbnail_url END) AS thumbnail_url,
        MIN(fv.sort_order) AS sort_order,
        MIN(fv.created_at) AS created_at
      FROM cms_featured_videos fv
      JOIN videos v ON v.id = fv.video_id
      JOIN works w ON w.id = v.work_id
      WHERE fv.slot = ? AND v.published = 1
      GROUP BY w.id, w.title
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 6
    `,
      ['pickup']
    )

    const recommendRows = await d1All(
      db,
      `
      SELECT
        w.id,
        w.title,
        MAX(CASE WHEN w.thumbnail_url != '' THEN w.thumbnail_url ELSE v.thumbnail_url END) AS thumbnail_url,
        MIN(fv.sort_order) AS sort_order,
        MIN(fv.created_at) AS created_at
      FROM cms_featured_videos fv
      JOIN videos v ON v.id = fv.video_id
      JOIN works w ON w.id = v.work_id
      WHERE fv.slot = ? AND v.published = 1
      GROUP BY w.id, w.title
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 6
    `,
      ['recommend']
    )

    const latestRows = await d1All(
      db,
      `
      SELECT id, title, thumbnail_url
      FROM works
      WHERE published = 1
        OR EXISTS (SELECT 1 FROM videos v WHERE v.work_id = works.id AND v.published = 1)
      ORDER BY created_at DESC
      LIMIT 6
    `
    )

    const pickup = pickupRows.length ? pickupRows.map(toWorkItem) : latestRows.slice(0, 6).map(toWorkItem)
    const recommended = recommendRows.length ? recommendRows.map(toWorkItem) : latestRows.slice(0, 6).map(toWorkItem)
    const rankings = latestRows.slice(0, 5).map(toWorkItem)

    const popularCastRows = await d1All(
      db,
      `
      SELECT c.id, c.name, c.thumbnail_url, COUNT(fc.cast_id) AS fav_count
      FROM casts c
      LEFT JOIN favorite_casts fc ON fc.cast_id = c.id
      GROUP BY c.id
      ORDER BY fav_count DESC, c.updated_at DESC
      LIMIT 5
    `
    )

    const popularCasts = popularCastRows.length
      ? popularCastRows.map(toCastItem)
      : (
          await d1All(
            db,
            `
            SELECT id, name, thumbnail_url
            FROM casts
            ORDER BY updated_at DESC
            LIMIT 5
          `
          )
        ).map(toCastItem)

    return c.json({
      pickup,
      recommended,
      rankings: {
        byViews: rankings,
        byRating: rankings,
        overall: rankings,
      },
      popularCasts,
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// App settings (public)
// Used by mobile/web app to show maintenance screen.
app.get('/v1/settings', async (c) => {
  if (isClientMockRequest(c) || !c.env.DB) {
    return c.json({ maintenanceMode: false, maintenanceMessage: '' })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(db, 'SELECT key, value FROM app_settings WHERE key IN (?, ?)', ['maintenance_mode', 'maintenance_message'])
    const map = new Map<string, string>()
    for (const r of rows) map.set(String((r as any).key ?? ''), String((r as any).value ?? ''))
    return c.json({
      maintenanceMode: map.get('maintenance_mode') === '1',
      maintenanceMessage: map.get('maintenance_message') ?? '',
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

type MockNotice = {
  id: string
  title: string
  publishedAt: string
  excerpt: string
  bodyHtml: string
  tags?: string[]
}

const MOCK_NOTICES: MockNotice[] = [
  {
    id: 'n1',
    title: '新機能追加のお知らせ',
    publishedAt: '2026-01-10 10:00',
    excerpt: '本日より新機能を追加しました。より快適に視聴できるよう改善しています。',
    tags: ['お知らせ'],
    bodyHtml:
      '<p>本日より新機能を追加しました。より快適に視聴できるよう改善しています。</p><p><strong>主な変更点</strong></p><p>・トップ画面右上のベルからお知らせ一覧を確認できます。</p><p>・お知らせ詳細はHTMLで表示されます。</p>',
  },
  {
    id: 'n2',
    title: 'キャンペーン開催のお知らせ',
    publishedAt: '2026-01-09 18:00',
    excerpt: '期間限定キャンペーンを開催します。詳しくはお知らせ詳細をご確認ください。',
    tags: ['お知らせ'],
    bodyHtml:
      '<p>期間限定キャンペーンを開催します。</p><p>詳しくはキャンペーンページをご確認ください。</p><p><a href="https://oshidora.example.com">キャンペーン詳細</a></p>',
  },
]

app.get('/v1/notices', async (c) => {
  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      items: MOCK_NOTICES.map(({ bodyHtml: _bodyHtml, ...rest }) => rest),
    })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = await d1All(
      db,
      `
      SELECT id, subject, body, sent_at, status, created_at, tags,
             COALESCE(NULLIF(sent_at, ''), created_at) AS published_at
      FROM notices
      WHERE (
        -- "sent" は sent_at 未設定でも公開扱い（created_at を表示/並び順に利用）
        (status IS NULL OR status = 'sent')
        OR
        -- "scheduled" は sent_at 必須
        (status = 'scheduled' AND sent_at IS NOT NULL AND sent_at != '')
      )
      ORDER BY published_at DESC, created_at DESC
      LIMIT 100
    `
    )

    return c.json({
      items: rows.map((r: any) => {
        const body = String(r.body ?? '')
        const excerpt = body.replace(/\s+/g, ' ').trim().slice(0, 80)
        return {
          id: String(r.id ?? ''),
          title: String(r.subject ?? ''),
          publishedAt: String((r as any).published_at ?? r.sent_at ?? r.created_at ?? ''),
          excerpt,
          tags: String(r.tags ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }
      }),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/v1/notices/:id', async (c) => {
  const id = c.req.param('id')
  if (isMockRequest(c) || !c.env.DB) {
    const item = MOCK_NOTICES.find((n) => n.id === id) ?? null
    return c.json({ item })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(
      db,
      `
      SELECT id, subject, body, sent_at, status, created_at, tags
      FROM notices
      WHERE id = ?
      LIMIT 1
    `,
      [id]
    )

    if (!row) return c.json({ item: null })

    const sentAt = String((row as any).sent_at ?? '')
    const createdAt = String((row as any).created_at ?? '')
    const publishedAt = sentAt.trim() ? sentAt : createdAt

    return c.json({
      item: {
        id: String(row.id ?? ''),
        title: String(row.subject ?? ''),
        publishedAt,
        bodyHtml: String(row.body ?? ''),
        tags: String(row.tags ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/v1/inquiries', async (c) => {
  const body = (await c.req.json().catch(() => null)) as any
  if (!body || typeof body.subject !== 'string' || typeof body.body !== 'string') {
    return c.json({ error: 'Invalid payload' }, 400)
  }

  const subject = String(body.subject ?? '').trim()
  const text = String(body.body ?? '').trim()
  if (!subject) return c.json({ error: 'subject is required' }, 400)
  if (!text) return c.json({ error: 'body is required' }, 400)
  if (subject.length > 120) return c.json({ error: 'subject is too long' }, 400)
  if (text.length > 2000) return c.json({ error: 'body is too long' }, 400)

  // Mock mode or DB-less environments fall back to a no-op.
  if (isMockRequest(c) || !c.env.DB) return c.json({ ok: true })

  const id = crypto.randomUUID()
  const now = nowIso()
  try {
    await c.env.DB.prepare('INSERT INTO inquiries (id, subject, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, subject, text, 'open', now, now)
      .run()
    return c.json({ ok: true, id })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/v1/categories', async (c) => {
  if (isClientMockRequest(c) || !c.env.DB) {
    return c.json({
      items: [
        { id: 'c1', name: 'ドラマ' },
        { id: 'c2', name: 'ミステリー' },
        { id: 'c3', name: '恋愛' },
        { id: 'c4', name: 'コメディ' },
        { id: 'c5', name: 'アクション' },
      ],
    })
  }

  const db = c.env.DB as D1Database

  try {
    const rows = await d1All(db, 'SELECT id, name FROM categories WHERE enabled = 1 ORDER BY name ASC')
    return c.json({
      items: rows.map((r: any) => ({ id: String(r.id ?? ''), name: String(r.name ?? '') })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
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

// ---- V1: Cast profile requests (end-user self registration) ----
app.get('/v1/cast-profiles/me', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({ item: null })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(
      db,
      `SELECT id, status, submitted_at, decided_at, rejection_reason, draft_json
       FROM cast_profile_requests
       WHERE user_id = ?
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [auth.userId]
    )

    if (!row) return c.json({ item: null })

    const draft = (() => {
      const raw = String((row as any).draft_json ?? '').trim()
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })()

    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        status: String((row as any).status ?? ''),
        submittedAt: String((row as any).submitted_at ?? ''),
        decidedAt: (row as any).decided_at ? String((row as any).decided_at) : null,
        rejectionReason: String((row as any).rejection_reason ?? ''),
        draft,
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.post('/v1/cast-profiles/me', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  type Body = { draft?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const draft = (body as any)?.draft
  if (!draft || typeof draft !== 'object') return c.json({ error: 'draft is required' }, 400)

  const name = clampText(String((draft as any)?.name ?? ''), 50)
  if (!name.trim()) return c.json({ error: 'name is required' }, 400)

  const now = nowIso()

  try {
    const userRow = await d1First(db, 'SELECT email FROM users WHERE id = ? LIMIT 1', [auth.userId])
    const email = clampText(String((userRow as any)?.email ?? ''), 120)

    const pendingRow = await d1First(
      db,
      `SELECT id
       FROM cast_profile_requests
       WHERE user_id = ? AND status = 'pending'
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [auth.userId]
    )

    const draftJson = JSON.stringify(draft)

    if (pendingRow && (pendingRow as any).id) {
      const id = String((pendingRow as any).id)
      await db
        .prepare(
          `UPDATE cast_profile_requests
           SET email = ?, name = ?, draft_json = ?, submitted_at = ?, rejection_reason = '', decided_at = NULL, decided_by_admin_id = NULL
           WHERE id = ?`
        )
        .bind(email, name, draftJson, now, id)
        .run()
      return c.json({ ok: true, id, status: 'pending', submittedAt: now })
    }

    const id = uuidOrFallback('cpr')
    await db
      .prepare(
        `INSERT INTO cast_profile_requests
         (id, user_id, email, name, draft_json, status, submitted_at, decided_at, decided_by_admin_id, rejection_reason)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, '')`
      )
      .bind(id, auth.userId, email, name, draftJson, now)
      .run()

    return c.json({ ok: true, id, status: 'pending', submittedAt: now })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/v1/cast', async (c) => {
  const qRaw = c.req.query('q') ?? ''
  const q = normalizeQuery(qRaw)
  const genreRaw = c.req.query('genre') ?? ''
  const genre = normalizeQuery(genreRaw)

  if (isMockRequest(c) || !c.env.DB) {
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
  }

  const db = c.env.DB as D1Database

  try {
    const where: string[] = []
    const binds: any[] = []

    if (q) {
      where.push('(lower(name) LIKE ? OR lower(role) LIKE ?)')
      binds.push(`%${q}%`, `%${q}%`)
    }
    if (genre) {
      where.push('lower(role) = ?')
      binds.push(genre)
    }

    const sql = `
      SELECT id, name, role, thumbnail_url
      FROM casts
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY name ASC
    `

    const rows = await d1All(db, sql, binds)
    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        name: String(r.name ?? ''),
        role: String(r.role ?? ''),
        genres: [String(r.role ?? '')].filter(Boolean),
        thumbnailUrl: String(r.thumbnail_url ?? ''),
      })),
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
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

async function handleGetFavoriteVideos(c: any) {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const db = c.env.DB as D1Database

  let rows: Array<{ work_id?: unknown; created_at?: unknown; title?: unknown; thumbnail_url?: unknown }> = []
  try {
    rows = await d1All(
      db,
      `SELECT fv.work_id, fv.created_at,
              COALESCE(w.title, '') AS title,
              COALESCE(w.thumbnail_url, '') AS thumbnail_url
       FROM favorite_videos fv
       LEFT JOIN works w ON w.id = fv.work_id
       WHERE fv.user_id = ?
       ORDER BY fv.created_at DESC
       LIMIT 200`,
      [auth.userId]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows
    .map((r) => ({
      id: String(r.work_id ?? '').trim(),
      title: String(r.title ?? '').trim(),
      thumbnailUrl: String(r.thumbnail_url ?? '').trim(),
      favoritedAt: String(r.created_at ?? '').trim(),
    }))
    .filter((x) => x.id)

  return c.json({ items })
}

async function handlePostFavoriteVideos(c: any) {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { workId?: unknown; workIds?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body

  const rawIds = Array.isArray(body.workIds)
    ? body.workIds
    : body.workId === undefined
        ? []
        : [body.workId]

  if (!Array.isArray(rawIds)) return c.json({ error: 'workIds must be an array' }, 400)

  const workIds = Array.from(
    new Set(
      rawIds
        .map((v) => String(v ?? '').trim())
        .filter((v) => v)
    )
  )

  if (workIds.length === 0) return c.json({ error: 'workIds is required' }, 400)
  if (workIds.length > 100) return c.json({ error: 'workIds is too large (max 100)' }, 400)

  const db = c.env.DB as D1Database
  const now = nowIso()

  try {
    await db.batch(
      workIds.map((id) =>
        db
          .prepare('INSERT OR IGNORE INTO favorite_videos (user_id, work_id, created_at) VALUES (?, ?, ?)')
          .bind(auth.userId, id, now)
      )
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ inserted: workIds.length })
}

async function handleDeleteFavoriteVideos(c: any) {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { workIds?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const raw = body.workIds
  if (!Array.isArray(raw)) return c.json({ error: 'workIds must be an array' }, 400)

  const workIds = Array.from(
    new Set(
      raw
        .map((v) => String(v ?? '').trim())
        .filter((v) => v)
    )
  )

  if (workIds.length === 0) return c.json({ error: 'workIds is required' }, 400)
  if (workIds.length > 100) return c.json({ error: 'workIds is too large (max 100)' }, 400)

  const placeholders = workIds.map(() => '?').join(',')
  try {
    await c.env.DB.prepare(`DELETE FROM favorite_videos WHERE user_id = ? AND work_id IN (${placeholders})`)
      .bind(auth.userId, ...workIds)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ deleted: workIds.length })
}

app.get('/v1/favorites/casts', handleGetFavoriteCasts)
app.delete('/v1/favorites/casts', handleDeleteFavoriteCasts)

app.get('/v1/favorites/videos', handleGetFavoriteVideos)
app.post('/v1/favorites/videos', handlePostFavoriteVideos)
app.delete('/v1/favorites/videos', handleDeleteFavoriteVideos)

// Design-doc compatibility (docs/アプリ/* use /api/...)
app.get('/api/favorites/casts', handleGetFavoriteCasts)
app.delete('/api/favorites/casts', handleDeleteFavoriteCasts)
app.get('/api/favorites/videos', handleGetFavoriteVideos)
app.post('/api/favorites/videos', handlePostFavoriteVideos)
app.delete('/api/favorites/videos', handleDeleteFavoriteVideos)
app.get('/v1/videos', async (c) => {
  const categoryId = String(c.req.query('category_id') ?? '').trim()
  const tag = normalizeQuery(String(c.req.query('tag') ?? ''))

  // If mock mode is enabled OR DB is not available, return mock data
  if (isClientMockRequest(c) || !c.env.DB) {
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
  }

  // Production: Query database
  const db = c.env.DB as D1Database
  const whereConditions: string[] = ['deleted = 0']
  const params: any[] = []

  if (categoryId) {
    whereConditions.push('category_id = ?')
    params.push(categoryId)
  }
  if (tag) {
    whereConditions.push("tags LIKE ?")
    params.push(`%${tag}%`)
  }

  let results: any[] = []
  try {
    const query = `SELECT id, title, rating_avg as ratingAvg, review_count as reviewCount, price_coin as priceCoin, thumbnail_url as thumbnailUrl, tags FROM videos WHERE ${whereConditions.join(' AND ')} ORDER BY created_at DESC`
    const out = await db.prepare(query).bind(...params).all()
    results = (out as any).results ?? []
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    return c.json({ error: 'failed_to_query_videos' }, 500)
  }

  return c.json({
    items: (results ?? []).map((r: any) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      ratingAvg: Number(r.ratingAvg ?? 0) || 0,
      reviewCount: Number(r.reviewCount ?? 0) || 0,
      priceCoin: Number(r.priceCoin ?? 0) || 0,
      thumbnailUrl: String(r.thumbnailUrl ?? ''),
      tags: typeof r.tags === 'string' ? r.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t) : [],
    })),
  })
})

app.get('/v1/videos/:id', async (c) => {
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  if (isClientMockRequest(c) || !c.env.DB) {
    const v = MOCK_VIDEOS.find((x) => x.id === id)
    if (!v) return c.json({ error: 'not_found' }, 404)

    const workTitle = workTitleFromVideoTitle(v.title)
    const workId = WORK_ID_BY_TITLE[workTitle] ?? workTitle
    const episodeNo = (() => {
      const m = String(v.title ?? '').match(/第\s*0*(\d+)\s*話/)
      if (!m) return null
      const n = Number(m[1])
      return Number.isFinite(n) ? n : null
    })()

    return c.json({
      item: {
        id: v.id,
        workId,
        workTitle,
        title: v.title,
        episodeNo,
        thumbnailUrl: v.thumbnailUrl ?? '',
        published: true,
        scheduledAt: null,
        streamVideoId: '',
        streamVideoIdClean: '',
        streamVideoIdSubtitled: '',
      },
    })
  }

  const db = c.env.DB as D1Database

  try {
    const row = await d1First(
      db,
      "SELECT v.id, v.work_id, COALESCE(w.title, '') AS work_title, v.title, v.thumbnail_url, v.published, v.scheduled_at, v.episode_no, v.stream_video_id, COALESCE(v.stream_video_id_clean, '') AS stream_video_id_clean, COALESCE(v.stream_video_id_subtitled, '') AS stream_video_id_subtitled FROM videos v LEFT JOIN works w ON w.id = v.work_id WHERE v.id = ? AND v.deleted = 0 LIMIT 1",
      [id]
    )

    if (!row) return c.json({ error: 'not_found' }, 404)

    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        workId: String((row as any).work_id ?? ''),
        workTitle: String((row as any).work_title ?? ''),
        title: String((row as any).title ?? ''),
        episodeNo: (row as any).episode_no == null ? null : Number((row as any).episode_no),
        thumbnailUrl: String((row as any).thumbnail_url ?? ''),
        published: Boolean((row as any).published),
        scheduledAt: (row as any).scheduled_at == null ? null : String((row as any).scheduled_at),
        streamVideoId: String((row as any).stream_video_id ?? ''),
        streamVideoIdClean: String((row as any).stream_video_id_clean ?? ''),
        streamVideoIdSubtitled: String((row as any).stream_video_id_subtitled ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    return c.json({ error: 'failed_to_query_video' }, 500)
  }
})

app.get('/v1/comments', async (c) => {
  const contentId = (c.req.query('content_id') ?? '').trim()
  if (!contentId) return c.json({ error: 'content_id is required' }, 400)

  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') ?? 20) || 20))

  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  let results: any[] = []
  try {
    const out = await c.env.DB
      .prepare(
        "SELECT id, author, body, episode_id, created_at FROM comments WHERE content_id = ? AND status = 'approved' AND deleted = 0 ORDER BY created_at DESC LIMIT ?"
      )
      .bind(contentId, limit)
      .all()
    results = (out as any).results ?? []
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

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

app.get('/v1/works', async (c) => {
  const q = normalizeQuery(String(c.req.query('q') ?? ''))
  const categoryId = String(c.req.query('category_id') ?? '').trim()
  const tag = normalizeQuery(String(c.req.query('tag') ?? ''))

  const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') ?? 20) || 20))
  const cursorRaw = String(c.req.query('cursor') ?? '').trim()
  const offset = cursorRaw ? Math.max(0, Number(cursorRaw) || 0) : 0

  if (isClientMockRequest(c) || !c.env.DB) {
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
  }

  const db = c.env.DB as D1Database

  const where: string[] = [
    '(w.published = 1 OR EXISTS (SELECT 1 FROM videos vpub WHERE vpub.work_id = w.id AND vpub.published = 1))',
  ]
  const binds: any[] = []

  if (q) {
    where.push('lower(w.title) LIKE ?')
    binds.push(`%${q}%`)
  }
  if (categoryId) {
    where.push(
      `EXISTS (SELECT 1 FROM work_categories wc WHERE wc.work_id = w.id AND wc.category_id = ?)`
    )
    binds.push(categoryId)
  }
  if (tag) {
    where.push(
      `EXISTS (
        SELECT 1
        FROM work_tags wt2
        JOIN tags t2 ON t2.id = wt2.tag_id
        WHERE wt2.work_id = w.id AND lower(t2.name) = ?
      )`
    )
    binds.push(tag)
  }

  const sql = `
    SELECT
      w.id,
      w.title,
      w.thumbnail_url,
      COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tag_names
    FROM works w
    LEFT JOIN work_tags wt ON wt.work_id = w.id
    LEFT JOIN tags t ON t.id = wt.tag_id
    WHERE ${where.join(' AND ')}
    GROUP BY w.id
    ORDER BY w.created_at DESC
    LIMIT ? OFFSET ?
  `

  try {
    const rows = await d1All(db, sql, [...binds, limit, offset])
    const items = rows.map((r: any) => {
      const raw = String(r.tag_names ?? '').trim()
      const tags = raw
        ? raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []

      return {
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        ratingAvg: 0,
        reviewCount: 0,
        priceCoin: 0,
        thumbnailUrl: String(r.thumbnail_url ?? ''),
        tags,
      }
    })

    const nextCursor = items.length < limit ? null : String(offset + limit)
    return c.json({ items, nextCursor })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.get('/v1/works/:id', async (c) => {
  const id = String(c.req.param('id') ?? '').trim()
  if (!id) return c.json({ error: 'id is required' }, 400)

  // Debug/mock support (client-side toggle) or local dev without DB.
  if (isClientMockRequest(c) || !c.env.DB) {
    const found = MOCK_WORKS.find((w) => w.id === id)
    if (!found) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: found.id,
        title: found.title,
        description: '',
        thumbnailUrl: found.thumbnailUrl,
        published: true,
        tags: found.tags,
      },
      episodes: [],
    })
  }

  const db = c.env.DB as D1Database

  let work: any = null
  try {
    work = await d1First(
      db,
      'SELECT id, title, description, thumbnail_url, published, created_at, updated_at FROM works WHERE id = ? LIMIT 1',
      [id]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  if (!work) return c.json({ error: 'not_found' }, 404)

  let tagRows: any[] = []
  try {
    tagRows = await d1All(
      db,
      `
        SELECT t.name
        FROM work_tags wt
        JOIN tags t ON t.id = wt.tag_id
        WHERE wt.work_id = ?
        ORDER BY lower(t.name) ASC
      `,
      [id]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  let videoRows: any[] = []
  try {
    videoRows = await d1All(
      db,
      `
        SELECT id, title, thumbnail_url, published, scheduled_at, episode_no, created_at,
               stream_video_id, COALESCE(stream_video_id_clean, '') AS stream_video_id_clean, COALESCE(stream_video_id_subtitled, '') AS stream_video_id_subtitled
        FROM videos
        WHERE work_id = ?
        ORDER BY COALESCE(episode_no, 999999) ASC, created_at ASC
      `,
      [id]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const tags = (tagRows ?? [])
    .map((r: any) => String(r?.name ?? '').trim())
    .filter(Boolean)

  const hasPublishedEpisode = (videoRows ?? []).some((r: any) => Number(r?.published ?? 0) === 1)

  return c.json({
    item: {
      id: String(work.id ?? ''),
      title: String(work.title ?? ''),
      description: String(work.description ?? ''),
      thumbnailUrl: String(work.thumbnail_url ?? ''),
      published: Number(work.published ?? 0) === 1 || hasPublishedEpisode,
      tags,
      createdAt: String(work.created_at ?? ''),
      updatedAt: String(work.updated_at ?? ''),
    },
    episodes: (videoRows ?? []).map((r: any) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      thumbnailUrl: String(r.thumbnail_url ?? ''),
      episodeNo: r.episode_no == null ? null : Number(r.episode_no),
      published: Number(r.published ?? 0) === 1,
      scheduledAt: r.scheduled_at == null ? null : String(r.scheduled_at),
      streamVideoId: String(r.stream_video_id ?? ''),
      streamVideoIdClean: String(r.stream_video_id_clean ?? ''),
      streamVideoIdSubtitled: String(r.stream_video_id_subtitled ?? ''),
      // Pricing is not part of the public schema yet; the client can treat it as free.
      priceCoin: 0,
    })),
  })
})

app.get('/v1/search', async (c) => {
  const qRaw = c.req.query('q') ?? ''
  const q = normalizeQuery(qRaw)
  const limit = Math.max(1, Math.min(50, Number(c.req.query('limit') ?? 20) || 20))

  if (!q) {
    return c.json({ videos: [], casts: [] })
  }

  if (!isMockRequest(c) && c.env.DB) {
    const db = c.env.DB as D1Database
    try {
      const casts = await d1All(
        db,
        `
        SELECT id, name, role, thumbnail_url
        FROM casts
        WHERE lower(name) LIKE ? OR lower(role) LIKE ?
        ORDER BY name ASC
        LIMIT ?
      `,
        [`%${q}%`, `%${q}%`, limit]
      )

      const videos = await d1All(
        db,
        `
        SELECT v.id, v.title, v.thumbnail_url
        FROM videos v
        WHERE v.published = 1
          AND (
            lower(v.title) LIKE ?
            OR lower(v.description) LIKE ?
            OR EXISTS (
              SELECT 1
              FROM video_casts vc
              JOIN casts c ON c.id = vc.cast_id
              WHERE vc.video_id = v.id AND lower(c.name) LIKE ?
            )
          )
        ORDER BY v.created_at DESC
        LIMIT ?
      `,
        [`%${q}%`, `%${q}%`, `%${q}%`, limit]
      )

      return c.json({
        videos: videos.map((r: any) => ({
          id: String(r.id ?? ''),
          title: String(r.title ?? ''),
          ratingAvg: 0,
          reviewCount: 0,
          priceCoin: 0,
          thumbnailUrl: String(r.thumbnail_url ?? ''),
        })),
        casts: casts.map((r: any) => ({
          id: String(r.id ?? ''),
          name: String(r.name ?? ''),
          role: String(r.role ?? ''),
          thumbnailUrl: String(r.thumbnail_url ?? ''),
        })),
      })
    } catch (err) {
      if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
      throw err
    }
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

// -----------------------------
// Me (login + subscription)
// -----------------------------

app.get('/v1/me', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  try {
    const row = await c.env.DB
      .prepare(
        `SELECT
          id,
          email,
          phone,
          display_name,
          avatar_url,
          full_name,
          full_name_kana,
          birth_date,
          favorite_genres_json,
          is_subscribed,
          subscription_started_at,
          subscription_ended_at,
          subscription_status
        FROM users
        WHERE id = ?
        LIMIT 1`
      )
      .bind(auth.userId)
      .first<any>()

    if (!row) return c.json({ error: 'not_found' }, 404)

    const favoriteGenres = (() => {
      const raw = String(row.favorite_genres_json ?? '').trim()
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.map((v) => String(v ?? '').trim()).filter(Boolean)
      } catch {
        return []
      }
    })()

    return c.json({
      id: String(row.id),
      email: String(row.email ?? ''),
      phone: String(row.phone ?? ''),
      isSubscribed: Number(row.is_subscribed ?? 0) === 1,
      subscription: {
        status: String(row.subscription_status ?? ''),
        startedAt: row.subscription_started_at ? String(row.subscription_started_at) : null,
        endedAt: row.subscription_ended_at ? String(row.subscription_ended_at) : null,
      },
      profile: {
        displayName: String(row.display_name ?? ''),
        avatarUrl: String(row.avatar_url ?? ''),
        fullName: String(row.full_name ?? ''),
        fullNameKana: String(row.full_name_kana ?? ''),
        birthDate: String(row.birth_date ?? ''),
        favoriteGenres,
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

app.put('/v1/me/profile', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = {
    displayName?: unknown
    avatarUrl?: unknown
    fullName?: unknown
    fullNameKana?: unknown
    birthDate?: unknown
    favoriteGenres?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body

  const displayName = body.displayName === undefined ? null : clampText(body.displayName, 40)
  const avatarUrl = body.avatarUrl === undefined ? null : clampText(body.avatarUrl, 500)
  const fullName = body.fullName === undefined ? null : clampText(body.fullName, 80)
  const fullNameKana = body.fullNameKana === undefined ? null : clampText(body.fullNameKana, 80)
  const birthDateRaw = body.birthDate === undefined ? null : String(body.birthDate ?? '').trim()
  const birthDate = birthDateRaw === null ? null : clampText(birthDateRaw, 10)

  const favoriteGenres = (() => {
    if (body.favoriteGenres === undefined) return null

    const fromUnknown = (value: unknown): string[] => {
      const raw = Array.isArray(value) ? value : String(value ?? '')
      const list = Array.isArray(raw)
        ? raw.map((v) => String(v ?? '').trim()).filter(Boolean)
        : String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)

      const uniq: string[] = []
      const seen = new Set<string>()
      for (const v of list) {
        const clipped = clampText(v, 60)
        if (!clipped) continue
        if (seen.has(clipped)) continue
        seen.add(clipped)
        uniq.push(clipped)
        if (uniq.length >= 50) break
      }
      return uniq
    }

    return fromUnknown(body.favoriteGenres)
  })()

  if (birthDate !== null && birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return c.json({ error: 'invalid_birthDate' }, 400)
  }

  const sets: string[] = []
  const binds: any[] = []
  if (displayName !== null) {
    if (!displayName) return c.json({ error: 'displayName is required' }, 400)
    sets.push('display_name = ?')
    binds.push(displayName)
  }
  if (avatarUrl !== null) {
    sets.push('avatar_url = ?')
    binds.push(avatarUrl || '')
  }
  if (fullName !== null) {
    if (!fullName) return c.json({ error: 'fullName is required' }, 400)
    sets.push('full_name = ?')
    binds.push(fullName)
  }
  if (fullNameKana !== null) {
    if (!fullNameKana) return c.json({ error: 'fullNameKana is required' }, 400)
    sets.push('full_name_kana = ?')
    binds.push(fullNameKana)
  }
  if (birthDate !== null) {
    if (!birthDate) return c.json({ error: 'birthDate is required' }, 400)
    sets.push('birth_date = ?')
    binds.push(birthDate)
  }
  if (favoriteGenres !== null) {
    // For registration, require at least 1; for later edits, client can still clear by sending [].
    sets.push('favorite_genres_json = ?')
    binds.push(JSON.stringify(favoriteGenres))
  }

  if (sets.length === 0) return c.json({ ok: true })

  const now = nowIso()
  sets.push('updated_at = ?')
  binds.push(now)
  binds.push(auth.userId)

  try {
    await c.env.DB
      .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...binds)
      .run()
    return c.json({ ok: true })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// -----------------------------
// Me: change email / phone (requires re-verification)
// -----------------------------

app.post('/v1/me/email/change/start', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { email?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = normalizeEmail(String(body.email ?? ''))
  if (!email) return c.json({ error: 'email is required' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first<any>()
  if (existing && String(existing.id ?? '') !== auth.userId) {
    return c.json({ error: 'email_in_use' }, 409)
  }

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const code = makeRandomDigits(6)
  const codeHash = await hashVerificationCode(code, pepper)
  const now = nowIso()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  try {
    await c.env.DB
      .prepare(
        'INSERT INTO verification_codes (id, user_id, kind, target, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(crypto.randomUUID(), auth.userId, 'email_change', email, codeHash, expiresAt, now)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const mailRes = await sendEmailViaMailChannels(
    c.env,
    email,
    '【推しドラ】メールアドレス変更 認証コード',
    `認証コード: ${code}\n\n有効期限: 10分\n`
  )

  const debugCode = shouldReturnDebugCodes(c.env) ? code : undefined
  if (!mailRes.ok) {
    if (debugCode) return c.json({ ok: true, email, debugCode, warning: mailRes.error })
    return c.json({ error: mailRes.error, debugCode }, (mailRes.status ?? 502) as any)
  }
  return c.json({ ok: true, email, debugCode })
})

app.post('/v1/me/email/change/resend', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { email?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = normalizeEmail(String(body.email ?? ''))
  if (!email) return c.json({ error: 'email is required' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first<any>()
  if (existing && String(existing.id ?? '') !== auth.userId) {
    return c.json({ error: 'email_in_use' }, 409)
  }

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const code = makeRandomDigits(6)
  const codeHash = await hashVerificationCode(code, pepper)
  const now = nowIso()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  try {
    await c.env.DB
      .prepare(
        'INSERT INTO verification_codes (id, user_id, kind, target, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(crypto.randomUUID(), auth.userId, 'email_change', email, codeHash, expiresAt, now)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const mailRes = await sendEmailViaMailChannels(
    c.env,
    email,
    '【推しドラ】メールアドレス変更 認証コード（再送）',
    `認証コード: ${code}\n\n有効期限: 10分\n`
  )

  const debugCode = shouldReturnDebugCodes(c.env) ? code : undefined
  if (!mailRes.ok) {
    if (debugCode) return c.json({ ok: true, email, debugCode, warning: mailRes.error })
    return c.json({ error: mailRes.error, debugCode }, (mailRes.status ?? 502) as any)
  }
  return c.json({ ok: true, email, debugCode })
})

app.post('/v1/me/email/change/verify', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { email?: unknown; code?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const email = normalizeEmail(String(body.email ?? ''))
  const code = digitsOnly(String(body.code ?? ''))
  if (!email) return c.json({ error: 'email is required' }, 400)
  if (code.length !== 6) return c.json({ error: 'code must be 6 digits' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first<any>()
  if (existing && String(existing.id ?? '') !== auth.userId) {
    return c.json({ error: 'email_in_use' }, 409)
  }

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const codeHash = await hashVerificationCode(code, pepper)
  const nowIsoStr = nowIso()

  const row = await c.env.DB
    .prepare(
      "SELECT id, expires_at, consumed_at FROM verification_codes WHERE kind = 'email_change' AND target = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(email, auth.userId)
    .first<any>()

  if (!row) return c.json({ error: 'code_not_found' }, 400)
  if (row.consumed_at) return c.json({ error: 'code_already_used' }, 400)
  if (String(row.expires_at) < nowIsoStr) return c.json({ error: 'code_expired' }, 400)

  const ok = await c.env.DB
    .prepare('SELECT id FROM verification_codes WHERE id = ? AND code_hash = ?')
    .bind(String(row.id), codeHash)
    .first<any>()
  if (!ok) {
    await c.env.DB.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').bind(String(row.id)).run()
    return c.json({ error: 'invalid_code' }, 400)
  }

  await c.env.DB.prepare('UPDATE verification_codes SET consumed_at = ? WHERE id = ?').bind(nowIsoStr, String(row.id)).run()

  try {
    await c.env.DB
      .prepare('UPDATE users SET email = ?, email_verified = 1, updated_at = ? WHERE id = ?')
      .bind(email, nowIsoStr, auth.userId)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true, email })
})

app.post('/v1/me/phone/change/start', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { phone?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const phoneDigits = normalizePhoneDigitsForJP(String(body.phone ?? ''))
  if (phoneDigits.length < 10 || phoneDigits.length > 20) return c.json({ error: 'invalid_phone' }, 400)

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const code = makeRandomDigits(4)
  const codeHash = await hashVerificationCode(code, pepper)
  const now = nowIso()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  try {
    await c.env.DB
      .prepare(
        'INSERT INTO verification_codes (id, user_id, kind, target, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(crypto.randomUUID(), auth.userId, 'sms_change', phoneDigits, codeHash, expiresAt, now)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const smsRes = await sendSmsViaTwilio(c.env, `+${phoneDigits}`, `【推しドラ】認証コード: ${code}`)
  const debugCode = shouldReturnDebugCodes(c.env) ? code : undefined
  if (!smsRes.ok) {
    if (debugCode) return c.json({ ok: true, debugCode, warning: smsRes.error })
    return c.json({ error: smsRes.error, debugCode }, (smsRes.status ?? 502) as any)
  }
  return c.json({ ok: true, debugCode })
})

app.post('/v1/me/phone/change/verify', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  type Body = { phone?: unknown; code?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const phoneDigits = normalizePhoneDigitsForJP(String(body.phone ?? ''))
  const code = digitsOnly(String(body.code ?? ''))
  if (phoneDigits.length < 10 || phoneDigits.length > 20) return c.json({ error: 'invalid_phone' }, 400)
  if (code.length !== 4) return c.json({ error: 'code must be 4 digits' }, 400)

  const pepper = (c.env.AUTH_CODE_PEPPER ?? '').trim()
  if (!pepper) return c.json({ error: 'AUTH_CODE_PEPPER is not configured' }, 500)
  const codeHash = await hashVerificationCode(code, pepper)
  const nowIsoStr = nowIso()

  let row: any
  try {
    row = await c.env.DB
      .prepare(
        "SELECT id, expires_at, consumed_at FROM verification_codes WHERE kind = 'sms_change' AND target = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .bind(phoneDigits, auth.userId)
      .first<any>()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  if (!row) return c.json({ error: 'code_not_found' }, 400)
  if (row.consumed_at) return c.json({ error: 'code_already_used' }, 400)
  if (String(row.expires_at) < nowIsoStr) return c.json({ error: 'code_expired' }, 400)

  const ok = await c.env.DB
    .prepare('SELECT id FROM verification_codes WHERE id = ? AND code_hash = ?')
    .bind(String(row.id), codeHash)
    .first<any>()
  if (!ok) {
    await c.env.DB.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').bind(String(row.id)).run()
    return c.json({ error: 'invalid_code' }, 400)
  }

  try {
    await c.env.DB.prepare('UPDATE verification_codes SET consumed_at = ? WHERE id = ?').bind(nowIsoStr, String(row.id)).run()
    await c.env.DB
      .prepare('UPDATE users SET phone = ?, phone_verified = 1, updated_at = ? WHERE id = ?')
      .bind(phoneDigits, nowIsoStr, auth.userId)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  return c.json({ ok: true, phone: phoneDigits })
})

// -----------------------------
// Stripe (subscription)
// -----------------------------

app.post('/api/stripe/checkout/subscription', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const secretKey = getStripeSecretKey(c.env)
  if (!secretKey) return c.json({ error: 'STRIPE_SECRET_KEY is not configured' }, 500)
  const priceId = getStripePriceId(c.env)
  if (!priceId) return c.json({ error: 'STRIPE_SUBSCRIPTION_PRICE_ID is not configured' }, 500)
  const { successUrl, cancelUrl } = getStripeCheckoutUrls(c.env)
  if (!successUrl || !cancelUrl) return c.json({ error: 'STRIPE_CHECKOUT_SUCCESS_URL / STRIPE_CHECKOUT_CANCEL_URL is not configured' }, 500)

  const user = await c.env.DB
    .prepare('SELECT id, email, stripe_customer_id FROM users WHERE id = ? LIMIT 1')
    .bind(auth.userId)
    .first<any>()
  if (!user) return c.json({ error: 'not_found' }, 404)

  let customerId = String(user.stripe_customer_id ?? '').trim()
  if (!customerId) {
    const p = new URLSearchParams()
    p.set('metadata[userId]', auth.userId)
    const email = String(user.email ?? '').trim()
    if (email) p.set('email', email)
    const created = await stripePostForm<{ id: string }>(secretKey, '/customers', p)
    customerId = String(created.id ?? '').trim()
    if (!customerId) return c.json({ error: 'stripe_customer_create_failed' }, 502)
    const now = nowIso()
    await c.env.DB
      .prepare('UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?')
      .bind(customerId, now, auth.userId)
      .run()
  }

  const params = new URLSearchParams()
  params.set('mode', 'subscription')
  params.set('customer', customerId)
  params.set('client_reference_id', auth.userId)
  params.set('success_url', successUrl)
  params.set('cancel_url', cancelUrl)
  params.set('line_items[0][price]', priceId)
  params.set('line_items[0][quantity]', '1')
  params.set('metadata[userId]', auth.userId)
  params.set('subscription_data[metadata][userId]', auth.userId)

  const idempotencyKey = `sub_checkout_${auth.userId}_${new Date().toISOString().slice(0, 10)}`
  const session = await stripePostForm<{ id: string; url?: string }>(secretKey, '/checkout/sessions', params, { idempotencyKey })

  const url = String(session.url ?? '').trim()
  if (!url) return c.json({ error: 'stripe_checkout_url_missing' }, 502)
  return c.json({ checkoutUrl: url })
})

app.post('/api/stripe/portal', async (c) => {
  const auth = await requireAuth(c)
  if (!auth.ok) return c.json({ error: auth.error }, auth.status as any)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const secretKey = getStripeSecretKey(c.env)
  if (!secretKey) return c.json({ error: 'STRIPE_SECRET_KEY is not configured' }, 500)
  const returnUrl = getStripePortalReturnUrl(c.env)
  if (!returnUrl) return c.json({ error: 'STRIPE_PORTAL_RETURN_URL is not configured' }, 500)

  const user = await c.env.DB
    .prepare('SELECT stripe_customer_id FROM users WHERE id = ? LIMIT 1')
    .bind(auth.userId)
    .first<any>()
  const customerId = String(user?.stripe_customer_id ?? '').trim()
  if (!customerId) return c.json({ error: 'stripe_customer_missing' }, 409)

  const params = new URLSearchParams()
  params.set('customer', customerId)
  params.set('return_url', returnUrl)
  const session = await stripePostForm<{ url?: string }>(secretKey, '/billing_portal/sessions', params)
  const url = String(session.url ?? '').trim()
  if (!url) return c.json({ error: 'stripe_portal_url_missing' }, 502)
  return c.json({ url })
})

app.post('/api/stripe/webhook', async (c) => {
  const secret = getStripeWebhookSecret(c.env)
  if (!secret) return c.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' }, 500)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)

  const rawBody = await c.req.text()
  const sigHeader = c.req.header('stripe-signature') ?? ''
  const ok = await stripeVerifyWebhookSignature({ rawBody, signatureHeader: sigHeader, secret })
  if (!ok) return c.json({ error: 'invalid_signature' }, 400)

  const event = JSON.parse(rawBody) as any
  const type = String(event?.type ?? '')
  const obj = event?.data?.object ?? {}
  const now = nowIso()

  const setSubscribedByUserId = async (userId: string, subscribed: boolean, extra?: { customerId?: string; subscriptionId?: string; status?: string }) => {
    const u = String(userId ?? '').trim()
    if (!u) return
    const status = String(extra?.status ?? '').trim()
    const customerId = String(extra?.customerId ?? '').trim()
    const subscriptionId = String(extra?.subscriptionId ?? '').trim()
    await c.env.DB
      .prepare(
        `UPDATE users
         SET is_subscribed = ?,
             subscription_started_at = CASE WHEN ? = 1 THEN COALESCE(subscription_started_at, ?) ELSE subscription_started_at END,
             subscription_ended_at = CASE WHEN ? = 1 THEN NULL ELSE ? END,
             subscription_status = COALESCE(NULLIF(?, ''), subscription_status),
             stripe_customer_id = COALESCE(NULLIF(?, ''), stripe_customer_id),
             stripe_subscription_id = COALESCE(NULLIF(?, ''), stripe_subscription_id),
             updated_at = ?
         WHERE id = ?`
      )
      .bind(subscribed ? 1 : 0, subscribed ? 1 : 0, now, subscribed ? 1 : 0, now, status, customerId, subscriptionId, now, u)
      .run()
  }

  const setSubscribedByCustomerOrMetadata = async (opts: { customerId?: string; subscriptionId?: string; userId?: string; status?: string }) => {
    const customerId = String(opts.customerId ?? '').trim()
    const subscriptionId = String(opts.subscriptionId ?? '').trim()
    const userId = String(opts.userId ?? '').trim()
    const status = String(opts.status ?? '').trim()

    const isActive = status === 'active' || status === 'trialing'

    if (userId) {
      await setSubscribedByUserId(userId, isActive, { customerId, subscriptionId, status })
      return
    }

    if (subscriptionId) {
      const row = await c.env.DB
        .prepare('SELECT id FROM users WHERE stripe_subscription_id = ? LIMIT 1')
        .bind(subscriptionId)
        .first<any>()
      const uid = String(row?.id ?? '').trim()
      if (uid) {
        await setSubscribedByUserId(uid, isActive, { customerId, subscriptionId, status })
        return
      }
    }

    if (customerId) {
      const row = await c.env.DB
        .prepare('SELECT id FROM users WHERE stripe_customer_id = ? LIMIT 1')
        .bind(customerId)
        .first<any>()
      const uid = String(row?.id ?? '').trim()
      if (uid) {
        await setSubscribedByUserId(uid, isActive, { customerId, subscriptionId, status })
      }
    }
  }

  if (type === 'checkout.session.completed') {
    const mode = String(obj?.mode ?? '')
    if (mode === 'subscription') {
      const userId = String(obj?.client_reference_id ?? obj?.metadata?.userId ?? '').trim()
      const customerId = String(obj?.customer ?? '').trim()
      const subscriptionId = String(obj?.subscription ?? '').trim()
      await setSubscribedByUserId(userId, true, { customerId, subscriptionId, status: 'active' })
    }
    return c.json({ ok: true })
  }

  if (type === 'customer.subscription.created' || type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
    const customerId = String(obj?.customer ?? '').trim()
    const subscriptionId = String(obj?.id ?? '').trim()
    const status = String(obj?.status ?? (type === 'customer.subscription.deleted' ? 'canceled' : '')).trim()
    const userId = String(obj?.metadata?.userId ?? '').trim()
    await setSubscribedByCustomerOrMetadata({ customerId, subscriptionId, userId, status })
    return c.json({ ok: true })
  }

  return c.json({ ok: true })
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

  const secret = getAuthJwtSecret(c.env)
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

  let user: any = null
  try {
    user = await c.env.DB.prepare(
      'SELECT id, email_verified, phone, phone_verified, sms_auth_skip, password_hash, password_salt FROM users WHERE email = ?'
    )
      .bind(email)
      .first<any>()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    console.error('login/start: failed to query user', err)
    return c.json({ error: 'internal_query_user', message: String((err as any)?.message ?? err).slice(0, 180) }, 500)
  }

  if (!user) return c.json({ error: 'invalid_credentials' }, 401)
  if (Number(user.email_verified) !== 1) return c.json({ error: 'email_not_verified' }, 403)

  let passOk = false
  try {
    passOk = await verifyPassword(password, String(user.password_salt), String(user.password_hash))
  } catch (err) {
    // Stored hash/salt may be invalid base64, or crypto APIs may fail.
    console.error('login/start: failed to verify password', err)
    return c.json({ error: 'internal_verify_password', message: String((err as any)?.message ?? err).slice(0, 180) }, 500)
  }
  if (!passOk) return c.json({ error: 'invalid_credentials' }, 401)

  const secret = getAuthJwtSecret(c.env)
  if (!secret) return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 500)
  const hasVerifiedPhone = Number(user.phone_verified ?? 0) === 1 && String(user.phone ?? '').trim().length > 0
  const smsAuthSkip = Number(user.sms_auth_skip ?? 0) === 1
  const stage = smsAuthSkip || hasVerifiedPhone ? 'full' : 'needs_sms'

  let token = ''
  try {
    token = await makeJwtHs256(secret, { userId: String(user.id), stage }, 60 * 30)
  } catch (err) {
    console.error('login/start: failed to sign jwt', err)
    return c.json({ error: 'internal_sign_jwt', message: String((err as any)?.message ?? err).slice(0, 180) }, 500)
  }
  const phoneMasked = user.phone ? String(user.phone).replace(/.(?=.{4})/g, '*') : null
  return c.json({ ok: true, token, stage, phoneMasked, phoneRequired: !(smsAuthSkip || hasVerifiedPhone) })
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

  const secret = getAuthJwtSecret(c.env)
  if (!secret) return c.json({ error: 'AUTH_JWT_SECRET is not configured' }, 500)
  const token = await makeJwtHs256(secret, { userId: auth.userId, stage: 'full' })
  return c.json({ ok: true, token, stage: 'full' })
})

export default {
  fetch: app.fetch,
  scheduled: async (controller: any, env: Env['Bindings'], ctx: ExecutionContext) => {
    // Scheduled publishing runs every 5 minutes.
    if (String(controller?.cron ?? '') === '*/5 * * * *') {
      ctx.waitUntil(runScheduledVideoPublishing(env).then(() => undefined))
      return
    }

    // Rankings compute runs daily.
    if (String(controller?.cron ?? '') === '10 0 * * *') {
      ctx.waitUntil(runCmsRankingsDaily(env).then(() => undefined))
      return
    }
  },
}
