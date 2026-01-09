// IP allowlist for oshidra.com
const ALLOWED_IPS = [
  '223.135.200.51',
  '117.102.205.215',
  '133.232.96.225',
  '3.114.72.126',
  '133.200.10.97',
  '192.168.20.123',
]

// Pages project domain
const PAGES_URL = 'https://oshidra-web.pages.dev'

export default {
  async fetch(request: Request, _env: unknown): Promise<Response> {
    // Get client IP
    const clientIP =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      'unknown'

    // Check if IP is in allowlist
    const isAllowed = ALLOWED_IPS.some((ip) => clientIP.includes(ip))

    if (!isAllowed) {
      return new Response(
        JSON.stringify({
          error: 'Access Denied',
          message: 'Your IP address is not authorized to access this resource.',
          your_ip: clientIP,
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
