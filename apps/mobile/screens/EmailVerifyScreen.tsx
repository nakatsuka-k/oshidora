import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, SafeAreaView } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { digitsOnly } from '../utils/validators'
import { THEME } from '../components'

type EmailVerifyScreenProps = {
  email: string
  onResend: () => Promise<void>
  onVerify: (code: string) => Promise<void>
  onBack: () => void
  initialCode?: string
}

export function EmailVerifyScreen({ email, onResend, onVerify, onBack, initialCode }: EmailVerifyScreenProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(30)

  const refs = useRef<Array<TextInput | null>>([])

  useEffect(() => {
    setCooldown(30)
    if (initialCode) setCode(initialCode)
  }, [email, initialCode])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const canVerify = useMemo(() => digitsOnly(code).length === 6 && !busy, [busy, code])

  const digits = useMemo(() => {
    const normalized = digitsOnly(code)
    return Array.from({ length: 6 }, (_, idx) => normalized[idx] ?? '')
  }, [code])

  const setAt = useCallback(
    (index: number, input: string) => {
      const digit = digitsOnly(input).slice(-1)
      const next = [...digits]
      next[index] = digit
      setCode(next.join(''))
      if (digit && index < 5) refs.current[index + 1]?.focus?.()
    },
    [digits]
  )

  const onKeyPress = useCallback(
    (index: number, key: string) => {
      if (key !== 'Backspace') return
      const next = [...digits]
      if (next[index]) {
        next[index] = ''
        setCode(next.join(''))
        return
      }
      if (index > 0) {
        next[index - 1] = ''
        setCode(next.join(''))
        setTimeout(() => refs.current[index - 1]?.focus?.(), 0)
      }
    },
    [digits]
  )

  const onSubmitVerify = useCallback(async () => {
    setError('')
    const v = digitsOnly(code)
    if (v.length !== 6) {
      setError('認証コードを入力してください')
      return
    }
    setBusy(true)
    try {
      await onVerify(v)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [code, onVerify])

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.root}>
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0)']}
          locations={[0, 0.28, 1]}
          start={[0.5, 0]}
          end={[0.5, 1]}
          style={styles.topGlow}
          pointerEvents="none"
        />

        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="戻る">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15.5 5.5 8.5 12l7 6.5" stroke={COLORS.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            メールアドレス認証
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.content}>
          <Text style={styles.desc}>メールに届いた6桁の認証コードを入力してください。</Text>

          <Pressable
            style={styles.pinRow}
            onPress={() => {
              const idx = Math.min(digitsOnly(code).length, 5)
              refs.current[idx]?.focus?.()
            }}
          >
            {digits.map((d, idx) => (
              <TextInput
                key={idx}
                ref={(el) => {
                  refs.current[idx] = el
                }}
                value={d}
                onChangeText={(t) => {
                  setError('')
                  setAt(idx, t)
                }}
                onKeyPress={({ nativeEvent }) => onKeyPress(idx, nativeEvent.key)}
                keyboardType="number-pad"
                autoCapitalize="none"
                maxLength={1}
                returnKeyType={idx === 5 ? 'done' : 'next'}
                onSubmitEditing={() => {
                  if (idx === 5) void onSubmitVerify()
                }}
                style={[styles.pinBox, error ? styles.pinBoxError : null]}
                selectionColor={COLORS.accent}
                placeholder=""
                placeholderTextColor={COLORS.muted}
              />
            ))}
          </Pressable>

          <Pressable
            onPress={() => {
              if (!canVerify) return
              void onSubmitVerify()
            }}
            disabled={!canVerify}
            style={[styles.primaryBtn, !canVerify ? styles.primaryBtnDisabled : null]}
            accessibilityRole="button"
            accessibilityLabel="認証する"
          >
            <Text style={[styles.primaryBtnText, !canVerify ? styles.primaryBtnTextDisabled : null]}>認証する</Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.resendBlock}>
            <Text style={styles.resendHelp}>
              確認メールが届かない場合や誤って削除した場合は{cooldown > 0 ? `\n以下より再度送信してください。（${cooldown}秒）` : '\n以下より再度送信してください。'}
            </Text>

            {cooldown > 0 ? (
              <Text style={styles.resendDisabled}>再送信する</Text>
            ) : (
              <Pressable
                onPress={async () => {
                  setError('')
                  setBusy(true)
                  try {
                    await onResend()
                    setCooldown(30)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e))
                  } finally {
                    setBusy(false)
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="再送信する"
              >
                <Text style={styles.resend}>再送信する</Text>
              </Pressable>
            )}
          </View>

          {/* email is intentionally not shown in this design, but keep it accessible for debug */}
          <Text style={styles.srOnly} accessibilityLabel={`宛先メールアドレス ${email}`}>
            
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const COLORS = {
  bg: THEME.bg,
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.72)',
  subtle: 'rgba(255,255,255,0.55)',
  outline: 'rgba(255,255,255,0.40)',
  outlineStrong: 'rgba(255,255,255,0.62)',
  accent: '#B8862B',
  accentDisabled: 'rgba(184,134,43,0.45)',
  danger: '#FF6B6B',
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    alignItems: 'center',
  },
  desc: {
    color: COLORS.subtle,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 18,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
    maxWidth: 360,
    marginBottom: 22,
  },
  pinBox: {
    width: 46,
    height: 54,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pinBoxError: {
    borderColor: COLORS.danger,
  },
  primaryBtn: {
    width: '100%',
    maxWidth: 360,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.accentDisabled,
  },
  primaryBtnText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primaryBtnTextDisabled: {
    color: 'rgba(17,17,17,0.65)',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    maxWidth: 360,
  },
  resendBlock: {
    marginTop: 18,
    alignItems: 'center',
    maxWidth: 360,
  },
  resendHelp: {
    color: COLORS.subtle,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  resend: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  resendDisabled: {
    color: 'rgba(184,134,43,0.45)',
    fontSize: 16,
    fontWeight: '700',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
})
