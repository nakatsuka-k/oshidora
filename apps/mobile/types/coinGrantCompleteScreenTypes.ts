export type Props = {
  grantedCoins: number
  reasonLabel: string
  grantedAt: number
  balanceAfter: number
  primaryAction: { label: string; onPress: () => void }
  showMyPageAction?: boolean
  onGoMyPage?: () => void
}
