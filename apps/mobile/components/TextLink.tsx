import { Pressable, StyleSheet, Text } from 'react-native'
import { THEME } from './theme'

type TextLinkProps = {
  label: string
  onPress?: () => void
}

export function TextLink({ label, onPress }: TextLinkProps) {
  return (
    <Pressable onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  text: {
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
})
