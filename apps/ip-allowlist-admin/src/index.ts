type Env = {
  DB: D1Database
  // Put via secret: `wrangler secret put ALLOWLIST_ADMIN_PASSWORD`
  ALLOWLIST_ADMIN_PASSWORD?: string
}

type Row = {
  id: number
  rule: string
  note: string | null
  enabled: number
  created_at: string
  updated_at: string
}

function splitXForwardedFor(xff: string | null): string[] {
  if (!xff) return []
  return xff
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeIp(value: string): string {
  const s = String(value || '').trim()
  if (!s) return ''
  if (s.startsWith('[')) {
    const end = s.indexOf(']')
    if (end > 0) return s.slice(1, end).toLowerCase()
    return s.toLowerCase()
  }
  const m = s.match(/^(\d+\.\d+\.\d+\.\d+)(?::\d+)?$/)
  if (m) return m[1]
  return s.toLowerCase()
}

function getClientIp(request: Request): string {
  const cf = request.headers.get('CF-Connecting-IP')
  if (cf) return normalizeIp(cf)
  const xff = request.headers.get('X-Forwarded-For')
  const first = splitXForwardedFor(xff)[0]
  if (first) return normalizeIp(first)
  return ''
}

const SESSION_COOKIE = 'allowlist_admin_session'

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  const b64 = btoa(s)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecodeToU8(s: string): Uint8Array | null {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  try {
    const raw = atob(b64 + pad)
    const out = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return new Uint8Array(sig)
}

function parseCookies(h: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  const s = String(h ?? '')
  if (!s) return out
  const parts = s.split(';')
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx < 0) continue
    const k = p.slice(0, idx).trim()
    const v = p.slice(idx + 1).trim()
    if (!k) continue
    out[k] = v
  }
  return out
}

