import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { THEME } from './theme'

type PaginationDotsProps = {
  count: number
  index: number
  onChange?: (index: number) => void
  style?: StyleProp<ViewStyle>
}

export function PaginationDots({ count, index, onChange, style }: PaginationDotsProps) {
  const safeCount = Math.max(0, Math.floor(count))
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, safeCount - 1)))

  if (safeCount <= 1) return null

  return (
    <View style={[styles.dots, style]}>
      {Array.from({ length: safeCount }).map((_, i) => (
        <Pressable
          key={i}
          onPress={() => onChange?.(i)}
          hitSlop={10}
          style={[styles.dot, i === safeIndex ? styles.dotActive : null]}
          accessibilityRole="button"
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.outline,
  },
  dotActive: {
    backgroundColor: THEME.accent,
  },
})
