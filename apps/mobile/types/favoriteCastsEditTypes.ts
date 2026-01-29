/**
 * Favorite casts edit screen types and utilities
 */

export type FavoriteCastsEditScreenProps = {
  apiBaseUrl: string
  authToken: string
  loggedIn: boolean
  onCancel: () => void
  onDone: () => void
}

export type Cast = {
  id: string
  name: string
  role: string
  thumbnailUrl?: string
}

export type CastResponse = { items: Cast[] }

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
