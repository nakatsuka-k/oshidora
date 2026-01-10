import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ConfirmDialog, PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type CoinExchangePayPayScreenProps = {
  ownedCoins: number
  exchangeableCoins: number
  pendingCoins: number
  paypayLinked: boolean
  paypayMaskedLabel: string
  onBack: () => void
  onCancel: () => void
  onChangeLink: () => void
  onSubmit: (opts: { coinAmount: number; pointAmount: number }) => Promise<void>
}

function formatCoins(value: number) {
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return v.toLocaleString('ja-JP')
}

function parsePositiveInt(value: string): number {
  const raw = (value || '').replace(/[^0-9]/g, '')
  if (!raw) return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

export function CoinExchangePayPayScreen({
  ownedCoins,
  exchangeableCoins,
  pendingCoins,
  paypayLinked,
  paypayMaskedLabel,
  onBack,
  onCancel,
  onChangeLink,
  onSubmit,
}: CoinExchangePayPayScreenProps) {
  const [amountText, setAmountText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  const coinAmount = useMemo(() => parsePositiveInt(amountText), [amountText])
  const pointAmount = coinAmount
  const feePoints = 0
  const receivePoints = Math.max(0, pointAmount - feePoints)

  const hasPending = pendingCoins > 0

  const canSubmit = useMemo(() => {
    if (busy) return false
    if (!paypayLinked) return false
    if (hasPending) return false
    if (!(coinAmount >= 1)) return false
    if (!(coinAmount <= exchangeableCoins)) return false
    return true
  }, [busy, coinAmount, exchangeableCoins, hasPending, paypayLinked])

  const openConfirm = useCallback(() => {
    setError('')
    setConfirm(true)
  }, [])

  const submit = useCallback(async () => {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({ coinAmount, pointAmount: receivePoints })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }, [canSubmit, coinAmount, onSubmit, receivePoints])

  if (!paypayLinked) {
    return (
      <ScreenContainer title="コイン換金" onBack={onBack} maxWidth={828}>
        <View style={styles.root}>
          <View style={styles.card}>
            <Text style={styles.title}>PayPay連携が必要です</Text>
            <Text style={styles.note}>PayPayポイントへ交換するため、PayPay連携が必要です。</Text>
            <View style={{ height: 12 }} />
            <PrimaryButton label="換金先選択へ戻る" onPress={onChangeLink} />
            <View style={{ height: 10 }} />
            <SecondaryButton label="キャンセル" onPress={onCancel} />
          </View>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer title="コイン換金" onBack={onBack} maxWidth={828}>
      <View style={styles.root}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>コイン状況</Text>
          <View style={styles.card}>
            <Text style={styles.rowText}>現在の保有コイン：{formatCoins(ownedCoins)}コイン</Text>
            <Text style={styles.rowText}>換金可能：{formatCoins(exchangeableCoins)}コイン</Text>
            <Text style={styles.rowText}>申請中：{formatCoins(pendingCoins)}コイン</Text>
            <Text style={styles.note}>申請後、運営確認を行います{`\n`}反映まで時間がかかる場合があります</Text>
            {hasPending ? (
              <Text style={styles.warn}>現在申請中のため、追加申請はできません</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>換金先（PayPay）</Text>
          <View style={styles.card}>
            <Text style={styles.rowText}>換金先：PayPayポイント</Text>
            <Text style={styles.rowText}>連携状態：連携済み</Text>
            <Text style={styles.masked}>連携先：PayPay（{paypayMaskedLabel || '********'}）</Text>
            <View style={{ height: 10 }} />
            <Pressable
              style={[styles.linkBtn, busy ? styles.linkBtnDisabled : null]}
              disabled={busy}
              onPress={onChangeLink}
            >
              <Text style={styles.linkBtnText}>連携を変更する</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>交換内容入力</Text>
          <View style={styles.card}>
            <Text style={styles.label}>交換コイン数</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="例：5000"
              placeholderTextColor={THEME.textMuted}
              keyboardType="number-pad"
              style={styles.input}
              editable={!busy && !hasPending}
            />

            <View style={{ height: 10 }} />
            <View style={styles.quickRow}>
              <Pressable
                style={[styles.quickBtn, busy || hasPending ? styles.quickBtnDisabled : null]}
                disabled={busy || hasPending}
                onPress={() => setAmountText(String(exchangeableCoins))}
              >
                <Text style={styles.quickText}>全額（換金可能分）</Text>
              </Pressable>

              {[1000, 3000, 5000].map((v) => (
                <Pressable
                  key={v}
                  style={[styles.quickChip, busy || hasPending ? styles.quickBtnDisabled : null]}
                  disabled={busy || hasPending}
                  onPress={() => setAmountText(String(v))}
                >
                  <Text style={styles.quickChipText}>{formatCoins(v)}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ height: 12 }} />

            <Text style={styles.infoRow}>交換レート：1コイン = 1ポイント（円相当）</Text>
            <Text style={styles.infoRow}>交換予定：{formatCoins(pointAmount)}ポイント</Text>
            <Text style={styles.infoRow}>手数料：{formatCoins(feePoints)}ポイント</Text>
            <Text style={styles.infoRow}>受取予定：{formatCoins(receivePoints)}ポイント</Text>

            {coinAmount > exchangeableCoins ? (
              <Text style={styles.warn}>換金可能コインを超えています</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>確認事項</Text>
          <View style={styles.card}>
            <Text style={styles.note}>申請後の取り消しはできません{`\n`}不正が確認された場合、申請を却下することがあります{`\n`}反映は数営業日かかる場合があります</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>申請に失敗しました: {error}</Text> : null}

        <View style={styles.footer}>
          <SecondaryButton label="キャンセル" onPress={onCancel} disabled={busy} />
          <View style={{ height: 10 }} />
          {busy ? (
            <View style={styles.busyBtn}>
              <ActivityIndicator />
            </View>
          ) : (
            <PrimaryButton label="交換申請する" onPress={openConfirm} disabled={!canSubmit} />
          )}
        </View>

        <ConfirmDialog
          visible={confirm}
          title="確認"
          message={`${formatCoins(coinAmount)}コインをPayPayポイントへ交換申請しますか？`}
          onRequestClose={() => setConfirm(false)}
          primary={{
            label: '申請する',
            onPress: () => {
              void submit()
            },
            disabled: !canSubmit,
          }}
          secondary={{
            label: 'キャンセル',
            onPress: () => setConfirm(false),
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
  title: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  rowText: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  masked: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
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
  label: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '800',
    minHeight: 44,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  quickBtn: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  quickText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
  },
  quickChip: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  quickChipText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
  },
  quickBtnDisabled: {
    opacity: 0.6,
  },
  infoRow: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  note: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  warn: {
    marginTop: 10,
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  error: {
    marginTop: 6,
    color: THEME.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    marginTop: 4,
  },
  busyBtn: {
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
})
