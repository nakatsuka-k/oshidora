import { Pressable, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type CheckboxRowProps = {
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function CheckboxRow({ checked, onToggle, children }: CheckboxRowProps) {
  return (
    <Pressable onPress={onToggle} style={styles.row}>
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <View style={styles.content}>{children}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: {
    borderColor: THEME.accent,
  },
  check: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 14,
  },
  content: {
    flex: 1,
  },
})
