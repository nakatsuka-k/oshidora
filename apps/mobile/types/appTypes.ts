export type WorkDetailWork = {
  id: string
  title: string
  subtitle: string
  thumbnailUrl?: string | null
  tags: string[]
  rating: number
  reviews: number
  story: string
  episodes: Array<{
    id: string
    title: string
    priceCoin: number
    episodeNo?: number | null
    thumbnailUrl?: string | null
    streamVideoId?: string | null
    streamVideoIdClean?: string | null
    streamVideoIdSubtitled?: string | null
  }>
  staff: Array<{ role: string; name: string }>
}

export type ApiWorkDetailResponse = {
  item?: {
    id?: string
    title?: string
    description?: string
    thumbnailUrl?: string
    tags?: string[]
    published?: boolean
  }
  episodes?: Array<{
    id?: string
    title?: string
    priceCoin?: number
    episodeNo?: number | null
    thumbnailUrl?: string
    streamVideoId?: string
    streamVideoIdClean?: string
    streamVideoIdSubtitled?: string
    published?: boolean
    scheduledAt?: string | null
  }>
}

export type WorkKey = 'doutcall' | 'mysteryX' | 'romanceY' | 'comedyZ' | 'actionW'

export type Oshi = {
  id: string
  name: string
  created_at: string
}

export type ApprovedComment = {
  id: string
  author: string
  body: string
}
