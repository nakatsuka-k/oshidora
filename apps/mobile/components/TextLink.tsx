import type { StyleProp, TextStyle } from 'react-native'
import { Pressable, StyleSheet, Text } from 'react-native'
import { THEME } from './theme'

type TextLinkProps = {
  label: string
  onPress?: () => void
  color?: string
  style?: StyleProp<TextStyle>
}

export function TextLink({ label, onPress, color, style }: TextLinkProps) {
  return (
    <Pressable onPress={onPress}>
      <Text style={[styles.text, typeof color === 'string' ? { color } : null, style]}>{label}</Text>
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
