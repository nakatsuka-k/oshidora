import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import {
  Chip,
  IconButton,
  PaginationDots,
  PrimaryButton,
  RowItem,
  ScreenContainer,
  SecondaryButton,
  Section,
  Slideshow,
  THEME,
} from './components'

import {
  DeveloperMenuScreen,
  EmailVerifyScreen,
  RegisterCompleteScreen,
  SignupScreen,
  Sms2faScreen,
  TabbedPlaceholderScreen,
  TermsScreen,
  TutorialScreen,
  TopScreen,
  VideoListScreen,
  WelcomeTopScreen,
  PrivacyPolicyScreen,
  PaidVideoPurchaseScreen,
  CommentPostScreen,
  VideoPlayerScreen,
  StaffCastReviewScreen,
  CastSearchScreen,
  VideoSearchScreen,
  CastSearchResultScreen,
  MyPageScreen,
  UserProfileEditScreen,
} from './screens'

import { setBoolean, getString, setString } from './utils/storage'

type Oshi = {
  id: string
  name: string
  created_at: string
}

type Screen =
  | 'home'
  | 'welcome'
  | 'login'
  | 'tutorial'
  | 'terms'
  | 'privacy'
  | 'purchase'
  | 'comment'
  | 'signup'
  | 'emailVerify'
  | 'sms2fa'
  | 'registerComplete'
  | 'videoList'
  | 'cast'
  | 'castSearchResult'
  | 'search'
  | 'mypage'
  | 'profileEdit'
  | 'ranking'
  | 'favorites'
  | 'notice'
  | 'phone'
  | 'otp'
  | 'top'
  | 'dev'
  | 'profile'
  | 'castReview'
  | 'workDetail'
  | 'videoPlayer'

const WEB_DEFAULT_SCREEN: Screen = 'welcome'

const TUTORIAL_SLIDE_COUNT = 3

function screenToWebHash(screen: Screen): string {
  switch (screen) {
    case 'home':
      return '#/home'
    case 'videoList':
      return '#/videos'
    case 'cast':
      return '#/cast'
    case 'castSearchResult':
      return '#/cast-result'
    case 'search':
      return '#/search'
    case 'mypage':
      return '#/mypage'
    case 'profileEdit':
      return '#/profile-edit'
    case 'welcome':
      return '#/welcome'
    case 'login':
      return '#/login'
    case 'tutorial':
      return '#/tutorial/1'
    case 'terms':
      return '#/terms'
    case 'privacy':
      return '#/privacy'
    case 'purchase':
      return '#/purchase'
    case 'comment':
      return '#/comment'
    case 'signup':
      return '#/signup'
    case 'emailVerify':
      return '#/email-verify'
    case 'sms2fa':
      return '#/sms-2fa'
    case 'registerComplete':
      return '#/register-complete'
    case 'phone':
      return '#/phone'
    case 'otp':
      return '#/otp'
    case 'ranking':
      return '#/ranking'
    case 'favorites':
      return '#/favorites'
    case 'notice':
      return '#/notice'
    case 'profile':
      return '#/profile'
    case 'castReview':
      return '#/cast-review'
    case 'workDetail':
      return '#/work'
    case 'videoPlayer':
      return '#/play'
    case 'top':
      return '#/debug'
    case 'dev':
      return '#/dev'
    default:
      return '#/welcome'
  }
}

function tutorialIndexToWebHash(index: number): string {
  const safe = Math.max(0, Math.min(index, Math.max(0, TUTORIAL_SLIDE_COUNT - 1)))
  return `#/tutorial/${safe + 1}`
}

function parseTutorialIndexFromWebHash(hash: string): number | null {
  const value = (hash || '').trim()
  const path = value.startsWith('#') ? value.slice(1) : value
  if (!path.startsWith('/tutorial')) return null

  const parts = path.split('?')[0].split('/').filter(Boolean)
  // parts: ['tutorial', '2']
  if (parts.length >= 2) {
    const raw = Number(parts[1])
    if (Number.isFinite(raw)) {
      const zeroBased = Math.floor(raw) - 1
      return Math.max(0, Math.min(zeroBased, Math.max(0, TUTORIAL_SLIDE_COUNT - 1)))
    }
  }
  return 0
}

function webHashToScreen(hash: string): Screen {
  const value = (hash || '').trim()
  const raw = value.startsWith('#') ? value.slice(1) : value
  const path = raw.split('?')[0]

  switch (path) {
    case '/':
    case '/welcome':
      return 'welcome'
    case '/login':
      return 'login'
    case '/tutorial':
    case '/tutorial/':
      return 'tutorial'
    case '/terms':
      return 'terms'
    case '/privacy':
      return 'privacy'
    case '/purchase':
      return 'purchase'
    case '/comment':
      return 'comment'
    case '/signup':
      return 'signup'
    case '/email-verify':
      return 'emailVerify'
    case '/sms-2fa':
      return 'sms2fa'
    case '/register-complete':
      return 'registerComplete'
    case '/phone':
      return 'phone'
    case '/otp':
      return 'otp'
    case '/home':
      return 'home'
    case '/videos':
      return 'videoList'
    case '/cast':
      return 'cast'
    case '/cast-result':
      return 'castSearchResult'
    case '/search':
      return 'search'
    case '/mypage':
      return 'mypage'
    case '/profile-edit':
      return 'profileEdit'
    case '/ranking':
      return 'ranking'
    case '/favorites':
      return 'favorites'
    case '/notice':
      return 'notice'
    case '/profile':
      return 'profile'
    case '/cast-review':
      return 'castReview'
    case '/work':
      return 'workDetail'
    case '/play':
      return 'videoPlayer'
    case '/debug':
      return 'top'
    case '/dev':
      return 'dev'
    default:
      if (path.startsWith('/tutorial/')) return 'tutorial'
      return WEB_DEFAULT_SCREEN
  }
}

