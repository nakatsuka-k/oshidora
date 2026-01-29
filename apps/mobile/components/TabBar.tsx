import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { THEME } from './theme'

import IconHomeOff from '../assets/icon_home_off.svg'
import IconHomeOn from '../assets/icon_home_on.svg'
import IconVideoOff from '../assets/icon_video_off.svg'
import IconVideoOn from '../assets/icon_video_on.svg'
import IconUserOff from '../assets/icon_user_off.svg'
import IconUserOn from '../assets/icon_user_on.svg'
import IconCastOff from '../assets/icon_user_fav_off.svg'
import IconCastOn from '../assets/icon_user_fav_on.svg'

type TabKey = 'home' | 'video' | 'cast' | 'search' | 'mypage'

type TabBarProps = {
  active: TabKey
  onPress?: (key: TabKey) => void
}

export function TabBar({ active, onPress }: TabBarProps) {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'home', label: 'ホーム' },
    { key: 'video', label: '動画' },
    { key: 'cast', label: 'キャスト' },
    { key: 'mypage', label: 'マイページ' },
  ]

  return (
    <View style={styles.root}>
      {tabs.map((t) => {
        const isActive = t.key === active
        const color = isActive ? THEME.accent : THEME.textMuted
        return (
          <Pressable
            key={t.key}
            onPress={() => onPress?.(t.key)}
            style={styles.item}
            accessibilityRole="button"
          >
            <TabIcon tab={t.key} color={color} isActive={isActive} />
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>{t.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function TabIcon({ tab, color, isActive }: { tab: TabKey; color: string; isActive: boolean }) {
  // Minimal stroke icons (SVG) to match "SVG対応" requirement.
  // Avoids custom colors by using THEME-driven color passed in.
  switch (tab) {
    case 'home':
      return isActive ? <IconHomeOn width={24} height={24} /> : <IconHomeOff width={24} height={24} />
    case 'video':
      return isActive ? <IconVideoOn width={24} height={24} /> : <IconVideoOff width={24} height={24} />
    case 'cast':
      return isActive ? <IconCastOn width={24} height={24} /> : <IconCastOff width={24} height={24} />
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
      return isActive ? <IconUserOn width={24} height={24} /> : <IconUserOff width={24} height={24} />
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
    color: THEME.accent,
  },
})
