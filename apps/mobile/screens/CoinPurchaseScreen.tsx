import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import { apiFetch } from '../utils/api'

type CoinPack = {
  id: string
  coinAmount: number
  priceJpy: number
  bonusLabel?: string
}

type CoinPurchaseScreenProps = {
  apiBaseUrl: string
  ownedCoins: number
  onBack: () => void
  onStartCheckout: (opts: { packId: string }) => Promise<void>
}

type PacksResponse = { items: Array<{ packId: string; coinAmount: number; priceJpy: number; bonusLabel?: string }> }

type BalanceResponse = { coinBalance: number }

function formatYen(value: number) {
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return `¥${v.toLocaleString('ja-JP')}`
}

export function CoinPurchaseScreen({ apiBaseUrl, ownedCoins, onBack, onStartCheckout }: CoinPurchaseScreenProps) {
  const [balance, setBalance] = useState<number>(ownedCoins)
  const [packs, setPacks] = useState<CoinPack[]>([])

  const [selectedPackId, setSelectedPackId] = useState<string>('')

  const [busy, setBusy] = useState(false)
  const [bannerError, setBannerError] = useState<string>('')

  const selectedPack = useMemo(() => packs.find((p) => p.id === selectedPackId) ?? null, [packs, selectedPackId])
  const canBuy = Boolean(selectedPack) && !busy

  const loadInitial = useCallback(async () => {
    setBannerError('')

    // Balance
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/users/me/balance`)
      if (!res.ok) throw new Error('COIN-001-01')
      const json = (await res.json()) as BalanceResponse
      if (Number.isFinite((json as any)?.coinBalance)) setBalance(Number((json as any).coinBalance))
    } catch {
      // fallback to passed in ownedCoins
      setBalance(ownedCoins)
    }

    // Packs
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/coin-packs`)
      if (!res.ok) throw new Error('COIN-001-02')
      const json = (await res.json()) as PacksResponse
      const items = Array.isArray((json as any)?.items) ? ((json as any).items as any[]) : []
      const mapped: CoinPack[] = items
        .map((v) => ({
          id: String(v.packId ?? ''),
          coinAmount: Number(v.coinAmount ?? 0),
          priceJpy: Number(v.priceJpy ?? 0),
          bonusLabel: typeof v.bonusLabel === 'string' ? v.bonusLabel : undefined,
        }))
        .filter((v) => v.id && Number.isFinite(v.coinAmount) && Number.isFinite(v.priceJpy))
        .sort((a, b) => a.priceJpy - b.priceJpy)

      setPacks(mapped)
    } catch {
      // mock packs (fallback)
      setPacks([
        { id: 'p100', coinAmount: 100, priceJpy: 500 },
        { id: 'p300', coinAmount: 300, priceJpy: 1200, bonusLabel: '10%お得' },
        { id: 'p500', coinAmount: 500, priceJpy: 1800, bonusLabel: '15%お得' },
      ])
    }
  }, [apiBaseUrl, ownedCoins])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  const start = useCallback(async () => {
    if (!selectedPack || busy) return
    setBannerError('')
    setBusy(true)
    try {
      await onStartCheckout({ packId: selectedPack.id })
    } catch {
      setBannerError('決済の開始に失敗しました')
    } finally {
      setBusy(false)
    }
  }, [busy, onStartCheckout, selectedPack])

  return (
    <ScreenContainer title="コイン購入" onBack={onBack} scroll>
      <View style={styles.root}>
        {bannerError ? <Text style={styles.bannerError}>{bannerError}</Text> : null}

        <View style={styles.topBox}>
          <Text style={styles.balance}>所持コイン：{Number.isFinite(balance) ? balance : 0}</Text>
          <Text style={styles.desc}>コインを購入して動画を視聴できます</Text>
        </View>

        <View style={styles.list}>
          {packs.map((p) => {
            const selected = p.id === selectedPackId
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelectedPackId(p.id)}
                style={[styles.packCard, selected ? styles.packCardSelected : null]}
              >
                <View style={styles.packLeft}>
                  <Text style={styles.packTitle}>{p.coinAmount}コイン</Text>
                  {p.bonusLabel ? (
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusText}>{p.bonusLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.packPrice}>{formatYen(p.priceJpy)}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.notice}>※ 購入後の返金はできません。</Text>

        <View style={styles.buttons}>
          <PrimaryButton label="購入する" onPress={start} disabled={!canBuy} />
          <View style={styles.gap} />
          <SecondaryButton label="キャンセル" onPress={onBack} disabled={busy} />
        </View>

        {busy ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Checkout開始中…</Text>
          </View>
        ) : null}

        {Platform.OS === 'web' ? <View style={{ height: 10 }} /> : null}
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
  topBox: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    padding: 14,
    marginBottom: 12,
  },
  balance: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
  },
  desc: {
    marginTop: 6,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  list: {
    gap: 10,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    backgroundColor: THEME.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  packCardSelected: {
    borderColor: THEME.accent,
  },
  packLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  packTitle: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
  },
  packPrice: {
    color: THEME.text,
    fontSize: 14,
    fontWeight: '900',
  },
  bonusBadge: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bonusText: {
    color: THEME.text,
    fontSize: 10,
    fontWeight: '800',
  },
  notice: {
    marginTop: 12,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  buttons: {
    marginTop: 14,
  },
  gap: {
    height: 10,
  },
  loading: {
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
})
