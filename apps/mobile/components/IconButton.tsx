import { Pressable, StyleSheet, Text } from 'react-native'
import { THEME } from './theme'

type IconButtonProps = {
  label: string
  onPress?: () => void
}

export function IconButton({ label, onPress }: IconButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.root}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: THEME.accent,
    fontSize: 16,
    fontWeight: '700',
  },
})
