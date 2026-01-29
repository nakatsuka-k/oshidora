/**
 * Subscription screen types
 */

export type Props = {
  subscribed: boolean
  onBack: () => void
  onSubscribe: () => Promise<void>
  onCancel: () => Promise<void>
  onRefresh?: (() => Promise<void>) | undefined
  note?: string | null
}
