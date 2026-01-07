import { useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

export type PurchaseTargetType = 'content' | 'episode'

type PaidVideoPurchaseScreenProps = {
  onBack: () => void
  targetType: PurchaseTargetType
  targetId: string
  thumbnail?: ReturnType<typeof require>
  title: string
  contentTypeLabel: string
  requiredCoins: number
  ownedCoins: number
  purchased: boolean
  onPurchase: (opts: { targetType: PurchaseTargetType; targetId: string; requiredCoins: number }) => Promise<void>
  onBuyCoins: () => void
}

const FALLBACK_THUMB = require('../assets/thumbnail-sample.png')

export function PaidVideoPurchaseScreen({
  onBack,
  targetType,
  targetId,
  thumbnail,
  title,
  contentTypeLabel,
  requiredCoins,
  ownedCoins,
  purchased,
  onPurchase,
  onBuyCoins,
}: PaidVideoPurchaseScreenProps) {
  const shortage = useMemo(() => {
    if (!Number.isFinite(requiredCoins) || !Number.isFinite(ownedCoins)) return 0
    return Math.max(0, requiredCoins - ownedCoins)
  }, [ownedCoins, requiredCoins])

  const canPurchase = shortage <= 0 && !purchased

  const [busy, setBusy] = useState(false)
  const [bannerError, setBannerError] = useState<string>('')

  const doPurchase = async () => {
    if (!canPurchase || busy) return
    setBannerError('')
    setBusy(true)
    try {
      await onPurchase({ targetType, targetId, requiredCoins })
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer title="購入確認" onBack={onBack} scroll maxWidth={520}>
      <View style={styles.root}>
        {bannerError ? <Text style={styles.bannerError}>{bannerError}</Text> : null}

        <View style={styles.hero}>
          <Image source={thumbnail ?? FALLBACK_THUMB} style={styles.thumb} resizeMode="cover" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{contentTypeLabel}</Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.h1} numberOfLines={2} ellipsizeMode="tail">
            {title}
          </Text>
        </View>

        <View style={styles.box}>
          <View style={styles.row}>
            <Text style={styles.k}>必要コイン：</Text>
            <Text style={styles.v}>{requiredCoins}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.k}>所持コイン：</Text>
            <Text style={styles.v}>{ownedCoins}</Text>
          </View>
          {shortage > 0 ? (
            <View style={styles.row}>
              <Text style={styles.k}>不足コイン：</Text>
              <Text style={styles.v}>{shortage}</Text>
            </View>
          ) : null}

          <Text style={styles.note}>購入後は永続的に視聴できます</Text>
        </View>

        <View style={styles.buttons}>
          <PrimaryButton label={purchased ? '購入済み' : '購入する'} onPress={doPurchase} disabled={!canPurchase || busy} />
          {shortage > 0 && !purchased ? (
            <View style={styles.buyCoins}>
              <SecondaryButton label="コインを購入する" onPress={onBuyCoins} disabled={busy} />
            </View>
          ) : null}

          <Pressable onPress={onBack} disabled={busy} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>キャンセル</Text>
          </Pressable>
        </View>

        {busy ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bannerError: {
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
  hero: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  badgeText: {
    color: THEME.text,
    fontSize: 10,
    fontWeight: '800',
  },
  titleBlock: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  h1: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '900',
  },
  box: {
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
    paddingVertical: 6,
  },
  k: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  v: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  note: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  buttons: {
    marginTop: 14,
  },
  buyCoins: {
    marginTop: 10,
  },
  cancel: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelText: {
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
