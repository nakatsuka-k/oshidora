import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { type Props } from '../types/logoutScreenTypes'

export function LogoutScreen({ onCancel, onLogout, onGoLogin }: Props) {
  const [phase, setPhase] = useState<'confirm' | 'done'>('confirm')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const doneDelayMs = useMemo(() => (Platform.OS === 'web' ? 1200 : 900), [])

  useEffect(() => {
    if (phase !== 'done') return
    const t = setTimeout(() => {
      onGoLogin()
    }, doneDelayMs)
    return () => clearTimeout(t)
  }, [doneDelayMs, onGoLogin, phase])

  return (
    <ScreenContainer title="ログアウト" onBack={phase === 'confirm' ? onCancel : undefined}>
      <View style={styles.root}>
        {phase === 'confirm' ? (
          <>
            <Text style={styles.title}>ログアウトしますか？</Text>
            <Text style={styles.desc}>画面からログアウトします。よろしいですか？</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actionsRow}>
              <SecondaryButton label="キャンセル" onPress={onCancel} disabled={busy} />
              <View style={styles.spacer} />
              <PrimaryButton
                label={busy ? '処理中…' : 'ログアウト'}
                disabled={busy}
                onPress={async () => {
                  if (busy) return
                  setError('')
                  setBusy(true)
                  try {
                    await onLogout()
                    setPhase('done')
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'ログアウトに失敗しました')
                  } finally {
                    setBusy(false)
                  }
                }}
                fullWidth={false}
              />
            </View>

            {busy ? (
              <View style={styles.loader}>
                <ActivityIndicator />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.title}>ログアウトしました</Text>
            <Text style={styles.desc}>再度ログインするには、ログイン画面から操作してください</Text>
            <View style={{ height: 16 }} />
            <PrimaryButton label="ログイン画面へ" onPress={onGoLogin} />
          </>
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 10,
  },
  title: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  desc: {
    color: THEME.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 16,
  },
  error: {
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    width: 10,
  },
  loader: {
    marginTop: 14,
  },
})
