import { Platform } from 'react-native'

import { STORAGE_API_OVERRIDE_KEY, STORAGE_UPLOADER_OVERRIDE_KEY } from '../constants/storage'
import { safeLocalStorageGet } from '../lib/storage'

export function getApiBaseFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

  const override = safeLocalStorageGet(STORAGE_API_OVERRIDE_KEY).trim()
  if (override) return override.replace(/\/$/, '')

  const url = new URL(window.location.href)
  const q = String(url.searchParams.get('api') || '').trim()
  if (q) return q.replace(/\/$/, '')

  const envBase = String((process as any)?.env?.EXPO_PUBLIC_API_BASE_URL || '').trim()
  if (envBase) return envBase.replace(/\/$/, '')

  // Default (production)
  // Local development can override via ?api=http://localhost:8787 or API Base Override in /dev.
  return 'https://api.oshidra.com'
}

export function getUploaderBaseFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

  const override = safeLocalStorageGet(STORAGE_UPLOADER_OVERRIDE_KEY).trim()
  if (override) return override.replace(/\/$/, '')

  const url = new URL(window.location.href)
  const q = String(url.searchParams.get('uploader') || '').trim()
  if (q) return q.replace(/\/$/, '')

  const envBase = String((process as any)?.env?.EXPO_PUBLIC_UPLOADER_BASE_URL || '').trim()
  if (envBase) return envBase.replace(/\/$/, '')

  // Default (production)
  // Local development can override via ?uploader=http://localhost:8788 or Uploader Base Override in /dev.
  return 'https://assets-uploader.oshidra.com'
}
