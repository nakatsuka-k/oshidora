import { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type IconButtonProps = {
  label: string
  onPress?: () => void
  disabled?: boolean
  children?: ReactNode
}

export function IconButton({ label, onPress, disabled, children }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.root, disabled ? styles.disabled : null]}
    >
      {children ? (
        <View style={styles.iconWrap}>{children}</View>
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
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
  disabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: THEME.accent,
    fontSize: 16,
    fontWeight: '700',
  },
})
