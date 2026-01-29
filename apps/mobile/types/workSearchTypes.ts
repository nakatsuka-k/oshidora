/**
 * Work search screen types and utilities
 */

export type TabKey = 'home' | 'video' | 'cast' | 'work' | 'search' | 'mypage'

export type WorkSearchScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  onOpenVideo: (id: string) => void
  onOpenNotice?: () => void
}

export type Work = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  priceCoin?: number
  thumbnailUrl?: string
}

export type WorkResponse = { items: Work[] }

export type HistoryItem = {
  type: 'title'
  keyword: string
  savedAt: string
}

export const HISTORY_KEY = 'work_search_history_v1'
export const HISTORY_MAX = 20

export function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function uniqueHistory(items: HistoryItem[]): HistoryItem[] {
  const seen = new Set<string>()
  const out: HistoryItem[] = []
  for (const it of items) {
    const key = `${it.type}:${normalize(it.keyword)}`
    if (!it.keyword.trim()) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
    if (out.length >= HISTORY_MAX) break
  }
  return out
}