function loginPage(params: { error?: string }): string {
  const err = String(params.error ?? '').trim()
  const msgHtml = err
    ? `<div style="padding:10px;margin:12px 0;border-radius:8px;background:#fff1f2;border:1px solid #fecdd3;color:#7f1d1d;">${escapeHtml(
        err
      )}</div>`
    : ''

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IP許可設定（管理者）ログイン</title>
  <style>
    body { background: #ffffff; }
    .card { box-sizing: border-box; }
    .btn-primary {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 46px;
    }
    /* Align the button with the input (not the label text). */
    .loginRow { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; justify-content: center; }
    .loginLabel { flex: 1; min-width: 260px; text-align: left; }
    .loginInput { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; box-sizing: border-box; }
    @media (max-width: 520px) {
      body { margin: 36px auto !important; padding: 0 14px !important; }
      .card { padding: 14px !important; }
      .btn-primary { width: 100%; }
    }
  </style>
</head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto;max-width:640px;margin:56px auto;padding:0 18px;">
  <div style="text-align:center;">
    <h1 style="margin:0 0 12px 0;">IP許可設定（管理者）</h1>
    <p style="color:#555;margin:0 0 6px 0;">この画面では、アプリにアクセスできるIPアドレスを制限・管理できます。</p>
    <p style="color:#555;margin:0 0 16px 0;">許可されたIPアドレスからのみアクセス可能です。</p>
  </div>
  ${msgHtml}
  <div class="card" style="background:#ffffff;border:1px solid #eee;border-radius:12px;padding:18px;max-width:520px;margin:0 auto;">
    <form method="POST" action="/login">
      <div class="loginRow">
        <label class="loginLabel">
          パスワード<br />
          <input class="loginInput" type="password" name="password" required />
        </label>
        <button type="submit" class="btn-primary" style="padding:12px 16px;border-radius:10px;border:1px solid #0b63ce;background:#1677ff;color:#fff;font-weight:600;">ログイン</button>
      </div>
      <div style="margin-top:10px;color:#777;font-size:12px;">※ 管理者のみが操作できます</div>
    </form>
  </div>
</body>
</html>`
}

function sessionTtlSeconds(): number {
  // 7 days
  return 60 * 60 * 24 * 7
}

async function makeSessionCookieValue(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + sessionTtlSeconds()
  const nonce = crypto.randomUUID()
  const payloadObj = { exp, nonce }
  const payload = JSON.stringify(payloadObj)
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload))
  const sig = await hmacSha256(secret, payloadB64)
  const sigB64 = base64UrlEncode(sig)
  return `${payloadB64}.${sigB64}`
}

async function isSessionValid(cookieValue: string, secret: string): Promise<boolean> {
  const v = String(cookieValue ?? '').trim()
  if (!v) return false
  const idx = v.lastIndexOf('.')
  if (idx < 0) return false
  const payloadB64 = v.slice(0, idx)
  const sigB64 = v.slice(idx + 1)
  if (!payloadB64 || !sigB64) return false

  const expectedSig = await hmacSha256(secret, payloadB64)
  const expectedSigB64 = base64UrlEncode(expectedSig)
  if (expectedSigB64 !== sigB64) return false

  const payloadU8 = base64UrlDecodeToU8(payloadB64)
  if (!payloadU8) return false
  let obj: any
  try {
    obj = JSON.parse(new TextDecoder().decode(payloadU8))
  } catch {
    return false
  }
  const exp = Number(obj?.exp ?? 0)
  if (!Number.isFinite(exp) || exp <= 0) return false
  const now = Math.floor(Date.now() / 1000)
  return now < exp
}

function setSessionCookieHeader(value: string): string {
  const maxAge = sessionTtlSeconds()
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
}

function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

function isValidRule(ruleRaw: string): boolean {
  const rule = String(ruleRaw || '').trim().toLowerCase()
  if (!rule) return false

  // CIDR (IPv4 / IPv6)
  if (rule.includes('/')) {
    const m4 = rule.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3})\/(\d{1,2})$/)
    if (m4) {
      const prefix = Number(m4[2])
      if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false
      const parts = m4[1].split('.').map((p) => Number(p))
      if (parts.length !== 4) return false
      if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false
      return true
    }

    const m6 = rule.match(/^([0-9a-f:]+)\/(\d{1,3})$/)
    if (m6) {
      const prefix = Number(m6[2])
      if (!Number.isFinite(prefix) || prefix < 0 || prefix > 128) return false
      return m6[1].includes(':')
    }

    return false
  }

  // Exact IPv4
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(rule)) {
    const parts = rule.split('.').map((p) => Number(p))
    return parts.length === 4 && !parts.some((n) => n < 0 || n > 255 || !Number.isFinite(n))
  }

  // Exact IPv6 (lenient)
  if (rule.includes(':')) return true

  return false
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlPage(params: {
  yourIp: string
  rows: Row[]
  message: { kind: 'ok' | 'err'; text: string } | null
}): string {
  const { yourIp, rows, message } = params

  const ipKind = yourIp ? (yourIp.includes(':') ? 'IPv6' : 'IPv4') : ''
  const reflectNoticeText =
    '⚠ 設定の反映には最大30秒ほどかかる場合があります。\n追加・削除後すぐにアクセスできない場合は、少し時間をおいてから再度お試しください。'
  const reflectNoticeHtml = `<div style="padding:12px 12px;margin:14px 0;border-radius:10px;background:#fffbe6;border:1px solid #fde68a;color:#854d0e;white-space:pre-line;">${escapeHtml(
    reflectNoticeText
  )}</div>`

  const msgHtml =
    message == null
      ? ''
      : `<div style="padding:10px;margin:12px 0;border-radius:8px;${
          message.kind === 'ok'
            ? 'background:#e8fff1;border:1px solid #a7f3c3;color:#064e3b;'
            : 'background:#fff1f2;border:1px solid #fecdd3;color:#7f1d1d;'
        }">${escapeHtml(message.text)}</div>`

  const rowsHtml = rows
    .map((r) => {
      const enabled = Number(r.enabled) === 1
      const statusLabel = enabled ? '有効' : '無効'
      const statusStyle =
        enabled
          ? 'display:inline-block;padding:2px 8px;border-radius:999px;background:#dcfce7;border:1px solid #86efac;color:#166534;font-weight:600;white-space:nowrap;word-break:keep-all;'
          : 'display:inline-block;padding:2px 8px;border-radius:999px;background:#f3f4f6;border:1px solid #e5e7eb;color:#374151;font-weight:600;white-space:nowrap;word-break:keep-all;'
      return `<tr>
  <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(String(r.id))}</td>
  <td style="padding:8px;border-bottom:1px solid #eee;font-family:ui-monospace, SFMono-Regular;">${escapeHtml(r.rule)}</td>
  <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.note ?? '')}</td>
  <td style="padding:8px;border-bottom:1px solid #eee;"><span style="${statusStyle}">${statusLabel}</span></td>
  <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.created_at)}</td>
  <td style="padding:8px;border-bottom:1px solid #eee;">
    <form method="POST" action="/toggle" style="display:inline;">
      <input type="hidden" name="id" value="${escapeHtml(String(r.id))}" />
      <input type="hidden" name="enabled" value="${enabled ? '0' : '1'}" />
      <button type="submit" style="padding:6px 10px;border-radius:8px;border:1px solid #ddd;background:#fff;">${enabled ? '無効化' : '有効化'}</button>
    </form>
    <form method="POST" action="/delete" style="display:inline;margin-left:6px;" onsubmit="return confirm('このIPを削除すると、アクセスできなくなる可能性があります。本当に削除しますか？');">
      <input type="hidden" name="id" value="${escapeHtml(String(r.id))}" />
      <button type="submit" style="padding:6px 10px;border-radius:8px;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;">削除</button>
    </form>
  </td>
</tr>`
    })
    .join('\n')

  const prefillRule = yourIp || ''

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IP Allowlist Admin</title>
  <style>
    .tableWrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .inputText { box-sizing: border-box; width: 360px; max-width: 100%; padding: 8px; }
    .inputNote { box-sizing: border-box; width: 260px; max-width: 100%; padding: 8px; }
    .btn { cursor: pointer; }
    .btn-copy { padding: 7px 10px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; }
    .btn-copy.is-ok { border-color: #86efac; background: #dcfce7; color: #166534; font-weight: 700; }
    @media (max-width: 520px) {
      body { margin: 18px auto !important; padding: 0 12px !important; }
      .headerRow { flex-direction: column; align-items: flex-start !important; }
      .inputText, .inputNote { width: 100% !important; }
      .addForm { display: grid !important; grid-template-columns: 1fr; gap: 10px !important; align-items: stretch !important; }
      .addForm label { width: 100%; }
      table { font-size: 12px; }
      th, td { padding: 6px !important; }
    }
  </style>
</head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto;max-width:980px;margin:24px auto;padding:0 16px;">
  <div class="headerRow" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
    <div>
      <h1 style="margin:0 0 6px 0;">IP許可設定（管理画面）</h1>
      <div style="color:#555;">この画面では、アプリにアクセスできるIPアドレスを制限・管理できます。</div>
    </div>
    <div style="margin-top:6px;"><a href="/logout">ログアウト</a></div>
  </div>

  <div style="margin-top:14px;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa;">
    <div style="color:#111827;font-weight:700;margin-bottom:6px;">現在アクセスしているあなたのIPアドレス：</div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <code id="your-ip" style="font-family:ui-monospace,SFMono-Regular;word-break:break-all;">${escapeHtml(
        yourIp || 'unknown'
      )}</code>
      ${
        yourIp
          ? `<button id="copy-btn" type="button" class="btn btn-copy" onclick="copyYourIp()">コピー</button>`
          : ''
      }
      ${
        yourIp
          ? `<form method="POST" action="/add" style="display:inline;margin:0;">
              <input type="hidden" name="rule" value="${escapeHtml(yourIp)}" />
              <input type="hidden" name="note" value="" />
              <button type="submit" class="btn" style="padding:7px 10px;border-radius:8px;border:1px solid #16a34a;background:#22c55e;color:#fff;font-weight:800;">このIPを許可に追加</button>
            </form>`
          : ''
      }
      ${ipKind ? `<span style="color:#6b7280;font-size:12px;">(${escapeHtml(ipKind)})</span>` : ''}
    </div>
    <div style="margin-top:10px;color:#6b7280;font-size:12px;">このIP（またはIPv6の場合はCIDR）を許可リストに追加すると、アクセスできるようになります。</div>
  </div>

  ${reflectNoticeHtml}

  ${msgHtml}
  ${message?.kind === 'ok' ? reflectNoticeHtml : ''}

  <h2 style="margin-top:24px;">IPアドレスを許可する</h2>
  <div style="color:#555;margin:6px 0 10px 0;white-space:pre-line;">許可したいIPアドレス、またはCIDR形式で入力してください。\n例）203.0.113.10 / 203.0.113.0/24</div>
  <form class="addForm" method="POST" action="/add" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
    <label>
      許可したいIP（またはCIDR）<br />
      <input class="inputText" name="rule" required placeholder="例: 203.0.113.10 / 203.0.113.0/24 / 2404:7a80:a61:5e00::/64" value="${escapeHtml(
        prefillRule
      )}" />
    </label>
    <label>
      メモ（任意）<br />
      <input class="inputNote" name="note" placeholder="自宅Wi-Fi / 会社 / VPN など" />
    </label>
    <button type="submit" class="btn" style="padding:9px 14px;border-radius:10px;border:1px solid #16a34a;background:#22c55e;color:#fff;font-weight:700;">追加</button>
  </form>

  <h2 style="margin-top:28px;">一覧</h2>
  <div class="tableWrap">
    <table style="width:100%;border-collapse:collapse;min-width:720px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">ID</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">許可IP</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">メモ</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">状態</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">登録日時</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="6" style="padding:12px;color:#777;">まだ登録がありません</td></tr>'}
      </tbody>
    </table>
  </div>

  <hr style="margin:28px 0;border:none;border-top:1px solid #eee;" />
  <p style="color:#666;font-size:12px;">※ 誤って削除・無効化するとアクセスできなくなる可能性があります。操作後は反映まで最大30秒ほどお待ちください。</p>

  <script>
    function setCopyBtnState(state) {
      var btn = document.getElementById('copy-btn');
      if (!btn) return;
      if (state === 'ok') {
        btn.textContent = 'コピーしました';
        btn.classList.add('is-ok');
        setTimeout(function () {
          btn.textContent = 'コピー';
          btn.classList.remove('is-ok');
        }, 1500);
      } else if (state === 'err') {
        btn.textContent = 'コピー失敗';
        setTimeout(function () {
          btn.textContent = 'コピー';
        }, 1500);
      }
    }

    function copyYourIp() {
      const el = document.getElementById('your-ip');
      const text = el ? (el.textContent || '').trim() : '';
      if (!text || text === 'unknown') return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          setCopyBtnState('ok');
        }).catch(function () {
          window.prompt('コピーして使用してください', text);
          setCopyBtnState('err');
        });
      } else {
        window.prompt('コピーして使用してください', text);
        setCopyBtnState('ok');
      }
    }
  </script>
