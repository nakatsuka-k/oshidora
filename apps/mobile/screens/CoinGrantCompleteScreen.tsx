import { StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import type { Props } from '../types/coinGrantCompleteScreenTypes'

function formatYmdHm(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${day} ${hh}:${mm}`
}

export function CoinGrantCompleteScreen({
  grantedCoins,
  reasonLabel,
  grantedAt,
  balanceAfter,
  primaryAction,
  showMyPageAction = true,
  onGoMyPage,
}: Props) {
  return (
    <ScreenContainer title="コイン付与完了">
      <View style={styles.root}>
        <View style={styles.box}>
          <Text style={styles.title}>コインの付与が完了しました</Text>
          <Text style={styles.sub}>ご利用ありがとうございます</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.k}>付与コイン</Text>
            <Text style={styles.v}>＋{Number.isFinite(grantedCoins) ? Math.max(0, Math.floor(grantedCoins)) : 0}コイン</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.k}>付与内容</Text>
            <Text style={styles.v}>{reasonLabel || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.k}>付与日時</Text>
            <Text style={styles.v}>{formatYmdHm(grantedAt)}</Text>
          </View>
        </View>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceTitle}>現在のコイン残高</Text>
          <Text style={styles.balanceValue}>{Number.isFinite(balanceAfter) ? Math.max(0, Math.floor(balanceAfter)) : 0}コイン</Text>
        </View>

        <View style={styles.buttons}>
          <PrimaryButton label={primaryAction.label} onPress={primaryAction.onPress} />
          {showMyPageAction && onGoMyPage ? (
            <View style={styles.gap}>
              <SecondaryButton label="マイページへ戻る" onPress={onGoMyPage} />
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
    paddingTop: 10,
  },
  box: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
  },
  sub: {
    marginTop: 8,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  k: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  v: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
  },
  balanceBox: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 16,
    marginBottom: 14,
  },
  balanceTitle: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  balanceValue: {
    marginTop: 8,
    color: THEME.text,
    fontSize: 16,
    fontWeight: '900',
  },
  buttons: {
    marginTop: 2,
  },
  gap: {
    marginTop: 10,
  },
})
