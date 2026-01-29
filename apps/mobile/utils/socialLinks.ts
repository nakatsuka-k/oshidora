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

export type SocialIconKey =
  | 'x'
  | 'instagram'
  | 'threads'
  | 'tiktok'
  | 'youtube'
  | 'line'
  | 'facebook'
  | 'note'
  | 'linkedin'
  | 'discord'
  | 'spotify'
  | 'twitch'

export function detectSocialIconKey(url: string): SocialIconKey | null {
  const normalized = normalizeUrl(url)
  try {
    const u = new URL(normalized)
    const host = String(u.hostname || '').toLowerCase().replace(/^www\./, '')

    const match = (h: string, ...domains: string[]) => domains.some((d) => h === d || h.endsWith(`.${d}`))

    if (match(host, 'x.com', 'twitter.com', 't.co')) return 'x'
    if (match(host, 'instagram.com')) return 'instagram'
    if (match(host, 'threads.net')) return 'threads'
    if (match(host, 'tiktok.com')) return 'tiktok'
    if (match(host, 'youtube.com', 'youtu.be')) return 'youtube'
    if (match(host, 'line.me')) return 'line'
    if (match(host, 'facebook.com', 'fb.com')) return 'facebook'
    if (match(host, 'note.com')) return 'note'
    if (match(host, 'linkedin.com')) return 'linkedin'
    if (match(host, 'discord.com', 'discord.gg', 'discordapp.com')) return 'discord'
    if (match(host, 'spotify.com', 'open.spotify.com')) return 'spotify'
    if (match(host, 'twitch.tv')) return 'twitch'

    return null
  } catch {
    return null
  }
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
    if (match(host, 'discord.com', 'discord.gg', 'discordapp.com')) return { label: 'Discord', host, iconText: 'Dc' }
    if (match(host, 'spotify.com', 'open.spotify.com')) return { label: 'Spotify', host, iconText: 'Sp' }
    if (match(host, 'twitch.tv')) return { label: 'Twitch', host, iconText: 'Tw' }
    if (match(host, 'github.com')) return { label: 'GitHub', host, iconText: 'GH' }

    return { label: host || 'リンク', host, iconText: 'LINK' }
  } catch {
    return { label: 'リンク', host: '', iconText: 'LINK' }
  }
}
