/**
 * Top screen types and utilities
 */

export type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

export type TopScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  onOpenVideo: (id: string) => void
  onOpenRanking: () => void
  onOpenCastProfile: (cast: { id: string; name: string }) => void
  onOpenFavorites: () => void
  onOpenNotice: () => void
}

export type VideoItem = {
  kind?: 'video'
  id: string
  title: string
  thumbnailUrl?: string
}

export type PickupLinkItem = {
  kind: 'link'
  id: string
  title: string
  thumbnailUrl?: string
  url: string
}

export type PickupItem = (VideoItem & { kind: 'video' }) | PickupLinkItem

export type CastItem = {
  id: string
  name: string
  thumbnailUrl?: string
}

export type TopData = {
  pickup: PickupItem[]
  recommended: VideoItem[]
  rankings: {
    byViews: VideoItem[]
    byRating: VideoItem[]
  }
  popularCasts: CastItem[]
}

export type NoticeListItem = {
  id: string
  publishedAt: string
}

export type NoticeListResponse = {
  items: NoticeListItem[]
}

export const EMPTY_TOP_DATA: TopData = {
  pickup: [],
  recommended: [],
  rankings: { byViews: [], byRating: [] },
  popularCasts: [],
}

export function parseNoticeTime(value: string): number {
  const trimmed = String(value || '').trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const millis = Date.parse(normalized)
  return Number.isFinite(millis) ? millis : 0
}
