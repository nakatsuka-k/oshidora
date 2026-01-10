import { StyleSheet, Text, View } from 'react-native'
import { NoticeBellButton, ScreenContainer, TabBar, THEME } from '../components'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type TabbedPlaceholderScreenProps = {
  title: string
  activeTab: TabKey
  onPressTab: (key: TabKey) => void
  onOpenNotice?: () => void
}

export function TabbedPlaceholderScreen({ title, activeTab, onPressTab, onOpenNotice }: TabbedPlaceholderScreenProps) {
  return (
    <ScreenContainer
      title={title}
      headerRight={onOpenNotice ? <NoticeBellButton onPress={onOpenNotice} /> : undefined}
      footer={<TabBar active={activeTab} onPress={onPressTab} />}
    >
      <View style={styles.root}>
        <View style={styles.body}>
          <Text style={styles.text}>未実装（モック）</Text>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: THEME.textMuted,
    fontSize: 12,
  },
})
