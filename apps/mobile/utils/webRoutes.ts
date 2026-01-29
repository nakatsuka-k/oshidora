const TUTORIAL_SLIDE_COUNT = 3

export function getTutorialSlideCount(): number {
  return TUTORIAL_SLIDE_COUNT
}

function normalizePathname(pathname: string): string {
  const raw = String(pathname || '').trim()
  if (!raw) return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

export function splitPathname(pathname: string): string[] {
  const path = normalizePathname(pathname)
  return path
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function tutorialIndexToWebPath(index: number): string {
  const safe = Math.max(0, Math.min(index, Math.max(0, TUTORIAL_SLIDE_COUNT - 1)))
  return `/tutorial/${safe + 1}`
}

export function parseTutorialIndexFromPathname(pathname: string): number | null {
  const parts = splitPathname(pathname)
  if (parts[0] !== 'tutorial') return null
  if (parts.length >= 2) {
    const raw = Number(parts[1])
    if (Number.isFinite(raw)) {
      const zeroBased = Math.floor(raw) - 1
      return Math.max(0, Math.min(zeroBased, Math.max(0, TUTORIAL_SLIDE_COUNT - 1)))
    }
  }
  return 0
}

export function screenToWebPath(screen: string): string {
  switch (screen) {
    case 'splash':
      return '/splash'
    case 'home':
      return '/home'
    case 'videoList':
      return '/videos'
    case 'cast':
      return '/cast'
    case 'castSearchResult':
      return '/cast-result'
    case 'search':
      return '/search'
    case 'work':
      return '/work-search'
    case 'mypage':
      return '/mypage'
    case 'castProfileRegister':
      return '/cast-profile-register'
    case 'profileEdit':
      return '/profile-edit'
    case 'profileRegister':
      return '/profile-register'
    case 'welcome':
      return '/welcome'
    case 'login':
      return '/login'
    case 'tutorial':
      return '/tutorial/1'
    case 'terms':
      return '/terms'
    case 'privacy':
      return '/privacy'
    case 'subscription':
      return '/subscription'
    case 'coinPurchase':
      return '/coin-purchase'
    case 'coinGrant':
      return '/coin-grant'
    case 'coinGrantComplete':
      return '/coin-grant-complete'
    case 'coinExchangeDest':
      return '/coin-exchange'
    case 'coinExchangePayPay':
      return '/coin-exchange/paypay'
    case 'coinExchangeComplete':
      return '/coin-exchange/complete'
    case 'comment':
      return '/comment'
    case 'signup':
      return '/signup'
    case 'emailVerify':
      return '/email-verify'
    case 'emailChangeStart':
      return '/email-change'
    case 'emailChangeVerify':
      return '/email-change/verify'
    case 'sms2fa':
      return '/sms-2fa'
    case 'registerComplete':
      return '/register-complete'
    case 'phone':
      return '/phone'
    case 'otp':
      return '/otp'
    case 'phoneChange':
      return '/phone-change'
    case 'ranking':
      return '/ranking'
    case 'favorites':
      return '/favorites'
    case 'favoriteVideos':
      return '/favorites/videos'
    case 'favoriteCasts':
      return '/favorites/casts'
    case 'favoriteCastsEdit':
      return '/favorites/casts/edit'
    case 'watchHistory':
      return '/watch-history'
    case 'settings':
      return '/settings'
    case 'withdrawalRequest':
      return '/withdrawal'
    case 'logout':
      return '/logout'
    case 'notice':
      return '/notice'
    case 'noticeDetail':
      return '/notice-detail'
    case 'contact':
      return '/contact'
    case 'faq':
      return '/faq'
    case 'profile':
      return '/profile'
    case 'castReview':
      return '/cast-review'
    case 'workReview':
      return '/work-review'
    case 'workDetail':
      return '/work'
    case 'videoPlayer':
      return '/play'
    case 'top':
      return '/debug'
    case 'dev':
      return '/dev'
    default:
      return '/welcome'
  }
}

export function videoPlayerToWebUrl(params: { workId: string; episodeId?: string | null }): string {
  const workId = String(params.workId || '').trim()
  const episodeId = String(params.episodeId || '').trim()
  const qs = new URLSearchParams()
  if (workId) qs.set('workId', workId)
  if (episodeId) qs.set('episodeId', episodeId)
  const q = qs.toString()
  return q ? `/play?${q}` : '/play'
}

export function workDetailToWebUrl(params: { workId?: string | null; episodeId?: string | null }): string {
  const workId = String(params.workId || '').trim()
  const episodeId = String(params.episodeId || '').trim()
  const qs = new URLSearchParams()
  if (workId) qs.set('workId', workId)
  if (episodeId) qs.set('episodeId', episodeId)
  const q = qs.toString()
  return q ? `/work?${q}` : '/work'
}

export function webPathnameToScreen(pathname: string): string {
  const parts = splitPathname(pathname)
  if (parts.length === 0) return 'splash'

  // Handle nested routes first.
  if (parts[0] === 'favorites') {
    if (parts[1] === 'videos') return 'favoriteVideos'
    if (parts[1] === 'casts' && parts[2] === 'edit') return 'favoriteCastsEdit'
    if (parts[1] === 'casts') return 'favoriteCasts'
    return 'favorites'
  }

  if (parts[0] === 'coin-exchange') {
    if (parts[1] === 'paypay') return 'coinExchangePayPay'
    if (parts[1] === 'complete') return 'coinExchangeComplete'
    return 'coinExchangeDest'
  }

  if (parts[0] === 'tutorial') return 'tutorial'
  if (parts[0] === 'work') return 'workDetail'
  if (parts[0] === 'play') return 'videoPlayer'

  switch (parts[0]) {
    case 'splash':
      return 'splash'
    case 'home':
      return 'home'
    case 'welcome':
      return 'welcome'
    case 'login':
      return 'login'
    case 'terms':
      return 'terms'
    case 'privacy':
      return 'privacy'
    case 'subscription':
      return 'subscription'
    case 'coin-purchase':
      return 'coinPurchase'
    case 'coin-grant':
      return 'coinGrant'
    case 'coin-grant-complete':
      return 'coinGrantComplete'
    case 'comment':
      return 'comment'
    case 'signup':
      return 'signup'
    case 'email-verify':
      return 'emailVerify'
    case 'email-change':
      // `email-change/verify` is represented as a screen id in-app.
      if (parts[1] === 'verify') return 'emailChangeVerify'
      return 'emailChangeStart'
    case 'sms-2fa':
      return 'sms2fa'
    case 'profile-register':
      return 'profileRegister'
    case 'register-complete':
      return 'registerComplete'
    case 'phone':
      return 'phone'
    case 'otp':
      return 'otp'
    case 'phone-change':
      return 'phoneChange'
    case 'videos':
      return 'videoList'
    case 'cast':
      return 'cast'
    case 'cast-result':
      return 'castSearchResult'
    case 'search':
      return 'search'
    case 'work-search':
      return 'work'
    case 'mypage':
      return 'mypage'
    case 'cast-profile-register':
      return 'castProfileRegister'
    case 'profile-edit':
      return 'profileEdit'
    case 'ranking':
      return 'ranking'
    case 'watch-history':
      return 'watchHistory'
    case 'settings':
      return 'settings'
    case 'withdrawal':
      return 'withdrawalRequest'
    case 'logout':
      return 'logout'
    case 'notice':
      return 'notice'
    case 'notice-detail':
      return 'noticeDetail'
    case 'contact':
      return 'contact'
    case 'faq':
      return 'faq'
    case 'profile':
      return 'profile'
    case 'cast-review':
      return 'castReview'
    case 'work-review':
      return 'workReview'
    case 'debug':
      return 'top'
    case 'dev':
      return 'dev'
    default:
      return 'welcome'
  }
}
