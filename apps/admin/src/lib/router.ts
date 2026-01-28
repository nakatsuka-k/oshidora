import { Platform } from 'react-native'

import type { RouteId } from './routes'

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined'
}

function normalizePathname(pathname: string): string {
  const raw = String(pathname || '').trim()
  if (!raw) return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

function firstPathSegment(pathname: string): string {
  const path = normalizePathname(pathname)
  const withoutLeadingSlash = path.replace(/^\//, '')
  const first = withoutLeadingSlash.split('?')[0].split('#')[0].split('/')[0]
  return String(first || '').trim().toLowerCase()
}

export function getRouteFromPathname(pathname: string): RouteId | null {
  const key = firstPathSegment(pathname)
  if (!key || key === 'index.html') return null

  switch (key) {
    case 'password-reset':
      return 'password-reset'
    case 'dev':
      return 'dev'
    case 'dashboard':
      return 'dashboard'
    case 'videos-scheduled':
      return 'videos-scheduled'
    case 'videos-scheduled-detail':
      return 'videos-scheduled-detail'
    case 'works':
      return 'works'
    case 'work-detail':
      return 'work-detail'
    case 'work-new':
      return 'work-new'
    case 'videos':
      return 'videos'
    case 'video-categories':
      return 'video-categories'
    case 'video-tags':
      return 'video-tags'
    case 'video-detail':
      return 'video-detail'
    case 'video-upload':
      return 'video-upload'
    case 'unapproved-videos':
      return 'unapproved-videos'
    case 'unapproved-video-detail':
      return 'unapproved-video-detail'
    case 'unapproved-actor-accounts':
      return 'unapproved-actor-accounts'
    case 'unapproved-actor-account-detail':
      return 'unapproved-actor-account-detail'
    case 'recommend':
      return 'recommend'
    case 'pickup':
      return 'pickup'
    case 'caststaff':
      return 'castStaff'
    case 'caststaff-detail':
      return 'castStaff-detail'
    case 'caststaff-new':
      return 'castStaff-new'
    case 'comments-pending':
      return 'comments-pending'
    case 'comment-approve':
      return 'comment-approve'
    case 'comments':
      return 'comments'
    case 'comment-edit':
      return 'comment-edit'
    case 'coin':
      return 'coin'
    case 'coin-setting-detail':
      return 'coin-setting-detail'
    case 'coin-setting-new':
      return 'coin-setting-new'
    case 'users':
      return 'users'
    case 'user-detail':
      return 'user-detail'
    case 'user-new':
      return 'user-new'
    case 'notices':
      return 'notices'
    case 'notice-detail':
      return 'notice-detail'
    case 'notice-new':
      return 'notice-new'
    case 'ranking-videos':
      return 'ranking-videos'
    case 'ranking-coins':
      return 'ranking-coins'
    case 'ranking-actors':
      return 'ranking-actors'
    case 'ranking-directors':
      return 'ranking-directors'
    case 'ranking-writers':
      return 'ranking-writers'
    case 'categories':
      return 'categories'
    case 'category-detail':
      return 'category-detail'
    case 'category-new':
      return 'category-new'
    case 'tags':
      return 'tags'
    case 'tag-edit':
      return 'tag-edit'
    case 'tag-new':
      return 'tag-new'
    case 'genres':
      return 'genres'
    case 'genre-detail':
      return 'genre-detail'
    case 'genre-new':
      return 'genre-new'
    case 'cast-categories':
      return 'cast-categories'
    case 'cast-category-detail':
      return 'cast-category-detail'
    case 'cast-category-new':
      return 'cast-category-new'
    case 'admins':
      return 'admins'
    case 'admin-detail':
      return 'admin-detail'
    case 'admin-new':
      return 'admin-new'
    case 'inquiries':
      return 'inquiries'
    case 'inquiry-detail':
      return 'inquiry-detail'
    case 'settings':
      return 'settings'
    case 'login':
      return 'login'
    case 'not-found':
      return 'not-found'
    default:
      return 'not-found'
  }
}

export function getRouteFromHash(hash: string): RouteId | null {
  const raw = String(hash || '').replace(/^#/, '').trim()
  const path = raw.replace(/^\//, '').trim()
  const first = path.split('?')[0].split('#')[0].split('/')[0]
  const key = (first || '').toLowerCase()
  if (!key) return null

  // RouteId in hash historically matched the first segment.
  switch (key) {
    case 'dev':
    case 'dashboard':
    case 'videos-scheduled':
    case 'videos-scheduled-detail':
    case 'works':
    case 'work-detail':
    case 'work-new':
    case 'videos':
    case 'video-categories':
    case 'video-tags':
    case 'video-detail':
    case 'video-upload':
    case 'unapproved-videos':
    case 'unapproved-video-detail':
    case 'unapproved-actor-accounts':
    case 'unapproved-actor-account-detail':
    case 'recommend':
    case 'pickup':
    case 'comments-pending':
    case 'comment-approve':
    case 'comments':
    case 'comment-edit':
    case 'coin':
    case 'coin-setting-detail':
    case 'coin-setting-new':
    case 'users':
    case 'user-detail':
    case 'user-new':
    case 'notices':
    case 'notice-detail':
    case 'notice-new':
    case 'ranking-videos':
    case 'ranking-coins':
    case 'ranking-actors':
    case 'ranking-directors':
    case 'ranking-writers':
    case 'categories':
    case 'category-detail':
    case 'category-new':
    case 'tags':
    case 'tag-edit':
    case 'tag-new':
    case 'genres':
    case 'genre-detail':
    case 'genre-new':
    case 'cast-categories':
    case 'cast-category-detail':
    case 'cast-category-new':
    case 'admins':
    case 'admin-detail':
    case 'admin-new':
    case 'inquiries':
    case 'inquiry-detail':
    case 'settings':
    case 'password-reset':
    case 'not-found':
    case 'login':
      return key as RouteId
    case 'caststaff':
      return 'castStaff'
    case 'caststaff-detail':
      return 'castStaff-detail'
    case 'caststaff-new':
      return 'castStaff-new'
    default:
      return key === 'login' ? 'login' : 'not-found'
  }
}

export function getRouteFromLocation(): RouteId {
  if (!isWeb()) return 'login'
  return getRouteFromPathname(window.location.pathname) ?? getRouteFromHash(window.location.hash) ?? 'login'
}

export function setPathname(pathname: string, opts?: { replace?: boolean }): void {
  if (!isWeb()) return
  const next = normalizePathname(pathname)
  // Preserve hash routing state while we transition from legacy hash routes.
  const full = next + window.location.search + window.location.hash
  if ((window.location.pathname + window.location.search) === full) return

  if (opts?.replace) window.history.replaceState({}, '', full)
  else window.history.pushState({}, '', full)
}

export function setPathRoute(route: RouteId, opts?: { replace?: boolean }): void {
  const nextPath = route === 'login' ? '/login' : route === 'dashboard' ? '/dashboard' : `/${route}`
  setPathname(nextPath, opts)
}

export function setHashRoute(route: RouteId): void {
  if (!isWeb()) return
  const next = route === 'login' ? '#/login' : `#/${route}`
  if (window.location.hash === next) return
  window.location.hash = next
}

export function buildUserDetailPath(userId: string): string {
  const id = String(userId || '').trim()
  if (!id) return '/user-detail'
  return `/user-detail/${encodeURIComponent(id)}`
}

export function getUserDetailFromLocation(): { userId: string } {
  if (!isWeb()) return { userId: '' }

  const raw = String(window.location.pathname || '').trim()
  const path = raw.replace(/^\//, '')
  const pathPart = path.split('?')[0].split('#')[0]
  const parts = pathPart
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts[0]?.toLowerCase() !== 'user-detail') return { userId: '' }
  const rawId = parts[1] || ''

  const decoded = (() => {
    try {
      return decodeURIComponent(rawId)
    } catch {
      return rawId
    }
  })()

  return { userId: String(decoded || '').trim() }
}

export function normalizeLegacyHashToPath(): void {
  if (!isWeb()) return
  const hash = String(window.location.hash || '').trim()
  if (!hash || hash === '#') return

  // Only handle our legacy "#/..." scheme.
  if (!hash.startsWith('#/')) return

  const withoutHash = hash.replace(/^#\//, '')
  const qIndex = withoutHash.indexOf('?')
  const hashQuery = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : ''
  const pathPart = (qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash).split('#')[0]
  const parts = pathPart
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)

  const first = String(parts[0] || '').toLowerCase()
  if (!first) return

  // Preserve deep-link id for user-detail.
  const nextPath = (() => {
    if (first === 'user-detail') {
      const id = parts[1] || ''
      return buildUserDetailPath(id)
    }
    return `/${first}`
  })()

  // Merge query params from the legacy hash into the real search string.
  let nextSearch = window.location.search
  if (hashQuery) {
    try {
      const merged = new URLSearchParams(window.location.search)
      const fromHash = new URLSearchParams(hashQuery)
      for (const [k, v] of fromHash.entries()) merged.set(k, v)
      const s = merged.toString()
      nextSearch = s ? `?${s}` : ''
    } catch {
      // ignore
    }
  }

  try {
    window.history.replaceState({}, '', nextPath + nextSearch)
  } catch {
    // Fallback to the simpler helper (may drop hashQuery in older browsers).
    setPathname(nextPath, { replace: true })
  }

  // Clear the hash without triggering a navigation.
  try {
    window.location.hash = ''
  } catch {
    // ignore
  }
}
