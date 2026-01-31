import { Platform } from 'react-native'
import type { CmsApiConfig, RouteId } from '../types/adminTypes'

const STORAGE_KEY = 'oshidra_admin_token_v1'
const STORAGE_EMAIL_KEY = 'oshidra_admin_email_v1'
const STORAGE_DEV_MODE_KEY = 'oshidra_admin_dev_mode_v1'
const STORAGE_API_OVERRIDE_KEY = 'oshidra_admin_api_base_override_v1'
const STORAGE_UPLOADER_OVERRIDE_KEY = 'oshidra_admin_uploader_base_override_v1'
const STORAGE_DEV_POS_KEY = 'oshidra_admin_dev_pos_v1'
const STORAGE_DEBUG_OVERLAY_POS_KEY = 'oshidra_admin_debug_overlay_pos_v1'
const STORAGE_MOCK_KEY = 'oshidra_admin_mock_v1'

const UNAUTHORIZED_EVENT = 'oshidra-admin:unauthorized'

export const ADMIN_STORAGE_KEYS = {
  TOKEN: STORAGE_KEY,
  EMAIL: STORAGE_EMAIL_KEY,
  DEV_MODE: STORAGE_DEV_MODE_KEY,
  API_OVERRIDE: STORAGE_API_OVERRIDE_KEY,
  UPLOADER_OVERRIDE: STORAGE_UPLOADER_OVERRIDE_KEY,
  DEV_POS: STORAGE_DEV_POS_KEY,
  DEBUG_OVERLAY_POS: STORAGE_DEBUG_OVERLAY_POS_KEY,
  MOCK: STORAGE_MOCK_KEY,
}

let unauthorizedEventEmitted = false

export function resetUnauthorizedEvent() {
  unauthorizedEventEmitted = false
}

