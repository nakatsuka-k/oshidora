/**
 * Video search screen types and utilities
 */

export type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

export type VideoSearchScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  onOpenVideo: (id: string) => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
  onOpenNotice?: () => void
}

export type Video = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  priceCoin?: number
  thumbnailUrl?: string
}

export type Cast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

export type SearchResponse = {
  videos: Video[]
  casts: Cast[]
}

export function normalize(value: string) {
  return value.trim()
}
