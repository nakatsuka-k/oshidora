import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Path, Svg } from 'react-native-svg'
import { PrimaryButton, ScreenContainer, TextField, THEME } from '../components'
import { isValidEmail } from '../utils/validators'

type SignupScreenProps = {
  initialEmail?: string
  onSendCode: (email: string, password: string) => Promise<void>
  onLogin: () => void
  onBack: () => void
}

export function SignupScreen({ initialEmail, onSendCode, onLogin, onBack }: SignupScreenProps) {
  const GOLD = '#A87A2A'
  const GOLD_TEXT = '#111827'

  const [email, setEmail] = useState(initialEmail ?? '')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPassword2, setShowPassword2] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canSend = useMemo(() => {
    const eok = isValidEmail(email)
    const p1 = password.trim()
    const p2 = password2.trim()
    return eok && p1.length > 0 && p1 === p2 && !busy
  }, [busy, email, password, password2])

  const EyeIcon = ({ open }: { open: boolean }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {/* Simple eye / eye-off using strokes */}
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke={THEME.textMuted}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={THEME.textMuted}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {open ? null : (
        <Path
          d="M4 4l16 16"
          stroke={THEME.textMuted}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </Svg>
  )

  return (
    <ScreenContainer title="新規登録" onBack={onBack} scroll>
      <View style={styles.root}>
        <View style={styles.main}>
          {error ? <Text style={styles.bannerError}>{error}</Text> : null}

          <View style={styles.top}>
            <TextField
              label="メールアドレス"
              value={email}
              onChangeText={setEmail}
              placeholder="メールアドレス"
              autoCapitalize="none"
              keyboardType="email-address"
              variant="glass"
              controlHeight={48}
              containerStyle={styles.field}
            />

            <TextField
              label="パスワード"
              value={password}
              onChangeText={setPassword}
              placeholder="パスワード"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              variant="glass"
              controlHeight={48}
              containerStyle={styles.field}
              right={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'パスワードを非表示にする' : 'パスワードを表示する'}
                >
                  <EyeIcon open={showPassword} />
                </Pressable>
              }
            />

            <TextField
              label="パスワード（確認）"
              value={password2}
              onChangeText={setPassword2}
              placeholder="パスワード（確認）"
              secureTextEntry={!showPassword2}
              autoCapitalize="none"
              variant="glass"
              controlHeight={48}
              containerStyle={styles.field}
              right={
                <Pressable
                  onPress={() => setShowPassword2((v) => !v)}
                  hitSlop={10}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword2 ? '確認用パスワードを非表示にする' : '確認用パスワードを表示する'}
                >
                  <EyeIcon open={showPassword2} />
                </Pressable>
              }
            />

            <Text style={styles.help}>登録用の認証コードをメールに送信します。</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <PrimaryButton
            label="認証コードを送信"
            disabled={!canSend}
            containerStyle={[styles.cta, { backgroundColor: GOLD }]}
            textStyle={[styles.ctaText, { color: GOLD_TEXT }]}
            onPress={async () => {
              setError('')
              const e = email.trim()
              if (!isValidEmail(e)) {
                setError('メールアドレスの形式が正しくありません')
                return
              }
              const p1 = password.trim()
              const p2 = password2.trim()
              if (!p1) {
                setError('パスワードを入力してください')
                return
              }
              if (!p2) {
                setError('確認用パスワードを入力してください')
                return
              }
              if (p1 !== p2) {
                setError('パスワードが一致しません')
                return
              }
              setBusy(true)
              try {
                await onSendCode(e, p1)
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              } finally {
                setBusy(false)
              }
            }}
          />
          <View style={styles.loginSpacer} />
          <Text style={styles.loginHint}>すでにアカウントを{'\n'}お持ちの方はこちら</Text>
          <Pressable onPress={onLogin} accessibilityRole="button" hitSlop={8} style={styles.loginLinkWrap}>
            <Text style={[styles.loginLink, { color: GOLD }]}>ログイン</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  // Keep input controls a consistent height (prevents tall fields when an eye icon is present).
  // NOTE: this is local to SignupScreen; other screens can opt-in similarly.
  root: {
    flex: 1,
    paddingTop: 6,
  },
  main: {
    flex: 1,
  },
  top: {
    paddingTop: 0,
  },
  bannerError: {
    fontSize: 12,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.danger,
    backgroundColor: THEME.card,
    borderRadius: 12,
    color: THEME.text,
  },
  field: {
    marginBottom: 14,
  },
  eyeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: {
    color: THEME.textMuted,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 18,
    textAlign: 'center',
  },
  bottom: {
    marginTop: 'auto',
    paddingTop: 10,
    paddingBottom: 14,
  },
  cta: {
    borderRadius: 28,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
  },
  loginSpacer: {
    height: 18,
  },
  loginHint: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  loginLinkWrap: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
})
