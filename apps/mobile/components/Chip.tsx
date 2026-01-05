import { StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type ChipProps = {
  label: string
}

export function Chip({ label }: ChipProps) {
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
