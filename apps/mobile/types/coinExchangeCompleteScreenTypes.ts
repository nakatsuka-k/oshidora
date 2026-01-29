export type CoinExchangeCompleteScreenProps = {
  coinAmount: number
  pointAmount: number
  paypayMaskedLabel: string
  onDone: () => void
}

export function formatCoins(value: number) {
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return v.toLocaleString('ja-JP')
}
