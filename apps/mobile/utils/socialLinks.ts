export function normalizeUrl(input: string): string {
  const raw = String(input || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  // Allow users to paste without scheme.
  return `https://${raw}`
}

export type SocialServiceMeta = {
  label: string
  host: string
  iconText: string
}

export function detectSocialService(url: string): SocialServiceMeta {
  const normalized = normalizeUrl(url)
  try {
    const u = new URL(normalized)
    const host = String(u.hostname || '').toLowerCase().replace(/^www\./, '')

    const match = (h: string, ...domains: string[]) => domains.some((d) => h === d || h.endsWith(`.${d}`))

    if (match(host, 'x.com', 'twitter.com', 't.co')) return { label: 'X', host, iconText: 'X' }
    if (match(host, 'instagram.com')) return { label: 'Instagram', host, iconText: 'IG' }
    if (match(host, 'threads.net')) return { label: 'Threads', host, iconText: 'Th' }
    if (match(host, 'tiktok.com')) return { label: 'TikTok', host, iconText: 'TT' }
    if (match(host, 'youtube.com', 'youtu.be')) return { label: 'YouTube', host, iconText: 'YT' }
    if (match(host, 'line.me')) return { label: 'LINE', host, iconText: 'LINE' }
    if (match(host, 'facebook.com')) return { label: 'Facebook', host, iconText: 'f' }
    if (match(host, 'note.com')) return { label: 'note', host, iconText: 'n' }
    if (match(host, 'ameblo.jp')) return { label: 'Ameba', host, iconText: 'A' }
    if (match(host, 'linkedin.com')) return { label: 'LinkedIn', host, iconText: 'in' }
    if (match(host, 'github.com')) return { label: 'GitHub', host, iconText: 'GH' }

    return { label: host || 'リンク', host, iconText: 'LINK' }
  } catch {
    return { label: 'リンク', host: '', iconText: 'LINK' }
  }
}
