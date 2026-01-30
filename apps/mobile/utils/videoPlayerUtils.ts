/**
 * Video subtitle parsing and handling utilities
 */

export type VttCue = {
  startMs: number
  endMs: number
  text: string
}

export function parseVttTimestampToMs(value: string): number {
  const v = String(value || '').trim()
  // Supports: HH:MM:SS.mmm or MM:SS.mmm
  const parts = v.split(':')
  if (parts.length < 2) return 0

  let hours = 0
  let minutes = 0
  let secPart = ''
  if (parts.length === 3) {
    hours = Number(parts[0])
    minutes = Number(parts[1])
    secPart = parts[2]
  } else {
    minutes = Number(parts[0])
    secPart = parts[1]
  }

  const [secStr, msStr = '0'] = secPart.split('.')
  const seconds = Number(secStr)
  const millis = Number(String(msStr).padEnd(3, '0').slice(0, 3))

  if (!Number.isFinite(hours)) hours = 0
  if (!Number.isFinite(minutes)) minutes = 0
  if (!Number.isFinite(seconds)) return 0

  return Math.max(0, Math.floor(hours * 3600_000 + minutes * 60_000 + seconds * 1000 + (Number.isFinite(millis) ? millis : 0)))
}

export function parseVttCues(vtt: string): VttCue[] {
  const raw = String(vtt || '')
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  const cues: VttCue[] = []
  let i = 0
  // Skip header
  if (lines[0]?.trim().toUpperCase().startsWith('WEBVTT')) i++

  const cleanText = (t: string) =>
    String(t || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()

  while (i < lines.length) {
    // Skip blank lines
    while (i < lines.length && !String(lines[i] ?? '').trim()) i++
    if (i >= lines.length) break

    // Optional cue identifier line
    const maybeTime = String(lines[i] ?? '').trim()
    const timeLine = maybeTime.includes('-->') ? maybeTime : String(lines[i + 1] ?? '').trim()
    const timeLineIndex = maybeTime.includes('-->') ? i : i + 1
    if (!timeLine.includes('-->')) {
      i++
      continue
    }

    const [startRaw, rest] = timeLine.split('-->').map((s) => s.trim())
    const endRaw = String(rest || '').split(/\s+/)[0]
    const startMs = parseVttTimestampToMs(startRaw)
    const endMs = parseVttTimestampToMs(endRaw)
    if (!(endMs > startMs)) {
      i = timeLineIndex + 1
      continue
    }

    i = timeLineIndex + 1
    const textLines: string[] = []
    while (i < lines.length && String(lines[i] ?? '').trim()) {
      const cleaned = cleanText(lines[i] ?? '')
      if (cleaned) textLines.push(cleaned)
      i++
    }
    const text = textLines.join('\n').trim()
    if (text) cues.push({ startMs, endMs, text })
  }

  return cues
}

export function findActiveCueText(cues: VttCue[], positionMs: number): string | null {
  if (!cues.length) return null
  const p = Math.max(0, Math.floor(positionMs))

  // Binary search for last cue with startMs <= p
  let lo = 0
  let hi = cues.length - 1
  let idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const s = cues[mid]?.startMs ?? 0
    if (s <= p) {
      idx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (idx < 0) return null
  const cue = cues[idx]
  if (p >= cue.startMs && p <= cue.endMs) return cue.text
  return null
}

export function deriveStreamSubtitleUrl(params: {
  playbackUrl: string
  fallbackVideoId: string
}): string {
  const raw = String(params.playbackUrl || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)

    // customer-*.cloudflarestream.com/{TOKEN}/...
    if (/\.cloudflarestream\.com$/i.test(u.hostname)) {
      const parts = u.pathname.split('/').filter(Boolean)
      const token = String(parts[0] || '').trim()
      if (!token) return ''
      return `${u.origin}/${encodeURIComponent(token)}/subtitles/default.vtt`
    }

    // videodelivery.net/{VIDEO_ID}/...
    if (/videodelivery\.net$/i.test(u.hostname)) {
      const parts = u.pathname.split('/').filter(Boolean)
      const videoId = String(parts[0] || params.fallbackVideoId || '').trim()
      if (!videoId) return ''

      const token = u.searchParams.get('token')
      const base = `${u.origin}/${encodeURIComponent(videoId)}/subtitles/default.vtt`
      if (token) return `${base}?token=${encodeURIComponent(token)}`
      return base
    }
  } catch {
    // ignore
  }
  return ''
}

// On web, directly fetching VTT from `videodelivery.net` can be blocked by CORS.
// This helper rewrites the VTT URL to our API proxy endpoint (which sets CORS).
export function proxyStreamSubtitleUrl(params: { proxyBaseUrl: string; subtitleUrl: string }): string {
  const apiBaseUrl = String(params.proxyBaseUrl || '').trim().replace(/\/+$/, '')
  const subtitleUrl = String(params.subtitleUrl || '').trim()
  if (!apiBaseUrl || !subtitleUrl) return subtitleUrl

  try {
    const u = new URL(subtitleUrl)
    const host = u.hostname.toLowerCase()
    const isVideoDelivery = host === 'videodelivery.net'
    const isCustomerStream = /\.cloudflarestream\.com$/i.test(host)
    if (!isVideoDelivery && !isCustomerStream) return subtitleUrl

    const proxy = new URL(`${apiBaseUrl}/v1/stream/subtitles-proxy`)
    proxy.searchParams.set('src', subtitleUrl)
    return proxy.toString()
  } catch {
    return subtitleUrl
  }
}

/**
 * Video playback and streaming utilities
 */

export type QualityValue = 'auto' | 'high' | 'saver'

export function applyQualityToPlaybackUrl(rawUrl: string, quality: QualityValue): string {
  // Cloudflare Stream manifests can be customized by `clientBandwidthHint`.
  // Only apply to HLS manifest URLs; other URLs (mp4/iframe) are left intact.
  try {
    const u = new URL(rawUrl)
    if (!u.pathname.toLowerCase().endsWith('.m3u8')) return rawUrl

    const hintMbps = quality === 'high' ? 8 : quality === 'saver' ? 1 : null
    if (hintMbps == null) u.searchParams.delete('clientBandwidthHint')
    else u.searchParams.set('clientBandwidthHint', String(hintMbps))
    return u.toString()
  } catch {
    return rawUrl
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number } | { ok: false; status: -1 }> {
  try {
    const resp = await fetch(url, init)
    if (!resp.ok) return { ok: false, status: resp.status }
    const json = (await resp.json().catch(() => null)) as T | null
    if (!json) return { ok: false, status: resp.status }
    return { ok: true, data: json }
  } catch {
    return { ok: false, status: -1 }
  }
}

export type PlaybackUrlResult = {
  url: string
  kind: 'iframe' | 'error' | 'signed-iframe' | 'signed-mp4' | 'signed-hls' | 'hls' | 'mp4' | 'unsigned-iframe' | 'unsigned-mp4' | 'unsigned-hls' | null
  token?: string
  error: string | null
}

export async function resolvePlaybackUrl(
  apiBaseUrl: string,
  videoId: string,
  authToken?: string,
  opts?: { preferMp4?: boolean; preferIframe?: boolean }
): Promise<PlaybackUrlResult> {
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined
  // ① HMAC-HS256 署名付きトークンを取得（推奨）
  const hmacSigned = await fetchJson<{
    token?: string
    hlsUrl?: string
    mp4Url?: string
    iframeUrl?: string
  }>(`${apiBaseUrl}/v1/stream/hmac-signed-playback/${encodeURIComponent(videoId)}`, { headers })

  // If the API explicitly says the video isn't ready yet (e.g. 503), do not fall back to unsigned URLs.
  // Those URLs would just fail and can cause repeated attempts.
  if (!hmacSigned.ok && hmacSigned.status === 503) {
    return { url: '', kind: 'error', error: 'no-url' }
  }

  if (hmacSigned.ok) {
    const mp4 = hmacSigned.data?.mp4Url
    const hls = hmacSigned.data?.hlsUrl
    const iframe = hmacSigned.data?.iframeUrl
    if (opts?.preferIframe && iframe) {
      return { url: iframe, kind: 'signed-iframe', token: hmacSigned.data.token, error: null }
    }
    if (opts?.preferMp4 && mp4) {
      return { url: mp4, kind: 'signed-mp4', token: hmacSigned.data.token, error: null }
    }
    if (hls) {
      return { url: hls, kind: 'signed-hls', token: hmacSigned.data.token, error: null }
    }
    if (mp4) {
      return { url: mp4, kind: 'signed-mp4', token: hmacSigned.data.token, error: null }
    }
    if (iframe) {
      return { url: iframe, kind: 'signed-iframe', token: hmacSigned.data.token, error: null }
    }
  }

  // ② Fallback: トークン無しでの再生（期限切れの可能性あり）
  const unsigned = await fetchJson<{
    hlsUrl?: string
    mp4Url?: string
    iframeUrl?: string
  }>(`${apiBaseUrl}/v1/stream/playback/${encodeURIComponent(videoId)}`, { headers })

  if (unsigned.ok) {
    const mp4 = unsigned.data?.mp4Url
    const hls = unsigned.data?.hlsUrl
    const iframe = unsigned.data?.iframeUrl
    if (opts?.preferIframe && iframe) {
      return { url: iframe, kind: 'unsigned-iframe', error: null }
    }
    if (opts?.preferMp4 && mp4) {
      return { url: mp4, kind: 'unsigned-mp4', error: null }
    }
    if (hls) {
      return { url: hls, kind: 'unsigned-hls', error: null }
    }
    if (mp4) {
      return { url: mp4, kind: 'unsigned-mp4', error: null }
    }
    if (iframe) {
      return { url: iframe, kind: 'unsigned-iframe', error: null }
    }
  }

  const err = hmacSigned.ok ? 'no-url' : `http_${hmacSigned.ok ? 'ok' : hmacSigned.status}`
  return { url: '', kind: 'error', error: err }
}
