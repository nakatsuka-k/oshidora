import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { ConfirmDialog, PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type CoinExchangeDestScreenProps = {
  ownedCoins: number
  exchangeableCoins: number
  paypayLinked: boolean
  paypayMaskedLabel: string
  onBack: () => void
  onCancel: () => void
  onLinkPaypay: () => Promise<void>
  onUnlinkPaypay: () => Promise<void>
  onNext: () => void
}

function formatCoins(value: number) {
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return v.toLocaleString('ja-JP')
}

export function CoinExchangeDestScreen({
  ownedCoins,
  exchangeableCoins,
  paypayLinked,
  paypayMaskedLabel,
  onBack,
  onCancel,
  onLinkPaypay,
  onUnlinkPaypay,
  onNext,
}: CoinExchangeDestScreenProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  const canGoNext = useMemo(() => {
    if (busy) return false
    if (!paypayLinked) return false
    if (!(exchangeableCoins > 0)) return false
    return true
  }, [busy, exchangeableCoins, paypayLinked])

  const link = useCallback(async () => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await onLinkPaypay()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [busy, onLinkPaypay])

  const unlink = useCallback(async () => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await onUnlinkPaypay()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setConfirmUnlink(false)
    }
  }, [busy, onUnlinkPaypay])

  return (
    <ScreenContainer title="コイン換金" onBack={onBack} maxWidth={828}>
      <View style={styles.root}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>コイン状況</Text>
          <View style={styles.card}>
            <Text style={styles.rowText}>現在の保有コイン：{formatCoins(ownedCoins)}コイン</Text>
            <Text style={styles.rowText}>換金可能：{formatCoins(exchangeableCoins)}コイン</Text>
            <Text style={styles.note}>換金は申請後、運営の確認を行います{`\n`}換金先の情報が未設定の場合、先に登録が必要です</Text>
            {exchangeableCoins <= 0 ? <Text style={styles.warn}>換金可能なコインがありません</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>換金先（交換先）</Text>
          <View style={styles.card}>
            <View style={styles.destRow}>
              <View style={styles.destLeft}>
                <Text style={styles.destTitle}>PayPayポイント</Text>
                <Text style={styles.destDesc}>PayPayポイントへ交換します{`\n`}交換後はPayPayアプリで利用できます</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{paypayLinked ? '連携済み' : '未連携'}</Text>
              </View>
            </View>

            <View style={{ height: 10 }} />

            {paypayLinked ? (
              <>
                <Text style={styles.masked}>連携先：PayPay（{paypayMaskedLabel || '********'}）</Text>
                <View style={{ height: 10 }} />
                <Pressable
                  style={[styles.linkBtn, busy ? styles.linkBtnDisabled : null]}
                  disabled={busy}
                  onPress={() => setConfirmUnlink(true)}
                >
                  <Text style={styles.linkBtnText}>連携を解除</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.linkBtn, busy ? styles.linkBtnDisabled : null]}
                disabled={busy}
                onPress={() => {
                  void link()
                }}
              >
                <Text style={styles.linkBtnText}>PayPayを連携する</Text>
              </Pressable>
            )}

            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator />
                <Text style={styles.busyText}>処理中...</Text>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>取得に失敗しました: {error}</Text> : null}
          </View>
        </View>

        <View style={styles.footer}>
          <SecondaryButton label="キャンセル" onPress={onCancel} disabled={busy} />
          <View style={{ height: 10 }} />
          <PrimaryButton label="次へ" onPress={onNext} disabled={!canGoNext} />
        </View>

        <ConfirmDialog
          visible={confirmUnlink}
          title="確認"
          message="PayPay連携を解除しますか？"
          onRequestClose={() => setConfirmUnlink(false)}
          primary={{
            label: busy ? '処理中' : '解除する',
            onPress: () => {
              void unlink()
            },
            disabled: busy,
          }}
          secondary={{
            label: 'キャンセル',
            onPress: () => setConfirmUnlink(false),
            disabled: busy,
          }}
        />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 14,
  },
  rowText: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  note: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  warn: {
    marginTop: 10,
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  destLeft: {
    flex: 1,
  },
  destTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  destDesc: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  statusPill: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '900',
  },
  masked: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  linkBtn: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 44,
  },
  linkBtnDisabled: {
    opacity: 0.6,
  },
  linkBtnText: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
  },
  busyRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  busyText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    marginTop: 10,
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    marginTop: 4,
  },
})
