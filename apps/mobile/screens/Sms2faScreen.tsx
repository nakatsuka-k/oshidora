import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { PinInput, PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { digitsOnly } from '../utils/validators'
import { type Sms2faScreenProps } from '../types/sms2faTypes'

export function Sms2faScreen({ onBack, onSendCode, onVerifyCode, onComplete, initialCode }: Sms2faScreenProps) {
  const [phase, setPhase] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(18)

  useEffect(() => {
    if (phase !== 'code') return
    if (initialCode) setCode(initialCode)
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown, initialCode, phase])

  const phoneDigits = useMemo(() => digitsOnly(phone), [phone])

  const canSend = useMemo(() => phoneDigits.length >= 10 && !busy, [busy, phoneDigits.length])
  const canVerify = useMemo(() => digitsOnly(code).length === 4 && !busy, [busy, code])

  return (
    <View style={styles.full}>
      <LinearGradient
        colors={['#2A2A2A', '#0E0E0E', '#0A0A0A']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.80)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScreenContainer title="2段階認証" onBack={onBack} backgroundColor="transparent" padding={16}>
        <View style={styles.page}>
          <View style={styles.card}>
            {phase === 'phone' ? (
              <>
                <Text style={styles.cardTitle}>電話番号</Text>
                <Text style={styles.cardDesc}>SMS（携帯電話番号宛）に認証コードを送信します。</Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="09012345678"
                  placeholderTextColor={'rgba(255,255,255,0.35)'}
                  keyboardType="phone-pad"
                  style={styles.phoneInput}
                />

                <View style={styles.cardSpacer} />
                <PrimaryButton
                  label="認証コードを送信"
                  disabled={!canSend}
                  onPress={async () => {
                    setError('')
                    if (phoneDigits.length < 10) {
                      setError('電話番号を入力してください')
                      return
                    }
                    setBusy(true)
                    try {
                      await onSendCode(phoneDigits)
                      setPhase('code')
                      setCooldown(18)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e))
                    } finally {
                      setBusy(false)
                    }
                  }}
                />
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>SMS（携帯電話番号宛）に届いた</Text>
                <Text style={styles.cardTitle}>4桁の認証コードを入力してください。</Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <PinInput
                  length={4}
                  value={code}
                  onChange={setCode}
                  error={!!error}
                  rowStyle={styles.pinRow}
                  inputStyle={styles.pinBox}
                />

                <View style={styles.cardSpacer} />
                <PrimaryButton
                  label="認証する"
                  disabled={!canVerify}
                  onPress={async () => {
                    setError('')
                    const v = digitsOnly(code)
                    if (v.length !== 4) {
                      setError('認証コードを入力してください')
                      return
                    }
                    setBusy(true)
                    try {
                      await onVerifyCode(phoneDigits, v)
                      onComplete(phoneDigits)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e))
                    } finally {
                      setBusy(false)
                    }
                  }}
                />

                <View style={styles.resendBlock}>
                  <Text style={styles.resendHint}>
                    確認SMSが届かない場合や誤って削除した場合は、{''}
                    {'\n'}以下より再度送信してください。{cooldown > 0 ? `（${cooldown}秒）` : ''}
                  </Text>
                  {cooldown > 0 ? (
                    <Text style={styles.resendDisabled}>再送信する</Text>
                  ) : (
                    <Pressable
                      onPress={async () => {
                        setError('')
                        setBusy(true)
                        try {
                          await onSendCode(phoneDigits)
                          setCooldown(18)
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e))
                        } finally {
                          setBusy(false)
                        }
                      }}
                      disabled={busy}
                    >
                      <Text style={styles.resend}>再送信する</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>

          {phase === 'code' ? (
            <Pressable
              onPress={() => {
                setError('')
                setCode('')
                setPhase('phone')
              }}
              style={styles.backToPhone}
            >
              <Text style={styles.backToPhoneText}>電話番号を変更する</Text>
            </Pressable>
          ) : null}
        </View>
      </ScreenContainer>
    </View>
  )
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  cardTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  error: {
    color: THEME.danger,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    color: THEME.text,
    backgroundColor: 'rgba(0,0,0,0.20)',
    marginTop: 12,
  },
  pinRow: {
    justifyContent: 'center',
    gap: 12,
    marginTop: 18,
  },
  pinBox: {
    flex: 0,
    width: 56,
    height: 56,
    borderRadius: 10,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'transparent',
    fontSize: 20,
    fontWeight: '800',
  },
  cardSpacer: {
    height: 18,
  },
  resendBlock: {
    marginTop: 14,
    alignItems: 'center',
  },
  resendHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  resend: {
    color: THEME.accent,
    fontSize: 16,
    fontWeight: '900',
    textDecorationLine: 'underline',
    marginTop: 10,
  },
  resendDisabled: {
    color: 'rgba(244,176,27,0.45)',
    fontSize: 16,
    fontWeight: '900',
    textDecorationLine: 'underline',
    marginTop: 10,
  },
  backToPhone: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  backToPhoneText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
})
