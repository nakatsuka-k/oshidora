/**
 * Video list screen types and utilities
 */

export type VideoListScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: 'home' | 'video' | 'cast' | 'search' | 'mypage') => void
  onOpenVideo: (id: string) => void
  onOpenNotice?: () => void
  tag?: string | null
  onChangeTag?: (tag: string | null) => void
}

export type Video = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  priceCoin?: number
  thumbnailUrl?: string
  tags?: string[]
}

export type Category = { id: string; name: string }

export type VideosResponse = { items: Video[]; nextCursor?: string | null }
export type CategoriesResponse = { items: Category[] }

export const PAGE_SIZE = 20

export function normalizeText(value: string) {
  return value.trim().toLowerCase()
}
