export type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

export type CastSearchResultScreenProps = {
  apiBaseUrl: string
  onPressTab: (key: TabKey) => void
  keyword: string
  onBack: () => void
  onOpenProfile: (cast: { id: string; name: string; role: string }) => void
  onOpenNotice?: () => void
}

export type Cast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

export type CastResponse = { items: Cast[] }
