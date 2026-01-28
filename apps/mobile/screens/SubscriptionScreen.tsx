import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type Props = {
  subscribed: boolean
  onBack: () => void
  onSubscribe: () => Promise<void>
  onCancel: () => Promise<void>
  onRefresh?: (() => Promise<void>) | undefined
  note?: string | null
}

export function SubscriptionScreen({ subscribed, onBack, onSubscribe, onCancel, onRefresh, note }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const title = 'サブスク会員'

  const statusLabel = useMemo(() => (subscribed ? '加入中' : '未加入'), [subscribed])

  const handleSubscribe = async () => {
    if (busy || subscribed) return
    setBusy(true)
    setError('')
    try {
      await onSubscribe()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async () => {
    if (busy || !subscribed) return
    setBusy(true)
    setError('')
    try {
      await onCancel()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRefresh = async () => {
    if (!onRefresh || busy) return
    setBusy(true)
    setError('')
    try {
      await onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer title={title} onBack={onBack} scroll>
      <View style={styles.root}>
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.k}>ステータス</Text>
            <Text style={[styles.v, subscribed ? styles.vOn : styles.vOff]}>{statusLabel}</Text>
          </View>
          <Text style={styles.desc}>
            サブスク会員に加入している場合、動画を視聴できます。{`\n`}
            ※ 加入/解約の手続きはStripeの決済画面（ブラウザ）で行います。{`\n`}
            手続き後は「加入状況を更新」で反映してください。
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          {!subscribed ? (
            <PrimaryButton label={busy ? '処理中…' : '加入する'} onPress={handleSubscribe} disabled={busy} />
          ) : (
            <PrimaryButton label="加入中" onPress={() => {}} disabled />
          )}

          <View style={{ height: 10 }} />

          {subscribed ? <SecondaryButton label={busy ? '処理中…' : '解約/管理する'} onPress={handleCancel} disabled={busy} /> : null}

          {onRefresh ? (
            <>
              <View style={{ height: 10 }} />
              <SecondaryButton label={busy ? '処理中…' : '加入状況を更新'} onPress={handleRefresh} disabled={busy} />
            </>
          ) : null}

          {!subscribed ? (
            <>
              <View style={{ height: 10 }} />
              <SecondaryButton label="閉じる" onPress={onBack} disabled={busy} />
            </>
          ) : null}

          <Pressable accessibilityRole="button" onPress={onBack} disabled={busy} style={styles.backLink}>
            <Text style={styles.backLinkText}>戻る</Text>
          </Pressable>

          {busy ? (
            <View style={styles.loading}>
              <ActivityIndicator />
            </View>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 4,
  },
  note: {
    color: THEME.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  k: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  v: {
    fontSize: 12,
    fontWeight: '900',
  },
  vOn: {
    color: THEME.accent,
  },
  vOff: {
    color: THEME.textMuted,
  },
  desc: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  error: {
    marginTop: 12,
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    marginTop: 14,
  },
  backLink: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  backLinkText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  loading: {
    marginTop: 10,
    alignItems: 'center',
  },
})