function screenToDocumentTitle(
  screen: Screen,
  opts?: { tutorialIndex?: number; tutorialCount?: number }
): string {
  const base = '推しドラ'
  switch (screen) {
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
    case 'purchase':
      return `${base} | 購入確認`
    case 'comment':
      return `${base} | コメント`
    case 'signup':
      return `${base} | 新規登録`
    case 'emailVerify':
      return `${base} | メール認証`
    case 'sms2fa':
      return `${base} | SMS認証`
    case 'registerComplete':
      return `${base} | 登録完了`
    case 'phone':
      return `${base} | SMS認証（電話番号）`
    case 'otp':
      return `${base} | 2段階認証`
    case 'home':
      return `${base} | トップ`
    case 'videoList':
      return `${base} | 動画一覧`
    case 'cast':
      return `${base} | キャスト`
    case 'search':
      return `${base} | 検索`
    case 'mypage':
      return `${base} | マイページ`
    case 'ranking':
      return `${base} | ランキング`
    case 'favorites':
      return `${base} | お気に入り`
    case 'notice':
      return `${base} | お知らせ`
    case 'profile':
      return `${base} | プロフィール`
    case 'castReview':
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

function isValidEmail(value: string) {
  const email = value.trim()
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function defaultApiBaseUrl() {
  if (Platform.OS === 'web') return 'http://localhost:8787'
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787'
  return 'http://127.0.0.1:8787'
}

export default function App() {
  const TUTORIAL_SEEN_KEY = 'tutorial_seen_v1'

  const apiBaseUrl = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_API_BASE_URL
    return env && env.trim().length > 0 ? env.trim() : defaultApiBaseUrl()
  }, [])

  const expectedLoginEmail = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_LOGIN_EMAIL
    const value = env && env.trim().length > 0 ? env.trim() : 'test@example.com'
    return value.toLowerCase()
  }, [])

  const expectedLoginPassword = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_LOGIN_PASSWORD
    return env && env.trim().length > 0 ? env : 'password'
  }, [])

  const streamSampleVideoId = useMemo(() => {
    const env = process.env.EXPO_PUBLIC_CLOUDFLARE_STREAM_SAMPLE_VIDEO_ID
    return env && env.trim().length > 0 ? env.trim() : '367b90a85d2d8f745dc709d988dff07d'
  }, [])

  // Player context (AXCMS-PL-001)
  const [playerVideoIdNoSub, setPlayerVideoIdNoSub] = useState<string>('367b90a85d2d8f745dc709d988dff07d')
  const [playerVideoIdWithSub, setPlayerVideoIdWithSub] = useState<string | null>(null)

  const [screen, setScreen] = useState<Screen>('welcome')
  const [history, setHistory] = useState<Screen[]>([])

  const [postLoginTarget, setPostLoginTarget] = useState<Screen | null>(null)

  const [tutorialIndex, setTutorialIndex] = useState<number>(0)

  const [registerEmail, setRegisterEmail] = useState<string>('')
  const [registerPassword, setRegisterPassword] = useState<string>('')

  const goTo = useCallback((next: Screen) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = next === 'tutorial' ? tutorialIndexToWebHash(0) : screenToWebHash(next)
      return
    }

    setHistory((prev) => [...prev, screen])
    setScreen(next)
  }, [screen])

  const replaceWebHash = useCallback((hash: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    // Avoid growing history for tutorial swipes.
    try {
      window.history.replaceState(null, '', hash)
    } catch {
      window.location.hash = hash
    }
  }, [])

  const onTutorialIndexChange = useCallback((next: number) => {
    setTutorialIndex(next)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      replaceWebHash(tutorialIndexToWebHash(next))
    }
  }, [replaceWebHash])

  const goBack = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.location.hash = screenToWebHash(WEB_DEFAULT_SCREEN)
      }
      return
    }

    setHistory((prev) => {
      if (prev.length === 0) return prev
      const nextHistory = prev.slice(0, -1)
      const prevScreen = prev[prev.length - 1]
      setScreen(prevScreen)
      return nextHistory
    })
  }, [])

  const [health, setHealth] = useState<string>('')
  const [items, setItems] = useState<Oshi[]>([])
  const [name, setName] = useState<string>('')
  const [apiBusy, setApiBusy] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // Auth flow busy flag (login/phone/otp). Keep separate from apiBusy so auth buttons don't get disabled by
  // background health/data fetches on Pages production.
  const [authBusy, setAuthBusy] = useState<boolean>(false)

  const [loggedIn, setLoggedIn] = useState<boolean>(false)

  // Initialize login state from AsyncStorage and API
  useEffect(() => {
    const initializeLoginState = async () => {
      try {
        // Try to get login state from AsyncStorage first
        const savedState = await getString('dev_login_state')
        if (savedState !== null) {
          setLoggedIn(savedState === 'true')
          return
        }

        // If not saved, fetch from API
        const res = await fetch(`${apiBaseUrl}/v1/dev/login-state`)
        if (res.ok) {
          const data = (await res.json()) as { loggedIn: boolean }
          setLoggedIn(data.loggedIn)
          // Save to AsyncStorage
          await setString('dev_login_state', data.loggedIn ? 'true' : 'false')
        }
      } catch (e) {
        // Silently fail, default to false
      }
    }
    initializeLoginState()
  }, [apiBaseUrl])

  // Persist login state to AsyncStorage when it changes
  useEffect(() => {
    setString('dev_login_state', loggedIn ? 'true' : 'false')
  }, [loggedIn])

  useEffect(() => {
    // Guard for direct navigation (e.g. web hash) to login-required screens.
    if (loggedIn) return
    if (screen !== 'profile' && screen !== 'castReview' && screen !== 'comment') return

    setPostLoginTarget(screen)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = screenToWebHash('login')
      return
    }
    setHistory([])
    setScreen('login')
  }, [loggedIn, screen])

  const requireLogin = useCallback((next: Screen): boolean => {
    if (loggedIn) return true
    setPostLoginTarget(next)
    goTo('login')
    return false
  }, [goTo, loggedIn])

  type ApprovedComment = { id: string; author: string; body: string; createdAt?: string }

  const [approvedComments, setApprovedComments] = useState<ApprovedComment[]>([])
  const [commentsBusy, setCommentsBusy] = useState(false)
  const [commentsError, setCommentsError] = useState('')

  const switchTab = useCallback((key: 'home' | 'video' | 'cast' | 'search' | 'mypage') => {
    const next: Screen =
      key === 'home'
        ? 'home'
        : key === 'video'
          ? 'videoList'
          : key === 'cast'
            ? 'cast'
            : key === 'search'
              ? 'search'
              : 'mypage'

    // Access control: videos are public, cast list is public; cast profile/review/comment are login-required.

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = screenToWebHash(next)
      return
    }

    setHistory([])
    setScreen(next)
  }, [goTo, loggedIn])

  const [debugDotsIndex, setDebugDotsIndex] = useState<number>(0)
  const [debugSlideIndex, setDebugSlideIndex] = useState<number>(0)

  const mockProfile = useMemo(
    () => ({
      id: 'cast-1',
      name: '松岡美沙',
      affiliation: 'フリーランス',
      genre: ['女優'],
      biography:
        '生年月日：1998年11月29日\n神奈川県出身\n趣味：映画・アニメ鑑賞・カフェ巡り\n特技：ダンス・歌',
      worksText:
        '・ダウトコール\n・ミステリーX\n・ラブストーリーY',
      snsLinks: [
        { label: 'X', url: 'https://x.com/' },
        { label: 'Instagram', url: 'https://www.instagram.com/' },
      ],
      selfPr:
        '作品の世界観を大切に、観る人の心に残るお芝居を目指しています。応援よろしくお願いします。',
    }),
    []
  )

  const [selectedCast, setSelectedCast] = useState<{ id: string; name: string; roleLabel?: string } | null>(null)
  const [castReviews, setCastReviews] = useState<Record<string, { rating: number; comment: string; updatedAt: number }>>({})

  const [castSearchKeyword, setCastSearchKeyword] = useState<string>('')

  const selectedCastReview = useMemo(() => {
    if (!selectedCast) return null
    return castReviews[selectedCast.id] ?? null
  }, [castReviews, selectedCast])

  const mockWork = useMemo(
    () => ({
      id: 'content-1',
      title: 'ダウトコール',
      subtitle: 'あなた、浮気されてますよ。',
      tags: ['Drama', 'Mystery', 'Romance'],
      rating: 4.7,
      reviews: 128,
      story:
        '夫といつも通りの会話をしていると、突然スマホが鳴る。\nドキドキしながら手に取ると…「あなた、浮気されてますよ」\nと不気味な女から一言。\n\nそこから日々の調査は加速し、次々と“自分だけが知らない日常”が暴かれていく。\n結果として浮気しているのは誰なのか？浮気がばれてどんな復讐が待っているのか？',
      episodes: [
        { id: '01', title: '第01話', priceCoin: 0 },
        { id: '02', title: '第02話', priceCoin: 0 },
        { id: '03', title: '第03話', priceCoin: 30 },
      ],
      staff: [
        { role: '出演者', name: '松岡美沙' },
        { role: '出演者', name: '櫻井拓馬' },
        { role: '監督', name: '監督太郎' },
        { role: '制作プロダクション', name: 'Oshidora株式会社' },
      ],
    }),
    []
  )

  const shareUrlForWork = useCallback((contentId: string, videoIdNoSub: string) => {
    const base = apiBaseUrl.replace(/\/$/, '')
    // Use Cloudflare Stream thumbnail (public) for OG image when available.
    const thumb = `https://videodelivery.net/${encodeURIComponent(videoIdNoSub)}/thumbnails/thumbnail.jpg?time=1s`
    const u = new URL(`${base}/share/work/${encodeURIComponent(contentId)}`)
    u.searchParams.set('thumb', thumb)
    u.searchParams.set('title', mockWork.title)
    return u.toString()
  }, [apiBaseUrl, mockWork.title])

  const shareUrlForCast = useCallback((castId: string, castName: string) => {
    const base = apiBaseUrl.replace(/\/$/, '')
    const u = new URL(`${base}/share/cast/${encodeURIComponent(castId)}`)
    u.searchParams.set('title', castName)
    return u.toString()
  }, [apiBaseUrl])

  const mockApprovedComments = useMemo(
    () => [
      { id: 'c1', author: '匿名', body: 'めちゃくちゃ続きが気になる…！' },
      { id: 'c2', author: 'Misa', body: '演技が最高。表情の作り方がすごい。' },
      { id: 'c3', author: 'ユーザーA', body: 'BGMが良くて一気見しました。' },
      { id: 'c4', author: 'ユーザーB', body: 'ラストの展開が予想外で鳥肌…！！！' },
      { id: 'c5', author: 'ユーザーC', body: '好きなシーン何回も見返した。' },
      { id: 'c6', author: 'ユーザーD', body: '第3話から急に加速して面白い。' },
      { id: 'c7', author: 'ユーザーE', body: 'キャストが豪華。' },
      { id: 'c8', author: 'ユーザーF', body: '次回が待ちきれない。' },
      { id: 'c9', author: 'ユーザーG', body: '短いのに満足感ある。' },
      { id: 'c10', author: 'ユーザーH', body: '伏線回収が楽しみ。' },
      { id: 'c11', author: 'ユーザーI', body: '51文字以上のコメントは省略される仕様なので長めに書いてみます。これはテスト用の文章です。' },
    ],
    []
  )

  const [commentTarget, setCommentTarget] = useState<{ contentId: string; contentTitle: string } | null>(null)
  const [commentJustSubmitted, setCommentJustSubmitted] = useState(false)

  const [ownedCoins, setOwnedCoins] = useState<number>(20)

  const [purchasedTargets, setPurchasedTargets] = useState<Set<string>>(() => new Set())
  const [purchaseTarget, setPurchaseTarget] = useState<
    | {
        targetType: 'episode'
        targetId: string
        title: string
        requiredCoins: number
        contentTypeLabel: string
      }
    | null
  >(null)

  const truncateCommentBody = useCallback((value: string) => {
    const v = String(value ?? '')
    if (v.length <= 50) return v
    return `${v.slice(0, 50)}…`
  }, [])

  const hasPurchasedAnyEpisode = useMemo(() => {
    // コメント投稿は作品単位だが、現状のモック購入はエピソード単位のため「いずれか購入済み」で投稿可とする。
    for (const key of purchasedTargets) {
      if (key.startsWith('episode:')) return true
    }
    return false
  }, [purchasedTargets])

  const [loginEmail, setLoginEmail] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [loginFieldErrors, setLoginFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [loginBannerError, setLoginBannerError] = useState<string>('')

  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [phoneFieldError, setPhoneFieldError] = useState<string>('')
  const [phoneBannerError, setPhoneBannerError] = useState<string>('')

  const OTP_LENGTH = 6
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''))
  const [otpFieldError, setOtpFieldError] = useState<string>('')
  const [otpBannerError, setOtpBannerError] = useState<string>('')
  const otpRefs = useRef<Array<TextInput | null>>([])

  const checkHealth = useCallback(async () => {
    setError('')
    setApiBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/health`)
      const text = await res.text()
      setHealth(`${res.status} ${text}`)
    } catch (e) {
      setHealth('')
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApiBusy(false)
    }
  }, [apiBaseUrl])

  const fetchApprovedComments = useCallback(
    async (contentId: string) => {
      setCommentsBusy(true)
      setCommentsError('')
      try {
        const u = new URL(`${apiBaseUrl}/v1/comments`)
        u.searchParams.set('content_id', contentId)
        u.searchParams.set('limit', '50')
        const res = await fetch(u.toString())
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { items?: ApprovedComment[] }
        const items = Array.isArray(json.items) ? json.items : []
        setApprovedComments(items)
      } catch (e) {
        setApprovedComments([])
        setCommentsError(e instanceof Error ? e.message : String(e))
      } finally {
        setCommentsBusy(false)
      }
    },
    [apiBaseUrl]
  )

  useEffect(() => {
    if (screen !== 'workDetail') return
    void fetchApprovedComments(mockWork.id)
  }, [fetchApprovedComments, mockWork.id, screen])

  const loadOshi = useCallback(async () => {
    setError('')
    setApiBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/v1/oshi`)
      const json = (await res.json()) as { items: Oshi[] }
      setItems(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApiBusy(false)
    }
  }, [apiBaseUrl])

  const addOshi = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) return

    setError('')
    setApiBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/v1/oshi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${text}`)
      }
      setName('')
      await loadOshi()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApiBusy(false)
    }
  }, [apiBaseUrl, loadOshi, name])

  useEffect(() => {
    void (async () => {
      await checkHealth()
      await loadOshi()
    })()
  }, [checkHealth, loadOshi])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const syncFromHash = () => {
      const next = webHashToScreen(window.location.hash)
      if (next === 'tutorial') {
        const parsed = parseTutorialIndexFromWebHash(window.location.hash)
        if (typeof parsed === 'number') setTutorialIndex(parsed)
      }
      setHistory([])
      setScreen(next)
    }

    if (!window.location.hash) {
      window.location.hash = screenToWebHash(WEB_DEFAULT_SCREEN)
    } else {
      syncFromHash()
    }

    window.addEventListener('hashchange', syncFromHash)
    return () => {
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    document.title =
      screen === 'tutorial'
        ? screenToDocumentTitle(screen, { tutorialIndex, tutorialCount: TUTORIAL_SLIDE_COUNT })
        : screenToDocumentTitle(screen)
  }, [screen, tutorialIndex])

  const resetAuthErrors = useCallback(() => {
    setLoginFieldErrors({})
    setLoginBannerError('')
    setPhoneFieldError('')
    setPhoneBannerError('')
    setOtpFieldError('')
    setOtpBannerError('')
  }, [])

  const onCancel = useCallback(() => {
    resetAuthErrors()
    goBack()
  }, [goBack, resetAuthErrors])

  const canLoginNext = useMemo(() => {
    return isValidEmail(loginEmail) && loginPassword.trim().length > 0 && !authBusy
  }, [authBusy, loginEmail, loginPassword])

  const onLoginNext = useCallback(async () => {
    resetAuthErrors()
    const email = loginEmail.trim()
    const password = loginPassword

    const nextErrors: { email?: string; password?: string } = {}
    if (!email) nextErrors.email = 'メールアドレスを入力してください'
    else if (!isValidEmail(email)) nextErrors.email = 'メールアドレスの形式が正しくありません'
    if (!password.trim()) nextErrors.password = 'パスワードを入力してください'

    if (Object.keys(nextErrors).length > 0) {
      setLoginFieldErrors(nextErrors)
      return
    }

    setAuthBusy(true)
    try {
      // NOTE: 認証APIは設計書では仮パスのため、現状は画面遷移のみ実装。
      // 実APIに接続する場合はここで fetch を行い、失敗時は setLoginBannerError を設定してください。
      await new Promise((r) => setTimeout(r, 250))

      if (email.toLowerCase() !== expectedLoginEmail || password !== expectedLoginPassword) {
        setLoginBannerError('メールアドレスまたはパスワードが正しくありません')
        return
      }

      goTo('phone')
    } finally {
      setAuthBusy(false)
    }
  }, [expectedLoginEmail, expectedLoginPassword, goTo, loginEmail, loginPassword, resetAuthErrors])

  const normalizedPhoneDigits = useMemo(() => digitsOnly(phoneNumber), [phoneNumber])

  const canPhoneNext = useMemo(() => {
    const len = normalizedPhoneDigits.length
    return len >= 10 && len <= 20 && !authBusy
  }, [authBusy, normalizedPhoneDigits.length])

  const onPhoneNext = useCallback(async () => {
    resetAuthErrors()
    const digits = normalizedPhoneDigits
    if (!digits) {
      setPhoneFieldError('電話番号を入力してください')
      return
    }
    if (digits.length < 10 || digits.length > 20) {
      setPhoneFieldError('電話番号の桁数が正しくありません')
      return
    }

    setAuthBusy(true)
    try {
      // NOTE: SMS送信APIは設計書では仮パスのため、現状は画面遷移のみ実装。
      await new Promise((r) => setTimeout(r, 250))

      if (digits.endsWith('0000')) {
        setPhoneBannerError('SMSの送信に失敗しました。時間をおいて再度お試しください。')
        return
      }

      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''))
      goTo('otp')
      setTimeout(() => otpRefs.current[0]?.focus?.(), 50)
    } finally {
      setAuthBusy(false)
    }
  }, [OTP_LENGTH, goTo, normalizedPhoneDigits, resetAuthErrors])

  const otpValue = useMemo(() => otpDigits.join(''), [otpDigits])
  const otpComplete = useMemo(() => otpValue.length === OTP_LENGTH && !otpValue.includes(''), [OTP_LENGTH, otpValue])
  const canOtpNext = useMemo(
    () => otpValue.length === OTP_LENGTH && otpDigits.every((d) => d.length === 1) && !authBusy,
    [OTP_LENGTH, authBusy, otpDigits, otpValue.length]
  )

  const setOtpAt = useCallback((index: number, value: string) => {
    const digit = digitsOnly(value).slice(-1)
    setOtpDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus?.()
    }
  }, [OTP_LENGTH])

  const onOtpKeyPress = useCallback((index: number, key: string) => {
    if (key !== 'Backspace') return
    setOtpDigits((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = ''
      } else if (index > 0) {
        next[index - 1] = ''
        setTimeout(() => otpRefs.current[index - 1]?.focus?.(), 0)
      }
      return next
    })
  }, [])

  const onOtpNext = useCallback(async () => {
    resetAuthErrors()
    const code = otpDigits.join('')
    if (!otpDigits.every((d) => d.length === 1)) {
      setOtpFieldError('認証コードを入力してください')
      return
    }

    setAuthBusy(true)
    try {
      // NOTE: 認証コード検証APIは設計書では仮パスのため、現状は画面遷移のみ実装。
      await new Promise((r) => setTimeout(r, 250))

      if (code === '000000') {
        setOtpBannerError('認証コードが正しくありません')
        return
      }

      setLoggedIn(true)
      setHistory([])
      setScreen(postLoginTarget ?? 'home')
      setPostLoginTarget(null)
    } finally {
      setAuthBusy(false)
    }
  }, [otpDigits, postLoginTarget, resetAuthErrors])

  return (
    <SafeAreaView style={styles.safeArea}>
      {screen === 'welcome' ? (
        <WelcomeTopScreen
          onLogin={() => goTo('login')}
          onStart={() => {
            setTutorialIndex(0)
            goTo('tutorial')
          }}
        />
      ) : null}

      {screen === 'tutorial' ? (
        <TutorialScreen
          initialIndex={tutorialIndex}
          onIndexChange={onTutorialIndexChange}
          onBack={goBack}
          onSkip={() => {
            void setBoolean(TUTORIAL_SEEN_KEY, true)
            goTo('terms')
          }}
          onDone={() => {
            void setBoolean(TUTORIAL_SEEN_KEY, true)
            goTo('terms')
          }}
        />
      ) : null}

      {screen === 'terms' ? (
        <TermsScreen
          onBack={goBack}
          onAgreeRegister={() => goTo('signup')}
          onOpenPrivacyPolicy={() => goTo('privacy')}
        />
      ) : null}

      {screen === 'privacy' ? (
        <PrivacyPolicyScreen onBack={goBack} />
      ) : null}

      {screen === 'login' ? (
        <ScreenContainer title="ログイン" maxWidth={520}>
          <View style={styles.authCenter}>
            <View style={styles.authContent}>
              <View style={styles.authTop}>
                <View style={styles.authLogoWrap}>
                  <Image
                    source={require('./assets/oshidora-logo.png')}
                    style={styles.authLogo}
                    resizeMode="contain"
                  />
                </View>

                {loginBannerError ? <Text style={styles.bannerError}>{loginBannerError}</Text> : null}

                <View style={styles.field}>
                  <TextInput
                    value={loginEmail}
                    onChangeText={(v) => setLoginEmail(v)}
                    placeholder="メールアドレス"
                    placeholderTextColor={THEME.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={[styles.input, loginFieldErrors.email ? styles.inputError : null]}
                  />
                  {loginFieldErrors.email ? <Text style={styles.fieldError}>{loginFieldErrors.email}</Text> : null}
                </View>

                <View style={styles.field}>
                  <TextInput
                    value={loginPassword}
                    onChangeText={(v) => setLoginPassword(v)}
                    placeholder="パスワード"
                    placeholderTextColor={THEME.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    style={[styles.input, loginFieldErrors.password ? styles.inputError : null]}
                  />
                  {loginFieldErrors.password ? (
                    <Text style={styles.fieldError}>{loginFieldErrors.password}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.authBottom}>
                <View style={styles.buttons}>
                  <View style={styles.buttonRow}>
                    <SecondaryButton label="キャンセル" onPress={onCancel} disabled={authBusy} />
                    <View style={styles.spacer} />
                    <PrimaryButton label="次へ" onPress={onLoginNext} disabled={!canLoginNext} fullWidth={false} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'signup' ? (
        <SignupScreen
          onBack={goBack}
          onLogin={() => goTo('login')}
          onSendCode={async (email, password) => {
            setRegisterEmail(email)
            setRegisterPassword(password)
            await new Promise((r) => setTimeout(r, 250))
            if (email.toLowerCase().endsWith('@fail.example')) {
              throw new Error('認証コードの送信に失敗しました')
            }
            goTo('emailVerify')
          }}
        />
      ) : null}

      {screen === 'emailVerify' ? (
        <EmailVerifyScreen
          email={registerEmail}
          onBack={goBack}
          onResend={async () => {
            await new Promise((r) => setTimeout(r, 250))
            if (!registerEmail) throw new Error('メールアドレスが不明です')
          }}
          onVerify={async (code) => {
            await new Promise((r) => setTimeout(r, 250))
            if (code === '000000') throw new Error('認証コードが正しくありません')
            goTo('sms2fa')
          }}
        />
      ) : null}

      {screen === 'sms2fa' ? (
        <Sms2faScreen
          onBack={goBack}
          onComplete={() => {
            goTo('registerComplete')
          }}
        />
      ) : null}

      {screen === 'registerComplete' ? (
        <RegisterCompleteScreen
          onGoVideos={() => {
            setLoggedIn(true)
            setHistory([])
            setScreen(postLoginTarget ?? 'home')
            setPostLoginTarget(null)
          }}
        />
      ) : null}

      {screen === 'videoList' ? (
        <VideoListScreen apiBaseUrl={apiBaseUrl} onPressTab={switchTab} onOpenVideo={() => goTo('workDetail')} />
      ) : null}

      {screen === 'home' ? (
        <TopScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenVideo={() => goTo('workDetail')}
          onOpenRanking={() => goTo('ranking')}
          onOpenFavorites={() => goTo('favorites')}
          onOpenNotice={() => goTo('notice')}
        />
      ) : null}

      {screen === 'cast' ? (
        <CastSearchScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenProfile={(cast) => {
            if (!requireLogin('profile')) return
            setSelectedCast({ id: cast.id, name: cast.name, roleLabel: cast.role })
            goTo('profile')
          }}
          onOpenResults={(keyword) => {
            setCastSearchKeyword(keyword)
            goTo('castSearchResult')
          }}
        />
      ) : null}

      {screen === 'castSearchResult' ? (
        <CastSearchResultScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          keyword={castSearchKeyword}
          onBack={() => {
            goBack()
          }}
          onOpenProfile={(cast) => {
            if (!requireLogin('profile')) return
            setSelectedCast({ id: cast.id, name: cast.name, roleLabel: cast.role })
            goTo('profile')
          }}
        />
      ) : null}

      {screen === 'search' ? (
        <VideoSearchScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          onOpenVideo={() => goTo('workDetail')}
          onOpenProfile={(cast) => {
            if (!requireLogin('profile')) return
            setSelectedCast({ id: cast.id, name: cast.name, roleLabel: cast.role })
            goTo('profile')
          }}
        />
      ) : null}

      {screen === 'mypage' ? (
        <MyPageScreen
          apiBaseUrl={apiBaseUrl}
          onPressTab={switchTab}
          loggedIn={loggedIn}
          userEmail={loginEmail || registerEmail}
          userType="user"
          onNavigate={(screenKey) => {
            goTo(screenKey as Screen)
          }}
        />
      ) : null}

      {screen === 'profileEdit' ? (
        <UserProfileEditScreen
          onBack={goBack}
          initialEmail={loginEmail || registerEmail}
          onSave={async (opts) => {
            // TODO: Save profile to API
            console.log('Profile saved:', opts)
          }}
        />
      ) : null}

      {screen === 'ranking' ? (
        <ScreenContainer title="ランキング一覧" onBack={goBack} maxWidth={520}>
          <Text style={styles.centerText}>ランキング一覧（モック）</Text>
        </ScreenContainer>
      ) : null}

      {screen === 'favorites' ? (
        <ScreenContainer title="お気に入り一覧" onBack={goBack} maxWidth={520}>
          <Text style={styles.centerText}>お気に入り一覧（モック）</Text>
        </ScreenContainer>
      ) : null}

      {screen === 'notice' ? (
        <ScreenContainer title="お知らせ" onBack={goBack} maxWidth={520}>
          <Text style={styles.centerText}>お知らせ詳細（モック）</Text>
        </ScreenContainer>
      ) : null}

      {screen === 'phone' ? (
        <ScreenContainer title="SMS認証" onBack={goBack} maxWidth={520}>

          {phoneBannerError ? <Text style={styles.bannerError}>{phoneBannerError}</Text> : null}

          <View style={styles.field}>
            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="電話番号"
              keyboardType="phone-pad"
              autoCapitalize="none"
              style={[styles.input, phoneFieldError ? styles.inputError : null]}
            />
            {phoneFieldError ? <Text style={styles.fieldError}>{phoneFieldError}</Text> : null}
          </View>

          <View style={styles.buttons}>
            <View style={styles.buttonRow}>
              <SecondaryButton label="キャンセル" onPress={onCancel} disabled={authBusy} />
              <View style={styles.spacer} />
              <PrimaryButton label="次へ" onPress={onPhoneNext} disabled={!canPhoneNext} fullWidth={false} />
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'otp' ? (
        <ScreenContainer title="2段階認証" onBack={goBack} maxWidth={520}>
          <Text style={styles.centerText}>電話番号(SMS)に送信された認証コードを入力して下さい</Text>

          {otpBannerError ? <Text style={styles.bannerError}>{otpBannerError}</Text> : null}

          <View style={styles.otpRow}>
            {otpDigits.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(el) => {
                  otpRefs.current[idx] = el
                }}
                value={digit}
                onChangeText={(v) => setOtpAt(idx, v)}
                onKeyPress={({ nativeEvent }) => onOtpKeyPress(idx, nativeEvent.key)}
                keyboardType="number-pad"
                autoCapitalize="none"
                maxLength={1}
                style={[styles.otpInput, otpFieldError ? styles.inputError : null]}
              />
            ))}
          </View>

          {otpFieldError ? <Text style={styles.fieldErrorCenter}>{otpFieldError}</Text> : null}

          <View style={styles.buttons}>
            <View style={styles.buttonRow}>
              <SecondaryButton label="キャンセル" onPress={onCancel} disabled={authBusy} />
              <View style={styles.spacer} />
              <PrimaryButton label="次へ" onPress={onOtpNext} disabled={!canOtpNext} fullWidth={false} />
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'top' ? (
        <ScreenContainer title="推しドラ" maxWidth={520}>
          <View style={styles.header}>
            <Text style={styles.sub}>API: {apiBaseUrl}</Text>
            {health ? <Text style={styles.sub}>Health: {health}</Text> : null}
            {error ? <Text style={styles.error}>Error: {error}</Text> : null}
            {!loggedIn ? (
              <View style={styles.topLoginRow}>
                <PrimaryButton label="ログイン" onPress={() => goTo('login')} />
              </View>
            ) : null}
            <View style={styles.topNavRow}>
              <SecondaryButton label="プロフィール(ワイヤー)" onPress={() => goTo('profile')} />
              <View style={styles.spacer} />
              <SecondaryButton label="作品詳細(ワイヤー)" onPress={() => goTo('workDetail')} />
              <View style={styles.spacer} />
              <SecondaryButton label="Developer" onPress={() => goTo('dev')} />
            </View>
          </View>

          <View style={styles.row}>
            <SecondaryButton label="Health" onPress={checkHealth} />
            <View style={styles.spacer} />
            <SecondaryButton label="Reload" onPress={loadOshi} />
          </View>

          <View style={styles.header}>
            <Text style={styles.sub}>Components</Text>
            <Text style={styles.sub}>PaginationDots: {debugDotsIndex + 1}/5</Text>
          </View>
          <PaginationDots count={5} index={debugDotsIndex} onChange={setDebugDotsIndex} />

          <View style={styles.header}>
            <Text style={styles.sub}>Slideshow: {debugSlideIndex + 1}/3</Text>
          </View>
          <Slideshow
            images={[
              require('./assets/tutorial0.png'),
              require('./assets/tutorial1.png'),
              require('./assets/tutorial2.png'),
            ]}
            height={220}
            index={debugSlideIndex}
            onIndexChange={setDebugSlideIndex}
            resizeMode="cover"
          />

          <View style={styles.row}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="推しの名前"
              placeholderTextColor={THEME.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.spacer} />
            <PrimaryButton
              label="Add"
              onPress={addOshi}
              disabled={apiBusy || name.trim().length === 0}
              fullWidth={false}
            />
          </View>

          {apiBusy ? <ActivityIndicator style={styles.loading} /> : null}

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>{item.created_at}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.sub}>まだ登録がありません</Text>}
          />
        </ScreenContainer>
      ) : null}

      {screen === 'dev' ? (
        <DeveloperMenuScreen
          onBack={goBack}
          onGo={(key) => {
            goTo(key as Screen)
          }}
          loggedIn={loggedIn}
          onLoginToggle={async () => {
            const next = !loggedIn
            try {
              const res = await fetch(`${apiBaseUrl}/v1/dev/login-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loggedIn: next }),
              })
              if (res.ok) {
                setLoggedIn(next)
              }
            } catch (e) {
              // fallback: toggle locally even if request fails
              setLoggedIn(next)
            }
          }}
        />
      ) : null}

      {screen === 'profile' ? (
        <ScreenContainer title="プロフィール" onBack={goBack} scroll maxWidth={520}>

          <View style={styles.heroImage}>
            <View style={styles.heroPlaceholder} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.h1}>{selectedCast?.name ?? mockProfile.name}</Text>
            <Text style={styles.h2}>{mockProfile.affiliation || '—'}</Text>
          </View>

          <View style={styles.chipsWrap}>
            {mockProfile.genre.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>★ {selectedCastReview ? selectedCastReview.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{selectedCastReview ? '1件' : '0件'}</Text>
          </View>

          <View style={styles.actionsRow}>
            <IconButton
              label="↗"
              onPress={async () => {
                if (!requireLogin('profile')) return
                const castId = selectedCast?.id ?? mockProfile.id
                const castName = selectedCast?.name ?? mockProfile.name
                const url = shareUrlForCast(castId, castName)
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.open(url, '_blank', 'noopener,noreferrer')
                  return
                }
                const { Share } = await import('react-native')
                await Share.share({ message: `${castName}\n${url}`, url })
              }}
            />
            <View style={styles.spacer} />
            <IconButton
              label="★"
              onPress={() => {
                if (!requireLogin('castReview')) return
                goTo('castReview')
              }}
            />
          </View>

          <Section title="経歴">
            <Text style={styles.bodyText}>{mockProfile.biography || '—'}</Text>
          </Section>

          <Section title="代表作">
            <Text style={styles.bodyText}>{mockProfile.worksText || '—'}</Text>
          </Section>

          <Section title="自己PR">
            <Text style={styles.bodyText}>{mockProfile.selfPr || '—'}</Text>
          </Section>

          <Section title="SNS">
            {mockProfile.snsLinks.length === 0 ? (
              <Text style={styles.bodyText}>—</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {mockProfile.snsLinks.map((l) => (
                  <Pressable
                    key={l.label}
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.open(l.url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: THEME.outline, backgroundColor: THEME.card }}
                  >
                    <Text style={{ color: THEME.text, fontSize: 12, fontWeight: '800' }}>{l.label}</Text>
                    <Text style={{ color: THEME.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{l.url}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>
        </ScreenContainer>
      ) : null}

      {screen === 'castReview' && selectedCast ? (
        <StaffCastReviewScreen
          onBack={goBack}
          cast={{ id: selectedCast.id, name: selectedCast.name, roleLabel: selectedCast.roleLabel }}
          initial={{ rating: selectedCastReview?.rating ?? null, comment: selectedCastReview?.comment ?? null }}
          onSubmit={async ({ castId, rating, comment }) => {
            await new Promise((r) => setTimeout(r, 300))
            setCastReviews((prev) => ({
              ...prev,
              [castId]: { rating, comment, updatedAt: Date.now() },
            }))
          }}
          onDone={() => {
            goTo('profile')
          }}
        />
      ) : null}

      {screen === 'workDetail' ? (
        <ScreenContainer title="作品詳細" onBack={goBack} scroll maxWidth={520}>

          <View style={styles.heroImage}>
            <Pressable
              onPress={() => {
                setPlayerVideoIdNoSub(streamSampleVideoId)
                setPlayerVideoIdWithSub(null)
                goTo('videoPlayer')
              }}
              style={StyleSheet.absoluteFill}
            >
              <View style={styles.heroPlaceholder}>
                <View style={styles.playBadge}>
                  <Text style={styles.playBadgeText}>▶ 再生</Text>
                </View>
              </View>
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.h1}>{mockWork.title || '—'}</Text>
            <Text style={styles.h2}>{mockWork.subtitle || '—'}</Text>
          </View>

          <View style={styles.chipsWrap}>
            {mockWork.tags.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>★ {mockWork.rating.toFixed(1)}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{mockWork.reviews} reviews</Text>
          </View>

          <Section title="ストーリー">
            <Text style={styles.bodyText}>{mockWork.story || '—'}</Text>
          </Section>

          <View style={styles.actionsRow}>
            <IconButton label="♡" onPress={() => {}} />
            <View style={styles.spacer} />
            <IconButton
              label="↗"
              onPress={async () => {
                const url = shareUrlForWork(mockWork.id, playerVideoIdNoSub)
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.open(url, '_blank', 'noopener,noreferrer')
                  return
                }
                const { Share } = await import('react-native')
                await Share.share({ message: `${mockWork.title}\n${url}`, url })
              }}
            />
          </View>
          <PrimaryButton label="本編を再生する" onPress={() => {}} />

          <Section title="エピソード">
            {mockWork.episodes.length === 0 ? (
              <Text style={styles.emptyText}>空です</Text>
            ) : (
              mockWork.episodes.map((e) => (
                (() => {
                  const key = `episode:${e.id}`
                  const requiredCoins = typeof (e as any).priceCoin === 'number' ? (e as any).priceCoin : 0
                  const purchased = purchasedTargets.has(key)
                  const isPaid = requiredCoins > 0
                  const action = isPaid && !purchased ? '購入' : '再生'

                  return (
                <RowItem
                  key={e.id}
                  title={`${e.id} ${e.title}`}
                  actionLabel={action}
                  onAction={() => {
                    if (isPaid && !purchased) {
                      setPurchaseTarget({
                        targetType: 'episode',
                        targetId: e.id,
                        title: `${mockWork.title} ${e.title}`,
                        requiredCoins,
                        contentTypeLabel: 'ショート',
                      })
                      goTo('purchase')
                      return
                    }
                    // TODO: 再生処理（未実装）
                  }}
                />
                  )
                })()
              ))
            )}
          </Section>

          <Section title="出演者・スタッフ">
            {mockWork.staff.length === 0 ? (
              <Text style={styles.emptyText}>空です</Text>
            ) : (
              mockWork.staff.map((s, idx) => (
                <RowItem
                  key={`${s.role}-${idx}`}
                  title={`${s.role}：${s.name}`}
                  actionLabel="詳しく"
                  onAction={() => {
                    if (!requireLogin('profile')) return
                    setSelectedCast({
                      id: `cast:${s.name}`,
                      name: s.name,
                      roleLabel: s.role,
                    })
                    goTo('profile')
                  }}
                />
              ))
            )}
          </Section>

          <Section
            title={`コメント（${(commentsError ? mockApprovedComments : approvedComments).length}件）`}
          >
            <View style={styles.commentsBox}>
              {commentsBusy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator />
                </View>
              ) : null}

              {commentsError ? <Text style={styles.loadNote}>取得に失敗しました（モック表示）</Text> : null}

              {(commentsError ? mockApprovedComments : approvedComments).slice(0, 10).map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor} numberOfLines={1} ellipsizeMode="tail">
                    {c.author}
                  </Text>
                  <Text style={styles.commentBody}>{truncateCommentBody(c.body)}</Text>
                </View>
              ))}

              {(commentsError ? mockApprovedComments : approvedComments).length > 10 ? (
                <Text style={styles.moreLink}>もっと見る</Text>
              ) : null}
            </View>

            {hasPurchasedAnyEpisode ? (
              <View style={styles.commentCtaWrap}>
                <View style={styles.fakeInput}>
                  <Text style={styles.fakeInputText}>コメントを書く</Text>
                </View>
                <PrimaryButton
                  label="コメントを書く"
                  onPress={() => {
                    setCommentJustSubmitted(false)
                    setCommentTarget({ contentId: mockWork.id, contentTitle: mockWork.title })
                    if (!requireLogin('comment')) return
                    goTo('comment')
                  }}
                />
              </View>
            ) : (
              <View style={styles.commentCtaWrap}>
                <View style={[styles.fakeInput, styles.fakeInputDisabled]}>
                  <Text style={[styles.fakeInputText, styles.fakeInputTextDisabled]}>購入するとコメントできます</Text>
                </View>
                <SecondaryButton
                  label="購入へ"
                  onPress={() => {
                    const paid = mockWork.episodes.find((e) => typeof (e as any).priceCoin === 'number' && (e as any).priceCoin > 0)
                    if (!paid) return
                    const requiredCoins = (paid as any).priceCoin as number
                    setPurchaseTarget({
                      targetType: 'episode',
                      targetId: paid.id,
                      title: `${mockWork.title} ${paid.title}`,
                      requiredCoins,
                      contentTypeLabel: 'ショート',
                    })
                    goTo('purchase')
                  }}
                />
              </View>
            )}

            {commentJustSubmitted ? (
              <Text style={styles.commentNotice}>
                ※ コメントは管理者の確認後に公開されます。{`\n`}反映までお時間がかかる場合があります。
              </Text>
            ) : null}
          </Section>
        </ScreenContainer>
      ) : null}

      {screen === 'comment' && commentTarget ? (
        <CommentPostScreen
          onBack={goBack}
          contentId={commentTarget.contentId}
          contentTitle={commentTarget.contentTitle}
          onSubmitted={async ({ contentId, body }) => {
            const trimmed = body.trim()
            if (!trimmed) throw new Error('コメントを入力してください')

            const author = (loginEmail.trim() || registerEmail.trim() || 'ユーザー').slice(0, 50)
            const res = await fetch(`${apiBaseUrl}/v1/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contentId, author, body: trimmed }),
            })
            if (!res.ok) {
              const msg = await res.text().catch(() => '')
              throw new Error(msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`)
            }
          }}
          onDone={() => {
            setCommentJustSubmitted(true)
            goTo('workDetail')
          }}
        />
      ) : null}

      {screen === 'purchase' && purchaseTarget ? (
        <PaidVideoPurchaseScreen
          onBack={goBack}
          targetType={purchaseTarget.targetType}
          targetId={purchaseTarget.targetId}
          title={purchaseTarget.title}
          contentTypeLabel={purchaseTarget.contentTypeLabel}
          requiredCoins={purchaseTarget.requiredCoins}
          ownedCoins={ownedCoins}
          purchased={purchasedTargets.has(`episode:${purchaseTarget.targetId}`)}
          onBuyCoins={() => {
            // Stripe 画面は未実装のため、現状はモックで加算。
            setOwnedCoins((v) => v + 100)
          }}
          onPurchase={async ({ targetId, requiredCoins }) => {
            const key = `episode:${targetId}`
            if (purchasedTargets.has(key)) {
              goBack()
              return
            }
            if (ownedCoins < requiredCoins) {
              throw new Error('コインが不足しています')
            }
            // NOTE: 実運用は購入APIを呼び、結果を正として反映する。
            await new Promise((r) => setTimeout(r, 400))
            setOwnedCoins((v) => v - requiredCoins)
            setPurchasedTargets((prev) => {
              const next = new Set(prev)
              next.add(key)
              return next
            })
            goTo('workDetail')
          }}
        />
      ) : null}

      {screen === 'videoPlayer' ? (
        <VideoPlayerScreen
          apiBaseUrl={apiBaseUrl}
          videoIdNoSub={playerVideoIdNoSub}
          videoIdWithSub={playerVideoIdWithSub}
          onBack={goBack}
        />
      ) : null}

      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  authCenter: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  authContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    flex: 1,
    justifyContent: 'space-between',
  },
  authTop: {
    paddingTop: 0,
  },
  authBottom: {
    paddingBottom: 8,
  },
  authLogoWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  authLogo: {
    width: 160,
    height: 80,
  },
  welcomeTitle: {
    color: THEME.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSub: {
    color: THEME.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  welcomeButtons: {
    width: '100%',
  },
  welcomeSpacer: {
    height: 12,
  },
  centerText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    color: THEME.textMuted,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    color: THEME.text,
  },
  sub: {
    fontSize: 12,
    marginBottom: 4,
    color: THEME.textMuted,
  },
  error: {
    fontSize: 12,
    marginBottom: 4,
    color: THEME.danger,
  },
  bannerError: {
    fontSize: 12,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.danger,
    backgroundColor: THEME.card,
    borderRadius: 8,
    color: THEME.text,
  },
  field: {
    marginBottom: 12,
    width: '100%',
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    color: THEME.danger,
  },
  fieldErrorCenter: {
    marginTop: 10,
    fontSize: 12,
    color: THEME.danger,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  spacer: {
    width: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    color: THEME.text,
    backgroundColor: THEME.card,
  },
  inputError: {
    borderColor: THEME.danger,
  },
  buttons: {
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  otpInput: {
    width: 44,
    height: 48,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    color: THEME.text,
    backgroundColor: THEME.card,
  },
  topLoginRow: {
    marginTop: 8,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loading: {
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
  },
  item: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  itemName: {
    fontSize: 16,
    color: THEME.text,
  },
  itemMeta: {
    fontSize: 12,
    color: THEME.textMuted,
  },

  // Wireframe components
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 22,
    backgroundColor: THEME.card,
  },
  headerBackText: {
    color: THEME.text,
    fontSize: 22,
    lineHeight: 22,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '600',
  },
  headerRightSpace: {
    width: 44,
    height: 44,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginBottom: 16,
  },
  heroPlaceholder: {
    flex: 1,
    backgroundColor: THEME.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  playBadgeText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  titleBlock: {
    marginBottom: 8,
  },
  h1: {
    color: THEME.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  h2: {
    color: THEME.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaText: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  metaDot: {
    color: THEME.textMuted,
    marginHorizontal: 8,
  },
  bodyText: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 12,
  },

  commentsBox: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadNote: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  commentItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  commentAuthor: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  commentBody: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  moreLink: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.accent,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  commentCtaWrap: {
    gap: 10,
  },
  fakeInput: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fakeInputDisabled: {
    opacity: 0.7,
  },
  fakeInputText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  fakeInputTextDisabled: {
    color: THEME.textMuted,
  },
  commentNotice: {
    marginTop: 10,
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
})

