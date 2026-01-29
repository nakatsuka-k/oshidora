import { StyleSheet, Text, TextInput, View } from 'react-native'

import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type Props = {
  otpDigits: string[]
  otpRefs: React.MutableRefObject<Array<TextInput | null>>
  bannerError: string
  fieldError: string
  busy: boolean
  canNext: boolean
  onBack: () => void
  onCancel: () => void
  onNext: () => void
  onChangeDigit: (index: number, value: string) => void
  onKeyPress: (index: number, key: string) => void
}

export function OtpScreen(props: Props) {
  return (
    <ScreenContainer title="2段階認証" onBack={props.onBack}>
      <Text style={styles.centerText}>電話番号(SMS)に送信された認証コードを入力して下さい</Text>

      {props.bannerError ? <Text style={styles.bannerError}>{props.bannerError}</Text> : null}

      <View style={styles.otpRow}>
        {props.otpDigits.map((digit, idx) => (
          <TextInput
            key={idx}
            ref={(el) => {
              props.otpRefs.current[idx] = el
            }}
            value={digit}
            onChangeText={(v) => props.onChangeDigit(idx, v)}
            onKeyPress={({ nativeEvent }) => props.onKeyPress(idx, nativeEvent.key)}
            keyboardType="number-pad"
            autoCapitalize="none"
            maxLength={1}
            style={[styles.otpInput, props.fieldError ? styles.inputError : null]}
          />
        ))}
      </View>

      {props.fieldError ? <Text style={styles.fieldErrorCenter}>{props.fieldError}</Text> : null}

      <View style={styles.buttons}>
        <View style={styles.buttonRow}>
          <SecondaryButton label="キャンセル" onPress={props.onCancel} disabled={props.busy} />
          <View style={styles.spacer} />
          <PrimaryButton label="次へ" onPress={props.onNext} disabled={!props.canNext} fullWidth={false} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  centerText: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 12,
  },
  bannerError: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  otpInput: {
    width: 44,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    textAlign: 'center',
    color: '#E6E6E6',
    fontSize: 18,
    fontWeight: '800',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  fieldErrorCenter: {
    textAlign: 'center',
    color: '#FF3B30',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  buttons: {
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    width: 10,
  },
})
