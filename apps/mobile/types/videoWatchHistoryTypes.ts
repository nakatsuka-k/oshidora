/**
 * Video watch history screen types and utilities
 */

export type Props = {
  userKey: string
  onBack: () => void
  onOpenVideo: (contentId: string) => void
  onGoVideos: () => void
}

export function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

export function formatMmSs(sec: number) {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${pad2(mm)}:${pad2(ss)}`
}

export function formatYmd(ms: number) {
  const d = new Date(Number.isFinite(ms) ? ms : 0)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  return `${y}/${m}/${day}`
}

import { Alert, Platform } from 'react-native'

export function confirmAction(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false)
  }

  return new Promise((resolve) => {
    Alert.alert('確認', message, [
      { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}
