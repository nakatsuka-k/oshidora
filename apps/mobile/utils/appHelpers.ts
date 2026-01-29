import { Platform } from 'react-native'
import type { Screen } from '../App'
import { THEME } from '../components'

export function screenToDocumentTitle(
  screen: Screen,
  opts?: { tutorialIndex?: number; tutorialCount?: number }
): string {
  const base = '推しドラ'
  switch (screen) {
    case 'splash':
      return base
    case 'welcome':
      return base
    case 'login':
      return `${base} | ログイン`
    case 'tutorial':
      if (typeof opts?.tutorialIndex === 'number' && typeof opts?.tutorialCount === 'number') {
        return `${base} | チュートリアル (${opts.tutorialIndex + 1}/${opts.tutorialCount})`
      }
      return `${base} | チュートリアル`
    case 'terms':
      return `${base} | 利用規約`
    case 'privacy':
      return `${base} | プライバシーポリシー`
    case 'subscription':
      return `${base} | サブスク会員`
    case 'coinPurchase':
      return `${base} | コイン購入`
    case 'coinGrant':
      return `${base} | 推しポイント付与`
    case 'coinGrantComplete':
      return `${base} | コイン付与完了`
    case 'coinExchangeDest':
      return `${base} | コイン換金`
    case 'coinExchangePayPay':
      return `${base} | コイン換金`
    case 'coinExchangeComplete':
      return `${base} | コイン換金`
    case 'comment':
      return `${base} | コメント`
    case 'signup':
      return `${base} | 新規登録`
    case 'emailVerify':
      return `${base} | メール認証`
    case 'emailChangeStart':
      return `${base} | メール変更`
    case 'emailChangeVerify':
      return `${base} | メール変更（認証）`
    case 'sms2fa':
      return `${base} | SMS認証`
    case 'profileRegister':
      return `${base} | プロフィール登録`
    case 'registerComplete':
      return `${base} | 登録完了`
    case 'phone':
      return `${base} | SMS認証（電話番号）`
    case 'otp':
      return `${base} | 2段階認証`
    case 'phoneChange':
      return `${base} | 電話番号変更（SMS認証）`
    case 'home':
      return `${base} | トップ`
    case 'videoList':
      return `${base} | 動画一覧`
    case 'cast':
      return `${base} | キャスト`
    case 'search':
      return `${base} | 検索`
    case 'work':
      return `${base} | 作品から探す`
    case 'mypage':
      return `${base} | マイページ`
    case 'castProfileRegister':
      return `${base} | キャストプロフィール登録`
    case 'ranking':
      return `${base} | ランキング`
    case 'favorites':
      return `${base} | お気に入り`
    case 'favoriteVideos':
      return `${base} | お気に入り（動画）`
    case 'favoriteCasts':
      return `${base} | お気に入り（キャスト）`
    case 'favoriteCastsEdit':
      return `${base} | お気に入りキャスト 編集`
    case 'watchHistory':
      return `${base} | 視聴履歴`
    case 'settings':
      return `${base} | 設定`
    case 'withdrawalRequest':
      return `${base} | 退会申請`
    case 'logout':
      return `${base} | ログアウト`
    case 'notice':
      return `${base} | お知らせ`
    case 'noticeDetail':
      return `${base} | お知らせ詳細`
    case 'contact':
      return `${base} | お問い合わせ`
    case 'faq':
      return `${base} | よくある質問`
    case 'profile':
      return `${base} | プロフィール`
    case 'castReview':
      return `${base} | 評価`
    case 'workReview':
      return `${base} | 評価`
    case 'workDetail':
      return `${base} | 作品詳細`
    case 'videoPlayer':
      return `${base} | 動画表示`
    case 'dev':
      return `${base} | Developer`
    case 'top':
      return `${base} | Debug`
    default:
      return base
  }
}

export function isValidEmail(value: string) {
  const email = value.trim()
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function defaultApiBaseUrl() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1'
      if (isLocalhost) return 'http://localhost:8787'
    }
    return 'https://api.oshidra.com'
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787'
  return 'http://127.0.0.1:8787'
}

export function resolveShareAppBaseUrl(apiBaseUrl?: string): string | null {
  // Prefer an explicit public web entrypoint when available.
  const env = (process.env.EXPO_PUBLIC_WEB_BASE_URL || '').trim()
  if (env) {
    return env.split('#')[0].replace(/\/$/, '')
  }

  // For web builds, default to the current web origin (not the API origin).
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '')
  }

  // As a last resort (e.g., native dev), use the API base host but still use hash routes.
  const fallback = (apiBaseUrl || '').trim().replace(/\/$/, '')
  return fallback ? fallback : null
}

export function ensureWebDocumentBackground() {
  if (Platform.OS !== 'web') return
  const doc = (globalThis as any).document
  if (!doc) return
  try {
    if (doc.documentElement?.style) doc.documentElement.style.backgroundColor = THEME.bg
    if (doc.body?.style) doc.body.style.backgroundColor = THEME.bg
  } catch {
    // ignore
  }
}
