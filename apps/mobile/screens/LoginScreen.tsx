import { useMemo } from 'react'
import { Image, StyleSheet, Text, TextInput, View } from 'react-native'

import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type LoginFieldErrors = {
  email?: string
  password?: string
}

type Props = {
  email: string
  password: string
  fieldErrors: LoginFieldErrors
  bannerError: string
  busy: boolean
  onChangeEmail: (value: string) => void
  onChangePassword: (value: string) => void
  onCancel: () => void
  onNext: () => void
  canNext: boolean
}

export function LoginScreen(props: Props) {
  const inputErrorStyle = useMemo(() => styles.inputError, [])

  return (
    <ScreenContainer title="ログイン">
      <View style={styles.authCenter}>
        <View style={styles.authContent}>
          <View style={styles.authTop}>
            <View style={styles.authLogoWrap}>
              <Image source={require('../assets/oshidora-logo.png')} style={styles.authLogo} resizeMode="contain" />
            </View>

            {props.bannerError ? <Text style={styles.bannerError}>{props.bannerError}</Text> : null}

            <View style={styles.field}>
              <TextInput
                value={props.email}
                onChangeText={props.onChangeEmail}
                placeholder="メールアドレス"
                placeholderTextColor={THEME.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, props.fieldErrors.email ? inputErrorStyle : null]}
              />
              {props.fieldErrors.email ? <Text style={styles.fieldError}>{props.fieldErrors.email}</Text> : null}
            </View>

            <View style={styles.field}>
              <TextInput
                value={props.password}
                onChangeText={props.onChangePassword}
                placeholder="パスワード"
                placeholderTextColor={THEME.textMuted}
                secureTextEntry
                autoCapitalize="none"
                style={[styles.input, props.fieldErrors.password ? inputErrorStyle : null]}
              />
              {props.fieldErrors.password ? <Text style={styles.fieldError}>{props.fieldErrors.password}</Text> : null}
            </View>
          </View>

          <View style={styles.authBottom}>
            <View style={styles.buttons}>
              <View style={styles.buttonRow}>
                <SecondaryButton label="キャンセル" onPress={props.onCancel} disabled={props.busy} />
                <View style={styles.spacer} />
                <PrimaryButton label="次へ" onPress={props.onNext} disabled={!props.canNext} fullWidth={false} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  authCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  authContent: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    overflow: 'hidden',
  },
  authTop: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  authBottom: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  authLogoWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  authLogo: {
    width: 160,
    height: 54,
  },
  bannerError: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  field: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E6E6E6',
    backgroundColor: THEME.bg,
    fontSize: 13,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  fieldError: {
    marginTop: 6,
    color: '#FF3B30',
    fontSize: 11,
    fontWeight: '700',
  },
  buttons: {
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    width: 10,
  },
})
