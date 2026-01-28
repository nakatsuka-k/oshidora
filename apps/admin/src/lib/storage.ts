import { Platform } from 'react-native'

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function safeLocalStorageGet(key: string): string {
  if (Platform.OS !== 'web') return ''
  const w = globalThis as any
  try {
    const v = w?.localStorage?.getItem?.(key)
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  if (Platform.OS !== 'web') return
  const w = globalThis as any
  try {
    w?.localStorage?.setItem?.(key, value)
  } catch {
    // ignore
  }
}

export function safeLocalStorageRemove(key: string): void {
  if (Platform.OS !== 'web') return
  const w = globalThis as any
  try {
    w?.localStorage?.removeItem?.(key)
  } catch {
    // ignore
  }
}
