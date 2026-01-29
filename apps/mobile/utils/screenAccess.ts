import type { Screen } from '../App'

export type ScreenAccess = 'public' | 'loginRequired'

/**
 * Centralized access control for screen-level navigation.
 *
 * Requirements (2026-01-30):
 * - When an anonymous user accesses a login-required screen (direct URL or in-app link), redirect to Login.
 * - Cast discovery screens (e.g. /cast) and cast detail must be viewable without login.
 *
 * NOTE:
 * - “Public screen” here means the screen itself can be opened anonymously.
 *   Individual actions inside a screen may still require login/subscription.
 */

// Cast detail: must remain public.
// `profile` corresponds to `/profile` and `/profile/:castId`.
export const PUBLIC_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  'splash',
  'home',
  'welcome',
  'login',
  'tutorial',
  'terms',
  'privacy',
  'signup',
  'registerComplete',
  'phone',
  'otp',
  'videoList',
  'cast',
  'castRanking',
  'castSearchResult',
  'search',
  'work',
  'workDetail',
  'ranking',
  'contact',
  'faq',
  'notice',
  'noticeDetail',
  'profile',
  'top',
  'dev',
 ])

// Login-required screens (anonymous should be redirected to `login`).
// This list is intentionally explicit to keep behavior obvious.
export const LOGIN_REQUIRED_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  // 認証・パスワード系（ログイン後フロー）
  'emailVerify',
  'emailChangeStart',
  'emailChangeVerify',
  'phoneChange',
  'sms2fa',

  // 視聴・課金（サブスク）
  'subscription',
  'videoPlayer',

  // コメント投稿（画面遷移自体を匿名で不可にする）
  'comment',

  // キャスト応援（コイン付与）
  'coinGrant',
  'coinGrantComplete',
  'coinPurchase',
  'coinExchangeDest',
  'coinExchangePayPay',
  'coinExchangeComplete',

  // マイページ配下
  'mypage',
  'profileEdit',
  'castProfileRegister',
  'favorites',
  'favoriteVideos',
  'favoriteCasts',
  'favoriteCastsEdit',
  'watchHistory',
  'settings',
  'withdrawalRequest',
  'logout',

  // レビュー投稿系（匿名不可）
  'castReview',
  'workReview',
 ])

export function getScreenAccess(screen: Screen): ScreenAccess {
  if (LOGIN_REQUIRED_SCREENS.has(screen)) return 'loginRequired'
  return 'public'
}

export function isLoginRequiredScreen(screen: Screen): boolean {
  return getScreenAccess(screen) === 'loginRequired'
}
