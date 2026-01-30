type Env = {
  DB: D1Database
  // Optional cache TTL (seconds) for allowlist reads.
  IP_ALLOWLIST_CACHE_TTL_SECONDS?: string
}

type AllowlistCache = { expiresAtMs: number; rules: string[] }
let allowlistCache: AllowlistCache | null = null

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
  // IPv6 in brackets: [::1]:1234
  if (s.startsWith('[')) {
    const end = s.indexOf(']')
    if (end > 0) return s.slice(1, end)
    return s
  }
  // IPv4 with port: 1.2.3.4:1234
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

function ipv4ToU32(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const n = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) return NaN
    return Number(p)
  })
  if (n.some((x) => !Number.isFinite(x) || x < 0 || x > 255)) return null
  // Use unsigned arithmetic.
  return (((n[0] << 24) | (n[1] << 16) | (n[2] << 8) | n[3]) >>> 0) as number
}

function ipv6ToBytes(ip: string): Uint8Array | null {
  const s = String(ip || '').trim().toLowerCase()
  if (!s) return null

  // Strip brackets.
  const raw = s.startsWith('[') ? s.slice(1, s.indexOf(']') > 0 ? s.indexOf(']') : s.length) : s
  if (!raw.includes(':')) return null

  const parts = raw.split('::')
  if (parts.length > 2) return null

  const left = parts[0] ? parts[0].split(':').filter(Boolean) : []
  const right = parts.length === 2 && parts[1] ? parts[1].split(':').filter(Boolean) : []

  const groups: number[] = []

  function pushGroupToken(tok: string): boolean {
    if (!tok) return true
    if (tok.includes('.')) {
      // IPv4-mapped tail
      const v4 = ipv4ToU32(tok)
      if (v4 == null) return false
      groups.push((v4 >>> 16) & 0xffff)
      groups.push(v4 & 0xffff)
      return true
    }
    if (!/^[0-9a-f]{1,4}$/.test(tok)) return false
    groups.push(parseInt(tok, 16))
    return true
  }

  for (const t of left) {
    if (!pushGroupToken(t)) return null
  }

  const rightGroups: number[] = []
  for (const t of right) {
    if (t.includes('.')) {
      const v4 = ipv4ToU32(t)
      if (v4 == null) return null
      rightGroups.push((v4 >>> 16) & 0xffff)
      rightGroups.push(v4 & 0xffff)
      continue
    }
    if (!/^[0-9a-f]{1,4}$/.test(t)) return null
    rightGroups.push(parseInt(t, 16))
  }

  if (parts.length === 2) {
    const zerosNeeded = 8 - (groups.length + rightGroups.length)
    if (zerosNeeded < 0) return null
    for (let i = 0; i < zerosNeeded; i++) groups.push(0)
    groups.push(...rightGroups)
  } else {
    groups.push(...rightGroups)
  }

  if (groups.length !== 8) return null

  const out = new Uint8Array(16)
  for (let i = 0; i < 8; i++) {
    const g = groups[i]
    out[i * 2] = (g >>> 8) & 0xff
    out[i * 2 + 1] = g & 0xff
  }
  return out
}

function matchesIpv6Cidr(clientIp: string, baseIp: string, prefix: number): boolean {
  const client = ipv6ToBytes(clientIp)
  const base = ipv6ToBytes(baseIp)
  if (!client || !base) return false
  if (prefix < 0 || prefix > 128) return false

  const wholeBytes = Math.floor(prefix / 8)
  const remBits = prefix % 8
  for (let i = 0; i < wholeBytes; i++) {
    if (client[i] !== base[i]) return false
  }
  if (remBits === 0) return true
  const mask = (0xff << (8 - remBits)) & 0xff
  return (client[wholeBytes] & mask) === (base[wholeBytes] & mask)
}

function matchesRule(clientIp: string, ruleRaw: string): boolean {
  const rule = String(ruleRaw || '').trim().toLowerCase()
  if (!rule) return false

  // Exact match (IPv4 or IPv6).
  if (!rule.includes('/')) {
    return clientIp === rule
  }

  // CIDR (IPv4)
  const m4 = rule.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3})\/(\d{1,2})$/)
  if (m4) {
    const baseIp = m4[1]
    const prefix = Number(m4[2])
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false

    const clientU32 = ipv4ToU32(clientIp)
    const baseU32 = ipv4ToU32(baseIp)
    if (clientU32 == null || baseU32 == null) return false

    const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0)
    return (clientU32 & mask) === (baseU32 & mask)
  }

  // CIDR (IPv6)
  const m6 = rule.match(/^([0-9a-f:.]+)\/(\d{1,3})$/)
  if (m6) {
    const baseIp = m6[1]
    const prefix = Number(m6[2])
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 128) return false
    return matchesIpv6Cidr(clientIp, baseIp, prefix)
  }

  return false
}

function allowlistCacheTtlMs(env: Env): number {
  const raw = String(env.IP_ALLOWLIST_CACHE_TTL_SECONDS ?? '').trim()
  const n = raw ? Number(raw) : 30
  if (!Number.isFinite(n) || n < 0) return 30_000
  return Math.min(Math.max(0, Math.floor(n * 1000)), 5 * 60_000)
}

async function loadAllowlistRules(env: Env): Promise<string[]> {
  const now = Date.now()
  if (allowlistCache && now < allowlistCache.expiresAtMs) return allowlistCache.rules

  const out = await env.DB.prepare(
    'SELECT rule FROM access_ip_allowlist WHERE enabled = 1 ORDER BY id ASC'
  ).all()
  const rules = (out.results ?? [])
    .map((r: any) => String(r?.rule ?? '').trim().toLowerCase())
    .filter(Boolean)

  allowlistCache = { expiresAtMs: now + allowlistCacheTtlMs(env), rules }
  return rules
}

// Pages project domain
const PAGES_URL = 'https://oshidra-web.pages.dev'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const clientIP = getClientIp(request)
    if (!clientIP) {
      return new Response(
        JSON.stringify({
          error: 'Access Denied',
          message: 'Unable to determine client IP address.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    let rules: string[] = []
    try {
      rules = await loadAllowlistRules(env)
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: 'Allowlist Unavailable',
          message: 'Failed to load IP allowlist from D1.',
          your_ip: clientIP,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const isAllowed = rules.some((r) => matchesRule(clientIP, r))

    if (!isAllowed) {
      return new Response(
        JSON.stringify({
          error: 'Access Denied',
          message: 'Your IP address is not authorized to access this resource.',
          your_ip: clientIP || 'unknown',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Forward to Pages
    const pagesBaseURL = new URL(PAGES_URL)
    const originalURL = new URL(request.url)
    const forwardURL = new URL(originalURL.pathname + originalURL.search, pagesBaseURL)

    const forwardHeaders = new Headers(request.headers)
    // Remove Host header to avoid conflicts
    forwardHeaders.delete('host')

    const proxiedRequest = new Request(forwardURL, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    })

    return fetch(proxiedRequest)
  },
}
