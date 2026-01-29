/**
 * Ranking screen types
 */

export type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

export type RankingScreenProps = {
  onBack: () => void
  onPressTab: (key: TabKey) => void
  onOpenVideo: (id: string) => void
}

export type RankingItem = {
  id: string
  title: string
  ratingAvg: number
  reviewCount: number
  description: string
  badge?: '新着' | 'おすすめ' | 'プレミア'
  thumbnailUrl?: string
}

export type RankingTab = 'views' | 'rating' | 'total'
