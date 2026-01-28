import { createContext, useContext } from 'react'
import { Platform } from 'react-native'

import { STORAGE_KEY, UNAUTHORIZED_EVENT } from '../constants/storage'
import { safeLocalStorageRemove } from './storage'

export type CmsApiConfig = {
  apiBase: string
  uploaderBase: string
  token: string
  mock: boolean
}

export const CmsApiContext = createContext<CmsApiConfig | null>(null)

export function useCmsApi() {
  const v = useContext(CmsApiContext)
  if (!v) throw new Error('CMS API is not configured')
  return v
}

let unauthorizedEventEmitted = false

export async function cmsFetchJsonWithBase<T>(cfg: CmsApiConfig, baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const base = (baseUrl || '').replace(/\/$/, '')
  if (!base) throw new Error('API Base が未設定です')
  if (!cfg.token) throw new Error('セッションが切れました')

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${cfg.token}`,
      ...(cfg.mock ? { 'X-Mock': '1' } : {}),
    },
  })
  const json = (await res.json().catch(() => ({}))) as any

  if (res.status === 401) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Ensure a bad/expired remembered token doesn't keep auto-logging in.
      safeLocalStorageRemove(STORAGE_KEY)

      if (!unauthorizedEventEmitted) {
        let dispatched = false
        try {
          window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { path } }))
          dispatched = true
        } catch {
          try {
            window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
            dispatched = true
          } catch {
            dispatched = false
          }
        }

        if (!dispatched) {
          try {
            window.location.href = '/login'
          } catch {
            // ignore
          }
        }

        // Only suppress future emissions if we actually notified the app.
        unauthorizedEventEmitted = dispatched
      }
    }
    throw new Error('セッションが切れました')
  }

  if (!res.ok) {
    const msg = json && json.error ? String(json.error) : '通信に失敗しました。時間をおいて再度お試しください'
    throw new Error(msg)
  }
  return json as T
}

export async function cmsFetchJson<T>(cfg: CmsApiConfig, path: string, init?: RequestInit): Promise<T> {
  return cmsFetchJsonWithBase<T>(cfg, cfg.apiBase, path, init)
}

export function resetUnauthorizedEventEmission(): void {
  unauthorizedEventEmitted = false
}
