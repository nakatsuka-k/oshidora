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

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Mock'],
    maxAge: 86400,
  })
)

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
    : `#/password-reset?token=${encodeURIComponent(tokenRaw)}`

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
    rows = await d1All(db, 'SELECT id, name, enabled, created_at, updated_at FROM categories ORDER BY name ASC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    enabled: Number(r.enabled ?? 0) === 1,
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
    const row = await d1First(db, 'SELECT id, name, enabled, created_at, updated_at FROM categories WHERE id = ? LIMIT 1', [id])
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

app.post('/cms/categories', async (c) => {
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
  const id = uuidOrFallback('cat')
  try {
    await db.prepare('INSERT INTO categories (id, name, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, name, enabled, createdAt, createdAt).run()
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

  type Body = { name?: unknown; enabled?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = body.name === undefined ? null : clampText(body.name, 80)
  const enabled = body.enabled === undefined ? null : parseBool01(body.enabled)
  const updatedAt = nowIso()
  try {
    await db.prepare('UPDATE categories SET name = COALESCE(?, name), enabled = COALESCE(?, enabled), updated_at = ? WHERE id = ?').bind(name, enabled, updatedAt, id).run()
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
    rows = await d1All(db, 'SELECT id, name, created_at, updated_at FROM tags ORDER BY name ASC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
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
    const row = await d1First(db, 'SELECT id, name, created_at, updated_at FROM tags WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        name: String((row as any).name ?? ''),
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
    return c.json({
      items: [
        { rank: 1, entityId: 'X1', label: `${type.toUpperCase()} 1`, value: 100 },
        { rank: 2, entityId: 'X2', label: `${type.toUpperCase()} 2`, value: 80 },
        { rank: 3, entityId: 'X3', label: `${type.toUpperCase()} 3`, value: 60 },
      ],
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
    return c.json({
      items: rows.map((r: any) => ({
        rank: Number(r.rank ?? 0),
        entityId: String(r.entity_id ?? ''),
        label: String(r.label ?? ''),
        value: Number(r.value ?? 0),
      })),
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
  type Body = { name?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = clampText(body.name, 80)
  if (!name) return c.json({ error: 'name is required' }, 400)
  const createdAt = nowIso()
  const id = uuidOrFallback('tag')
  try {
    await db.prepare('INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(id, name, createdAt, createdAt).run()
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
  type Body = { name?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = body.name === undefined ? null : clampText(body.name, 80)
  const updatedAt = nowIso()
  try {
    await db.prepare('UPDATE tags SET name = COALESCE(?, name), updated_at = ? WHERE id = ?').bind(name, updatedAt, id).run()
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
      `SELECT id, subject, body, sent_at, status, push,
              tags, mail_enabled, mail_format, mail_sent_at, push_title, push_body, push_sent_at,
              created_at, updated_at
       FROM notices
       ORDER BY (sent_at = '') ASC, sent_at DESC, created_at DESC`
    )
    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        subject: String(r.subject ?? ''),
        body: String(r.body ?? ''),
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
        'INSERT INTO notices (id, subject, body, sent_at, status, push, tags, mail_enabled, mail_format, mail_text, mail_html, mail_sent_at, push_title, push_body, push_sent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, subject, text, sentAt, status, push, tags, mailEnabled, mailFormat, mailText, mailHtml, '', pushTitle, pushBody, '', now, now)
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

  if (isMockRequest(c) || !c.env.DB) {
    return c.json({
      items: [
        { id: 'U0001', email: 'usera@example.com', emailVerified: true, phone: '', phoneVerified: false, createdAt: '2026-01-10T00:00:00.000Z' },
        { id: 'U0002', email: 'castb@example.com', emailVerified: false, phone: '', phoneVerified: false, createdAt: '2026-01-09T00:00:00.000Z' },
      ].filter((u) => (!q ? true : normalizeQuery(u.email).includes(q))),
    })
  }

  const db = c.env.DB as D1Database
  try {
    const rows = q
      ? await d1All(
          db,
          `SELECT id, email, email_verified, phone, phone_verified, created_at, updated_at
           FROM users
           WHERE lower(email) LIKE ?
           ORDER BY created_at DESC
           LIMIT 200`,
          [`%${q}%`]
        )
      : await d1All(
          db,
          `SELECT id, email, email_verified, phone, phone_verified, created_at, updated_at
           FROM users
           ORDER BY created_at DESC
           LIMIT 200`
        )

    return c.json({
      items: rows.map((r: any) => ({
        id: String(r.id ?? ''),
        email: String(r.email ?? ''),
        emailVerified: Number(r.email_verified ?? 0) === 1,
        phone: r.phone === null || r.phone === undefined ? '' : String(r.phone ?? ''),
        phoneVerified: Number(r.phone_verified ?? 0) === 1,
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
    return c.json({ item: { id, email: 'user@example.com', emailVerified: true, phone: '', phoneVerified: false, createdAt: '', updatedAt: '' } })
  }

  const db = c.env.DB as D1Database
  try {
    const row = await d1First(db, 'SELECT id, email, email_verified, phone, phone_verified, created_at, updated_at FROM users WHERE id = ? LIMIT 1', [id])
    if (!row) return c.json({ error: 'not_found' }, 404)
    return c.json({
      item: {
        id: String((row as any).id ?? ''),
        email: String((row as any).email ?? ''),
        emailVerified: Number((row as any).email_verified ?? 0) === 1,
        phone: (row as any).phone === null || (row as any).phone === undefined ? '' : String((row as any).phone ?? ''),
        phoneVerified: Number((row as any).phone_verified ?? 0) === 1,
        createdAt: String((row as any).created_at ?? ''),
        updatedAt: String((row as any).updated_at ?? ''),
      },
    })
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
})

// Comments moderation (CMS)
app.get('/cms/comments', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)

  const status = String(c.req.query('status') ?? '').trim()

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

// Casts
app.get('/cms/casts', async (c) => {
  const admin = await requireCmsAdmin(c)
  if (!admin.ok) return c.json({ error: admin.error }, admin.status)
  if (!c.env.DB) return c.json({ error: 'DB is not configured' }, 500)
  const db = c.env.DB as D1Database

  let rows: any[] = []
  try {
    rows = await d1All(db, 'SELECT id, name, role, thumbnail_url, created_at, updated_at FROM casts ORDER BY name ASC')
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }

  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    role: String(r.role ?? ''),
    thumbnailUrl: String(r.thumbnail_url ?? ''),
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
    row = await d1First(db, 'SELECT id, name, role, thumbnail_url, created_at, updated_at FROM casts WHERE id = ?', [id])
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

  type Body = { name?: unknown; role?: unknown; thumbnailUrl?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = clampText(body.name, 120)
  const role = clampText(body.role, 80)
  const thumbnailUrl = clampText(body.thumbnailUrl, 500)
  if (!name) return c.json({ error: 'name is required' }, 400)

  const createdAt = nowIso()
  const id = uuidOrFallback('cast')
  try {
    await db
      .prepare('INSERT INTO casts (id, name, role, thumbnail_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, name, role, thumbnailUrl, createdAt, createdAt)
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

  type Body = { name?: unknown; role?: unknown; thumbnailUrl?: unknown }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const name = body.name === undefined ? null : clampText(body.name, 120)
  const role = body.role === undefined ? null : clampText(body.role, 80)
  const thumbnailUrl = body.thumbnailUrl === undefined ? null : clampText(body.thumbnailUrl, 500)
  const updatedAt = nowIso()
  try {
    await db
      .prepare('UPDATE casts SET name = COALESCE(?, name), role = COALESCE(?, role), thumbnail_url = COALESCE(?, thumbnail_url), updated_at = ? WHERE id = ?')
      .bind(name, role, thumbnailUrl, updatedAt, id)
      .run()
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true })
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

  let rows: any[] = []
  try {
    rows = await d1All(
      db,
      'SELECT v.id, v.work_id, w.title AS work_title, v.title, v.description, v.stream_video_id, v.thumbnail_url, v.published, v.scheduled_at, v.created_at, v.updated_at FROM videos v LEFT JOIN works w ON w.id = v.work_id ORDER BY v.created_at DESC'
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
    thumbnailUrl: String(r.thumbnail_url ?? ''),
    published: Number(r.published ?? 0) === 1,
    scheduledAt: r.scheduled_at === null || r.scheduled_at === undefined ? null : String(r.scheduled_at ?? ''),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }))
  return c.json({ items })
})

app.get('/cms/videos/:id', async (c) => {
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
      'SELECT v.id, v.work_id, w.title AS work_title, v.title, v.description, v.stream_video_id, v.thumbnail_url, v.published, v.scheduled_at, v.created_at, v.updated_at FROM videos v LEFT JOIN works w ON w.id = v.work_id WHERE v.id = ?',
      [id]
    )
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  if (!row) return c.json({ error: 'not_found' }, 404)

  const categoryIds = (await d1All(db, 'SELECT category_id FROM video_categories WHERE video_id = ? ORDER BY sort_order ASC', [id])).map((r) => String(r.category_id ?? '')).filter(Boolean)
  const tagIds = (await d1All(db, 'SELECT tag_id FROM video_tags WHERE video_id = ? ORDER BY created_at ASC', [id])).map((r) => String(r.tag_id ?? '')).filter(Boolean)
  const castIds = (await d1All(db, 'SELECT cast_id FROM video_casts WHERE video_id = ? ORDER BY sort_order ASC', [id])).map((r) => String(r.cast_id ?? '')).filter(Boolean)

  return c.json({
    item: {
      id: String(row.id ?? ''),
      workId: String(row.work_id ?? ''),
      workTitle: String(row.work_title ?? ''),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      streamVideoId: String(row.stream_video_id ?? ''),
      thumbnailUrl: String(row.thumbnail_url ?? ''),
      published: Number(row.published ?? 0) === 1,
      scheduledAt: row.scheduled_at === null || row.scheduled_at === undefined ? null : String(row.scheduled_at ?? ''),
      createdAt: String(row.created_at ?? ''),
      updatedAt: String(row.updated_at ?? ''),
      categoryIds,
      tagIds,
      castIds,
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
    thumbnailUrl?: unknown
    published?: unknown
    scheduledAt?: unknown
    categoryIds?: unknown
    tagIds?: unknown
    castIds?: unknown
  }
  const body = (await c.req.json().catch(() => ({}))) as Body
  const workId = String(body.workId ?? '').trim()
  const title = clampText(body.title, 200)
  const description = clampText(body.description, 5000)
  const streamVideoId = clampText(body.streamVideoId, 120)
  const thumbnailUrl = clampText(body.thumbnailUrl, 500)
  const published = body.published === undefined ? 0 : parseBool01(body.published)
  const scheduledAtRaw = body.scheduledAt === undefined ? undefined : String(body.scheduledAt ?? '').trim()
  const scheduledAt = scheduledAtRaw === undefined ? null : scheduledAtRaw || null
  const categoryIds = parseIdList(body.categoryIds)
  const tagIds = parseIdList(body.tagIds)
  const castIds = parseIdList(body.castIds)

  if (!workId) return c.json({ error: 'workId is required' }, 400)
  if (!title) return c.json({ error: 'title is required' }, 400)

  const createdAt = nowIso()
  const id = uuidOrFallback('vid')
  try {
    await db
      .prepare('INSERT INTO videos (id, work_id, title, description, stream_video_id, thumbnail_url, published, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, workId, title, description, streamVideoId, thumbnailUrl, published, scheduledAt, createdAt, createdAt)
      .run()

    await replaceLinks(db, { table: 'video_categories', leftKey: 'video_id', leftId: id, rightKey: 'category_id', rightIds: categoryIds })
    await replaceLinks(db, { table: 'video_tags', leftKey: 'video_id', leftId: id, rightKey: 'tag_id', rightIds: tagIds })
    await replaceCastLinks(db, { table: 'video_casts', leftKey: 'video_id', leftId: id, castIds })
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
    thumbnailUrl?: unknown
    published?: unknown
    scheduledAt?: unknown
    categoryIds?: unknown
    tagIds?: unknown
    castIds?: unknown
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

  sets.push('updated_at = ?')
  binds.push(updatedAt)

  try {
    await db.prepare(`UPDATE videos SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run()

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
  } catch (err) {
    if (d1LikelyNotMigratedError(err)) return jsonD1SetupError(c, err)
    throw err
  }
  return c.json({ ok: true })
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

// HMAC-HS256 署名付き Stream URL エンドポイント（簡易版）
// Cloudflare Stream の Signed URL が必須の場合はこちらを使用
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

  const signingSecret = c.env.CLOUDFLARE_STREAM_SIGNING_SECRET
  if (!signingSecret) {
    return c.json(
      {
        error: 'Cloudflare Stream HMAC signing is not configured',
        required: ['CLOUDFLARE_STREAM_SIGNING_SECRET'],
        note: 'Set CLOUDFLARE_STREAM_SIGNING_SECRET to enable signed playback URLs.',
      },
      500
    )
  }

  try {
    // JWT 署名トークンを生成（有効期限：24時間）
    const expiresInSeconds = 24 * 60 * 60
    const payload = {
      sub: videoId,
      kid: 'default',
    }
    const token = await makeJwtHs256(signingSecret, payload, expiresInSeconds)
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds

    // トークンパラメータ付きの再生URL
    const tokenParam = `token=${encodeURIComponent(token)}`

    return c.json({
      videoId,
      token,
      expiresAt: new Date(exp * 1000).toISOString(),
      expiresAtUnix: exp,
      iframeUrl: `https://iframe.videodelivery.net/${videoId}?${tokenParam}`,
      hlsUrl: `https://videodelivery.net/${videoId}/manifest/video.m3u8?${tokenParam}`,
      dashUrl: `https://videodelivery.net/${videoId}/manifest/video.mpd?${tokenParam}`,
      mp4Url: `https://videodelivery.net/${videoId}/downloads/default.mp4?${tokenParam}`,
    })
  } catch (err) {
    console.error('HMAC signing error:', err)
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

app.get('/v1/top', async (c) => {
  if (isMockRequest(c) || !c.env.DB) {
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
  }

  const db = c.env.DB as D1Database

  const toVideoItem = (r: any) => ({
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    thumbnailUrl: String(r.thumbnail_url ?? ''),
  })

  try {
    const pickupRows = await d1All(
      db,
      `
      SELECT v.id, v.title, v.thumbnail_url
      FROM cms_featured_videos fv
      JOIN videos v ON v.id = fv.video_id
      WHERE fv.slot = ? AND v.published = 1
      ORDER BY fv.sort_order ASC, fv.created_at ASC
      LIMIT 6
    `,
      ['pickup']
    )

    const recommendRows = await d1All(
      db,
      `
      SELECT v.id, v.title, v.thumbnail_url
      FROM cms_featured_videos fv
      JOIN videos v ON v.id = fv.video_id
      WHERE fv.slot = ? AND v.published = 1
      ORDER BY fv.sort_order ASC, fv.created_at ASC
      LIMIT 6
    `,
      ['recommend']
    )

    const latestRows = await d1All(
      db,
      `
      SELECT id, title, thumbnail_url
      FROM videos
      WHERE published = 1
      ORDER BY created_at DESC
      LIMIT 5
    `
    )

    const pickup = pickupRows.length ? pickupRows.map(toVideoItem) : latestRows.slice(0, 6).map(toVideoItem)
    const recommended = recommendRows.length ? recommendRows.map(toVideoItem) : latestRows.slice(0, 6).map(toVideoItem)
    const rankings = latestRows.map(toVideoItem)

    return c.json({
      pickup,
      recommended,
      rankings: {
        byViews: rankings,
        byRating: rankings,
        overall: rankings,
      },
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
      SELECT id, subject, body, sent_at, status, created_at
      FROM notices
      WHERE (sent_at IS NOT NULL AND sent_at != '')
        AND (status IS NULL OR status != 'draft')
      ORDER BY sent_at DESC, created_at DESC
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
          publishedAt: String(r.sent_at ?? r.created_at ?? ''),
          excerpt,
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
      SELECT id, subject, body, sent_at, status, created_at
      FROM notices
      WHERE id = ?
      LIMIT 1
    `,
      [id]
    )

    if (!row) return c.json({ item: null })

    return c.json({
      item: {
        id: String(row.id ?? ''),
        title: String(row.subject ?? ''),
        publishedAt: String(row.sent_at ?? row.created_at ?? ''),
        bodyHtml: String(row.body ?? ''),
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
  if (isMockRequest(c) || !c.env.DB) {
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

  if (isMockRequest(c) || !c.env.DB) {
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

  const where: string[] = ['w.published = 1']
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
      'SELECT id, email_verified, phone, phone_verified, password_hash, password_salt FROM users WHERE email = ?'
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
  const stage = hasVerifiedPhone ? 'full' : 'needs_sms'

  let token = ''
  try {
    token = await makeJwtHs256(secret, { userId: String(user.id), stage }, 60 * 30)
  } catch (err) {
    console.error('login/start: failed to sign jwt', err)
    return c.json({ error: 'internal_sign_jwt', message: String((err as any)?.message ?? err).slice(0, 180) }, 500)
  }
  const phoneMasked = user.phone ? String(user.phone).replace(/.(?=.{4})/g, '*') : null
  return c.json({ ok: true, token, stage, phoneMasked, phoneRequired: !hasVerifiedPhone })
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
