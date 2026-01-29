/**
 * Cast ranking screen types
 */

export type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

export type CastRankingType = 'actors' | 'directors' | 'writers'

export type CastRankingItem = {
  rank: number
  cast: {
    id: string
    name: string
    role: string
    thumbnailUrl?: string
  }
}

export type CastRankingResponse = {
  asOf?: string
  items?: CastRankingItem[]
}

export type CastRankingScreenProps = {
  apiBaseUrl: string
  onBack: () => void
  onPressTab: (key: TabKey) => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
  onOpenNotice?: () => void
}
