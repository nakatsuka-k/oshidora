/**
 * Coin exchange PayPay screen types and utilities
 */

export type CoinExchangePayPayScreenProps = {
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

export function formatCoins(value: number) {
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return v.toLocaleString('ja-JP')
}

export function parsePositiveInt(value: string): number {
  const raw = (value || '').replace(/[^0-9]/g, '')
  if (!raw) return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}
