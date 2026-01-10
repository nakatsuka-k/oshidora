import { getString, setString } from './storage'

export type WatchHistoryKind = 'ショート' | '映画' | 'エピソード'
export type WatchHistoryStatus = '視聴中' | '視聴済み'

export type WatchHistoryItem = {
  id: string
  contentId: string
  title: string
  kind: WatchHistoryKind
  durationSeconds: number
  thumbnailUrl?: string
  lastPlayedAt: number
  status?: WatchHistoryStatus
  episodeLabel?: string
}

const BASE_KEY = 'video_watch_history_v1'

function makeKey(userKey: string) {
  const safe = String(userKey ?? '').trim().toLowerCase() || 'default'
  return `${BASE_KEY}:${safe}`
}

export async function loadWatchHistory(userKey: string): Promise<WatchHistoryItem[]> {
  try {
    const raw = await getString(makeKey(userKey))
    if (!raw) return []
    const json = JSON.parse(raw) as unknown
    if (!Array.isArray(json)) return []

    const items = json
      .map((v) => (v && typeof v === 'object' ? (v as any) : null))
      .filter(Boolean)
      .map((v) => ({
        id: String(v.id ?? ''),
        contentId: String(v.contentId ?? ''),
        title: String(v.title ?? ''),
        kind:
          v.kind === 'ショート' || v.kind === '映画' || v.kind === 'エピソード'
            ? (v.kind as WatchHistoryKind)
            : ('映画' as WatchHistoryKind),
        durationSeconds: Number.isFinite(v.durationSeconds) ? Number(v.durationSeconds) : 0,
        thumbnailUrl: typeof v.thumbnailUrl === 'string' ? v.thumbnailUrl : undefined,
        lastPlayedAt: Number.isFinite(v.lastPlayedAt) ? Number(v.lastPlayedAt) : 0,
        status: v.status === '視聴中' || v.status === '視聴済み' ? (v.status as WatchHistoryStatus) : undefined,
        episodeLabel: typeof v.episodeLabel === 'string' ? v.episodeLabel : undefined,
      }))
      .filter((v) => v.id && v.contentId)

    items.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
    return items.slice(0, 20)
  } catch {
    return []
  }
}

export async function saveWatchHistory(userKey: string, items: WatchHistoryItem[]): Promise<void> {
  const cleaned = [...items]
    .filter((v) => v && v.id && v.contentId)
    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
    .slice(0, 20)

  await setString(makeKey(userKey), JSON.stringify(cleaned))
}

export async function upsertWatchHistory(userKey: string, item: WatchHistoryItem): Promise<WatchHistoryItem[]> {
  const prev = await loadWatchHistory(userKey)
  const withoutSame = prev.filter((x) => x.contentId !== item.contentId)
  const next = [item, ...withoutSame]
  await saveWatchHistory(userKey, next)
  return next
}

export async function removeWatchHistoryItem(userKey: string, id: string): Promise<WatchHistoryItem[]> {
  const prev = await loadWatchHistory(userKey)
  const next = prev.filter((x) => x.id !== id)
  await saveWatchHistory(userKey, next)
  return next
}

export async function clearWatchHistory(userKey: string): Promise<void> {
  await setString(makeKey(userKey), JSON.stringify([]))
}
