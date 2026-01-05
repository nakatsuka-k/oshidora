import { useCallback, useMemo, useRef } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { digitsOnly } from '../utils/validators'
import { THEME } from './theme'

type PinInputProps = {
  length: number
  value: string
  onChange: (next: string) => void
  error?: boolean
}

export function PinInput({ length, value, onChange, error }: PinInputProps) {
  const refs = useRef<Array<TextInput | null>>([])

  const digits = useMemo(() => {
    const normalized = digitsOnly(value)
    const arr = Array.from({ length }, (_, idx) => normalized[idx] ?? '')
    return arr
  }, [length, value])

  const setAt = useCallback(
    (index: number, input: string) => {
      const digit = digitsOnly(input).slice(-1)
      const next = [...digits]
      next[index] = digit
      onChange(next.join(''))
      if (digit && index < length - 1) {
        refs.current[index + 1]?.focus?.()
      }
    },
    [digits, length, onChange]
  )

  const onKeyPress = useCallback(
    (index: number, key: string) => {
      if (key !== 'Backspace') return
      const next = [...digits]
      if (next[index]) {
        next[index] = ''
        onChange(next.join(''))
        return
      }
      if (index > 0) {
        next[index - 1] = ''
        onChange(next.join(''))
        setTimeout(() => refs.current[index - 1]?.focus?.(), 0)
      }
    },
    [digits, onChange]
  )

  return (
    <View style={styles.row}>
      {digits.map((d, idx) => (
        <TextInput
          key={idx}
          ref={(el) => {
            refs.current[idx] = el
          }}
          value={d}
          onChangeText={(t) => setAt(idx, t)}
          onKeyPress={({ nativeEvent }) => onKeyPress(idx, nativeEvent.key)}
          keyboardType="number-pad"
          autoCapitalize="none"
          maxLength={1}
          style={[styles.input, error ? styles.inputError : null]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minWidth: 44,
    height: 52,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 18,
    color: THEME.text,
    backgroundColor: THEME.card,
  },
  inputError: {
    borderColor: THEME.danger,
  },
})
