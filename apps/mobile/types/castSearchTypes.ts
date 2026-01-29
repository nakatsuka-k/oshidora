/**
 * Cast search types and utilities
 */

export type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

export type CastSearchScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
  onOpenResults: (keyword: string) => void
  onOpenCastRanking?: () => void
  onOpenNotice?: () => void
}

export type Cast = {
  id: string
  name: string
  role: string
  genres?: string[]
  thumbnailUrl?: string
}

export type CastResponse = { items: Cast[] }

export type HistoryItem = {
  type: 'name' | 'content'
  keyword: string
  targetId?: string
  savedAt: string
}

export type Work = {
  id: string
  title: string
  genres?: string[]
  participantIds?: string[]
  thumbnailUrl?: string
  episodeIds?: string[]
}

export const HISTORY_KEY = 'cast_search_history_v1'
export const HISTORY_MAX = 20

export function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function uniqueHistory(items: HistoryItem[]): HistoryItem[] {
  const seen = new Set<string>()
  const out: HistoryItem[] = []
  for (const it of items) {
    const key =
      it.type === 'content'
        ? `${it.type}:${String(it.targetId || '').trim() || normalize(it.keyword)}`
        : `${it.type}:${normalize(it.keyword)}`
    if (!it.keyword.trim()) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
    if (out.length >= HISTORY_MAX) break
  }
  return out
}