export function csvToIdList(text: string): string[] {
  return (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function cmsFetchJsonWithBase<T>(
  cfg: CmsApiConfig,
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<T> {
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
      safeLocalStorageRemove(STORAGE_KEY)
      safeSessionStorageRemove(STORAGE_KEY)

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

export function isValidEmail(email: string): boolean {
  const v = email.trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function getRouteFromHash(): RouteId {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'login'
  const raw = (window.location.hash || '').replace(/^#/, '').trim()
  const path = raw.replace(/^\//, '').trim()
  const first = path.split('?')[0].split('#')[0].split('/')[0]
  const key = (first || 'login').toLowerCase()

  const routeMap: Record<string, RouteId> = {
    dev: 'dev',
    dashboard: 'dashboard',
    'videos-scheduled': 'videos-scheduled',
    'videos-scheduled-detail': 'videos-scheduled-detail',
    works: 'works',
    'work-detail': 'work-detail',
    'work-new': 'work-new',
    videos: 'videos',
    'video-categories': 'video-categories',
    'video-tags': 'video-tags',
    'video-detail': 'video-detail',
    'video-upload': 'video-upload',
    'unapproved-videos': 'unapproved-videos',
    'unapproved-video-detail': 'unapproved-video-detail',
    'unapproved-actor-accounts': 'unapproved-actor-accounts',
    'unapproved-actor-account-detail': 'unapproved-actor-account-detail',
    recommend: 'recommend',
    pickup: 'pickup',
    caststaff: 'castStaff',
    'caststaff-detail': 'castStaff-detail',
    'caststaff-new': 'castStaff-new',
    'comments-pending': 'comments-pending',
    'comment-approve': 'comment-approve',
    comments: 'comments',
    'comment-edit': 'comment-edit',
    coin: 'coin',
    'coin-setting-detail': 'coin-setting-detail',
    'coin-setting-new': 'coin-setting-new',
    users: 'users',
    'user-detail': 'user-detail',
    notices: 'notices',
    'notice-detail': 'notice-detail',
    'notice-new': 'notice-new',
    'ranking-videos': 'ranking-videos',
    'ranking-coins': 'ranking-coins',
    'ranking-actors': 'ranking-actors',
    'ranking-directors': 'ranking-directors',
    'ranking-writers': 'ranking-writers',
    categories: 'categories',
    'category-detail': 'category-detail',
    'category-new': 'category-new',
    tags: 'tags',
    'tag-edit': 'tag-edit',
    'tag-new': 'tag-new',
    admins: 'admins',
    'admin-detail': 'admin-detail',
    'admin-new': 'admin-new',
    inquiries: 'inquiries',
    'inquiry-detail': 'inquiry-detail',
    settings: 'settings',
    'password-reset': 'password-reset',
    'not-found': 'not-found',
    login: 'login',
  }

  return routeMap[key] ?? 'not-found'
}

export function getRouteFromPathname(): RouteId | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  const raw = (window.location.pathname || '').trim()
  const path = raw.replace(/^\//, '').trim()
  if (!path || path === 'index.html') return null

  const first = path.split('?')[0].split('#')[0].split('/')[0]
  const key = (first || '').toLowerCase()

  const routeMap: Record<string, RouteId> = {
    'password-reset': 'password-reset',
    dev: 'dev',
    dashboard: 'dashboard',
    'videos-scheduled': 'videos-scheduled',
    'videos-scheduled-detail': 'videos-scheduled-detail',
    works: 'works',
    'work-detail': 'work-detail',
    'work-new': 'work-new',
    videos: 'videos',
    'video-detail': 'video-detail',
    'video-upload': 'video-upload',
    'unapproved-videos': 'unapproved-videos',
    'unapproved-video-detail': 'unapproved-video-detail',
    'unapproved-actor-accounts': 'unapproved-actor-accounts',
    'unapproved-actor-account-detail': 'unapproved-actor-account-detail',
    recommend: 'recommend',
    pickup: 'pickup',
    caststaff: 'castStaff',
    'caststaff-detail': 'castStaff-detail',
    'caststaff-new': 'castStaff-new',
    'comments-pending': 'comments-pending',
    'comment-approve': 'comment-approve',
    comments: 'comments',
    'comment-edit': 'comment-edit',
    coin: 'coin',
    'coin-setting-detail': 'coin-setting-detail',
    'coin-setting-new': 'coin-setting-new',
    users: 'users',
    'user-detail': 'user-detail',
    notices: 'notices',
    'notice-detail': 'notice-detail',
    'notice-new': 'notice-new',
    'ranking-videos': 'ranking-videos',
    'ranking-coins': 'ranking-coins',
    'ranking-actors': 'ranking-actors',
    'ranking-directors': 'ranking-directors',
    'ranking-writers': 'ranking-writers',
    categories: 'categories',
    'category-detail': 'category-detail',
    'category-new': 'category-new',
    tags: 'tags',
    'tag-edit': 'tag-edit',
    'tag-new': 'tag-new',
    admins: 'admins',
    'admin-detail': 'admin-detail',
    'admin-new': 'admin-new',
    inquiries: 'inquiries',
    'inquiry-detail': 'inquiry-detail',
    settings: 'settings',
    login: 'login',
    'not-found': 'not-found',
  }

  return routeMap[key] ?? 'not-found'
}

export function getRouteFromLocation(): RouteId {
  return getRouteFromPathname() ?? getRouteFromHash()
}

export function setHashRoute(route: RouteId): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  const next = route === 'login' ? '#/login' : `#/${route}`
  if (window.location.hash === next) return
  window.location.hash = next
}

export function setPathRoute(route: RouteId): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  const nextPath = route === 'login' ? '/login' : route === 'dashboard' ? '/dashboard' : `/${route}`
  if (window.location.pathname === nextPath) return
  window.history.pushState({}, '', nextPath + window.location.search + window.location.hash)
}

export function getApiBaseFromLocation(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''

  const override = safeLocalStorageGet(STORAGE_API_OVERRIDE_KEY).trim()
  if (override) return override.replace(/\/$/, '')

  const url = new URL(window.location.href)
  const q = String(url.searchParams.get('api') || '').trim()
  if (q) return q.replace(/\/$/, '')

  const envBase = String((process as any)?.env?.EXPO_PUBLIC_API_BASE_URL || '').trim()
  if (envBase) return envBase.replace(/\/$/, '')

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

  return 'https://assets-uploader.oshidra.com'
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function safeLocalStorageGet(key: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''
  try {
    return String(window.localStorage.getItem(key) || '')
  } catch {
    return ''
  }
}

export function safeSessionStorageGet(key: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return ''
  try {
    return String(window.sessionStorage.getItem(key) || '')
  } catch {
    return ''
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export function safeSessionStorageSet(key: string, value: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export function safeLocalStorageRemove(key: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function safeSessionStorageRemove(key: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}
