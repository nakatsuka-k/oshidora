// IP allowlist for oshidra.com
const ALLOWED_IPS = [
  '223.135.200.51',
  '117.102.205.215',
  '133.232.96.225',
  '3.114.72.126',
]

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
  return s
}

function getClientIp(request: Request): string {
  const cf = request.headers.get('CF-Connecting-IP')
  if (cf) return normalizeIp(cf)
  const xff = request.headers.get('X-Forwarded-For')
  const first = splitXForwardedFor(xff)[0]
  if (first) return normalizeIp(first)
  return ''
}

// Pages project domain
const PAGES_URL = 'https://oshidra-web.pages.dev'

export default {
  async fetch(request: Request, _env: unknown): Promise<Response> {
    const clientIP = getClientIp(request)
    const isAllowed = !!clientIP && ALLOWED_IPS.includes(clientIP)

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
