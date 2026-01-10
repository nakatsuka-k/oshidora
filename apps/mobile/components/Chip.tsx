import { Pressable, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type ChipProps = {
  label: string
  onPress?: () => void
}

export function Chip({ label, onPress }: ChipProps) {
  if (onPress) {
    return (
      <Pressable style={styles.chip} onPress={onPress} accessibilityRole="button">
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.chip}>
      <Text style={styles.text}>{label}</Text>
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
  text: {
    color: THEME.text,
    fontSize: 12,
  },
})