</body>
</html>`
}

async function listRules(db: D1Database): Promise<Row[]> {
  const out = await db
    .prepare(
      'SELECT id, rule, note, enabled, created_at, updated_at FROM access_ip_allowlist ORDER BY enabled DESC, id DESC'
    )
    .all()
  return (out.results ?? []) as Row[]
}

function redirectToHome(params?: { ok?: string; err?: string }): Response {
  const u = new URL('https://local/')
  if (params?.ok) u.searchParams.set('ok', params.ok)
  if (params?.err) u.searchParams.set('err', params.err)
  return new Response(null, {
    status: 303,
    headers: { Location: u.pathname + u.search, 'Cache-Control': 'no-store' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const secret = String(env.ALLOWLIST_ADMIN_PASSWORD ?? '').trim()
    if (!secret) {
      return new Response('Server is not configured (missing ALLOWLIST_ADMIN_PASSWORD).', {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const url = new URL(request.url)
    const path = url.pathname

    // Ensure no caching.
    const noStoreHeaders = { 'Cache-Control': 'no-store' }

    // Login / logout (password-only)
    if (request.method === 'GET' && path === '/login') {
      const err = String(url.searchParams.get('err') ?? '').trim()
      return new Response(loginPage({ error: err || undefined }), {
        headers: { ...noStoreHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (request.method === 'POST' && path === '/login') {
      const fd = await request.formData()
      const pass = String(fd.get('password') ?? '')
      if (pass !== secret) {
        const u = new URL(url.toString())
        u.pathname = '/login'
        u.search = ''
        u.searchParams.set('err', 'パスワードが違います。入力内容をご確認ください。')
        return new Response(null, { status: 303, headers: { ...noStoreHeaders, Location: u.pathname + u.search } })
      }

      const cookieValue = await makeSessionCookieValue(secret)
      return new Response(null, {
        status: 303,
        headers: {
          ...noStoreHeaders,
          'Set-Cookie': setSessionCookieHeader(cookieValue),
          Location: '/',
        },
      })
    }

    if (request.method === 'GET' && path === '/logout') {
      return new Response(null, {
        status: 303,
        headers: {
          ...noStoreHeaders,
          'Set-Cookie': clearSessionCookieHeader(),
          Location: '/login',
        },
      })
    }

    // Require session for everything else.
    const cookies = parseCookies(request.headers.get('Cookie'))
    const session = cookies[SESSION_COOKIE] || ''
    const okSession = await isSessionValid(session, secret)
    if (!okSession) {
      return new Response(null, { status: 303, headers: { ...noStoreHeaders, Location: '/login' } })
    }

    if (request.method === 'GET' && path === '/') {
      const yourIp = getClientIp(request)
      let rows: Row[] = []
      try {
        rows = await listRules(env.DB)
      } catch (e) {
        const msg = String((e as any)?.message ?? e).slice(0, 400)
        return new Response(`DB error: ${msg}`, { status: 500, headers: noStoreHeaders })
      }

      const ok = String(url.searchParams.get('ok') ?? '').trim()
      const err = String(url.searchParams.get('err') ?? '').trim()
      const message = ok
        ? ({ kind: 'ok', text: ok } as const)
        : err
          ? ({ kind: 'err', text: err } as const)
          : null

      return new Response(htmlPage({ yourIp, rows, message }), {
        headers: { ...noStoreHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (request.method === 'POST' && path === '/add') {
      const fd = await request.formData()
      const rule = String(fd.get('rule') ?? '').trim()
      const note = String(fd.get('note') ?? '').trim()

      if (!isValidRule(rule)) return redirectToHome({ err: 'IPの追加に失敗しました。\n入力形式をご確認ください。' })

      try {
        const now = new Date().toISOString()
        await env.DB.prepare(
          'INSERT OR IGNORE INTO access_ip_allowlist (rule, note, enabled, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
        )
          .bind(rule.toLowerCase(), note || null, now, now)
          .run()
      } catch (e) {
        return redirectToHome({ err: 'IPの追加に失敗しました。\n入力形式をご確認ください。' })
      }

      return redirectToHome({ ok: 'IPアドレスを追加しました。\n※ 反映まで最大30秒ほどかかる場合があります。' })
    }

    if (request.method === 'POST' && path === '/toggle') {
      const fd = await request.formData()
      const id = Number(fd.get('id') ?? NaN)
      const enabled = Number(fd.get('enabled') ?? NaN)
      if (!Number.isFinite(id) || !Number.isFinite(enabled) || (enabled !== 0 && enabled !== 1)) {
        return redirectToHome({ err: 'invalid toggle params' })
      }

      try {
        const now = new Date().toISOString()
        await env.DB.prepare('UPDATE access_ip_allowlist SET enabled = ?, updated_at = ? WHERE id = ?')
          .bind(enabled, now, id)
          .run()
      } catch {
        return redirectToHome({ err: '状態の更新に失敗しました。\n時間をおいて再度お試しください。' })
      }

      return redirectToHome({ ok: '状態を更新しました。\n※ 反映まで最大30秒ほどかかる場合があります。' })
    }

    if (request.method === 'POST' && path === '/delete') {
      const fd = await request.formData()
      const id = Number(fd.get('id') ?? NaN)
      if (!Number.isFinite(id)) return redirectToHome({ err: 'invalid delete params' })

      try {
        await env.DB.prepare('DELETE FROM access_ip_allowlist WHERE id = ?').bind(id).run()
      } catch {
        return redirectToHome({ err: '削除に失敗しました。\n時間をおいて再度お試しください。' })
      }

      return redirectToHome({ ok: '削除しました。\n※ 反映まで最大30秒ほどかかる場合があります。' })
    }

    return new Response('Not Found', { status: 404, headers: noStoreHeaders })
  },
}
