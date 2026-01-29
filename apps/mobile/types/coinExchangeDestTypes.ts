/**
 * Coin exchange destination screen types and utilities
 */

export type CoinExchangeDestScreenProps = {
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

export function formatCoins(value: number) {
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return v.toLocaleString('ja-JP')
}
