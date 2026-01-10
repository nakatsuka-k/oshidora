import { Pressable, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type ChipProps = {
  label: string
  onPress?: () => void
  selected?: boolean
}

export function Chip({ label, onPress, selected }: ChipProps) {
  if (onPress) {
    return (
      <Pressable
        style={[styles.chip, selected ? styles.chipSelected : null]}
        onPress={onPress}
        accessibilityRole="button"
      >
        <Text style={[styles.text, selected ? styles.textSelected : null]}>{label}</Text>
      </Pressable>
    )
  }

  return (
    <View style={[styles.chip, selected ? styles.chipSelected : null]}>
      <Text style={[styles.text, selected ? styles.textSelected : null]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: THEME.card,
  },
  chipSelected: {
    borderColor: THEME.accent,
  },
  text: {
    color: THEME.text,
    fontSize: 12,
  },
  textSelected: {
    color: THEME.text,
    fontWeight: '800',
  },
})
