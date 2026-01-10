import { StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, THEME } from '../components'

type CoinExchangeCompleteScreenProps = {
  coinAmount: number
  pointAmount: number
  paypayMaskedLabel: string
  onDone: () => void
}

function formatCoins(value: number) {
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return v.toLocaleString('ja-JP')
}

export function CoinExchangeCompleteScreen({ coinAmount, pointAmount, paypayMaskedLabel, onDone }: CoinExchangeCompleteScreenProps) {
  return (
    <ScreenContainer title="コイン換金" maxWidth={828}>
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>申請を受け付けました</Text>
          <Text style={styles.note}>申請後、運営確認を行います。{`\n`}反映まで時間がかかる場合があります。</Text>

          <View style={{ height: 14 }} />

          <View style={styles.summary}>
            <Text style={styles.summaryRow}>交換コイン数：{formatCoins(coinAmount)}コイン</Text>
            <Text style={styles.summaryRow}>交換予定：{formatCoins(pointAmount)}ポイント</Text>
            <Text style={styles.summaryRow}>換金先：PayPay（{paypayMaskedLabel || '********'}）</Text>
          </View>

          <View style={{ height: 14 }} />
          <PrimaryButton label="マイページへ戻る" onPress={onDone} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 16,
  },
  title: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  note: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  summary: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.bg,
  },
  summaryRow: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
})
