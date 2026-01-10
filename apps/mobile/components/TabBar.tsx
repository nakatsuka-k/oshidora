import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { THEME } from './theme'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type TabBarProps = {
  active: TabKey
  onPress?: (key: TabKey) => void
}

export function TabBar({ active, onPress }: TabBarProps) {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'home', label: 'ホーム' },
    { key: 'video', label: '作品' },
    { key: 'cast', label: 'キャスト' },
    { key: 'search', label: '検索' },
    { key: 'mypage', label: 'マイページ' },
  ]

  return (
    <View style={styles.root}>
      {tabs.map((t) => {
        const isActive = t.key === active
        const color = isActive ? THEME.text : THEME.textMuted
        return (
          <Pressable
            key={t.key}
            onPress={() => onPress?.(t.key)}
            style={styles.item}
            accessibilityRole="button"
          >
            <TabIcon tab={t.key} color={color} />
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>{t.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function TabIcon({ tab, color }: { tab: TabKey; color: string }) {
  // Minimal stroke icons (SVG) to match "SVG対応" requirement.
  // Avoids custom colors by using THEME-driven color passed in.
  switch (tab) {
    case 'home':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      )
    case 'video':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 7a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path
            d="M11 9.5 14.5 12 11 14.5V9.5Z"
            fill={color}
          />
        </Svg>
      )
    case 'cast':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Path
            d="M9.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
            stroke={color}
            strokeWidth={2}
          />
          <Path
            d="M17 11a3 3 0 1 0-2.5-5"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      )
    case 'search':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"
            stroke={color}
            strokeWidth={2}
          />
          <Path
            d="M21 21l-4.35-4.35"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      )
    case 'mypage':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Path
            d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
            stroke={color}
            strokeWidth={2}
          />
        </Svg>
      )
  }
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
    backgroundColor: THEME.card,
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    color: THEME.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  labelActive: {
    color: THEME.text,
  },
})
