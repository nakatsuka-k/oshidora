export type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

export type TabbedPlaceholderScreenProps = {
  title: string
  activeTab: TabKey
  onPressTab: (key: TabKey) => void
  onOpenNotice?: () => void
}
