import { StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, TabBar, THEME } from '../components'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type TabbedPlaceholderScreenProps = {
  title: string
  activeTab: TabKey
  onPressTab: (key: TabKey) => void
}

export function TabbedPlaceholderScreen({ title, activeTab, onPressTab }: TabbedPlaceholderScreenProps) {
  return (
    <ScreenContainer footer={<TabBar active={activeTab} onPress={onPressTab} />}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>

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
  header: {
    paddingBottom: 8,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '800',
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
