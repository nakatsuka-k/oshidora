import type { ReactNode } from 'react'
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { THEME } from './theme'

const WEB_INPUT_FOCUS_RESET: any =
  Platform.OS === 'web'
    ? { outlineStyle: 'none', outlineWidth: 0, boxShadow: 'none' }
    : null

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string
  right?: ReactNode
  variant?: 'card' | 'glass'
  controlHeight?: number
  helperText?: string
  errorText?: string
  countText?: string
  containerStyle?: StyleProp<ViewStyle>
  inputStyle?: StyleProp<TextStyle>
}

export function TextField({
  label,
  right,
  variant = 'card',
  controlHeight,
  helperText,
  errorText,
  countText,
  containerStyle,
  inputStyle,
  editable,
  multiline,
  ...props
}: TextFieldProps) {
  const resolvedEditable = typeof editable === 'boolean' ? editable : true
  const rowVariantStyle = variant === 'glass' ? styles.inputRowGlass : styles.inputRowCard
  const fixedHeightStyle =
    typeof controlHeight === 'number' && !multiline
      ? ({ height: controlHeight, paddingVertical: 0 } as const)
      : null

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputRow,
          rowVariantStyle,
          fixedHeightStyle,
          multiline ? styles.inputRowMultiline : null,
          !resolvedEditable ? styles.disabled : null,
        ]}
      >
        <TextInput
          {...props}
          editable={resolvedEditable}
          multiline={multiline}
          underlineColorAndroid="transparent"
          placeholderTextColor={THEME.textMuted}
          selectionColor={THEME.accent}
          cursorColor={THEME.accent}
          style={[
            styles.input,
            WEB_INPUT_FOCUS_RESET,
            multiline ? styles.inputMultiline : null,
            right ? styles.inputWithRight : null,
            inputStyle,
          ]}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>

      {countText ? <Text style={styles.count}>{countText}</Text> : null}
      {errorText ? (
        <Text style={styles.error}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  inputRow: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRowCard: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
  },
  inputRowGlass: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  inputRowMultiline: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputWithRight: {
    paddingRight: 10,
  },
  right: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  count: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 10,
    textAlign: 'right',
  },
  helper: {
    marginTop: 4,
    color: THEME.textMuted,
    fontSize: 11,
  },
  error: {
    marginTop: 4,
    color: THEME.danger,
    fontSize: 11,
    fontWeight: '700',
  },
})
