/**
 * Contact screen types and utilities
 */

export type ContactTypeKey = 'service' | 'video' | 'billing' | 'cast' | 'bug' | 'other'

export const CONTACT_TYPES: Array<{ key: ContactTypeKey; label: string }> = [
  { key: 'service', label: 'サービスについて' },
  { key: 'video', label: '動画・視聴に関する問題' },
  { key: 'billing', label: '課金・コインについて' },
  { key: 'cast', label: 'キャスト・スタッフについて' },
  { key: 'bug', label: '不具合の報告' },
  { key: 'other', label: 'その他' },
]

export type ContactScreenProps = {
  apiBaseUrl: string
  displayName: string
  email: string
  onBack: () => void
  onGoFaq: () => void
  onDone: () => void
}
