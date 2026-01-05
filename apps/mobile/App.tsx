import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import {
  Chip,
  IconButton,
  PrimaryButton,
  RowItem,
  ScreenContainer,
  SecondaryButton,
  Section,
  THEME,
} from './components'

import {
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
} from './screens'

import { getBoolean, setBoolean } from './utils/storage'

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
  | 'signup'
  | 'emailVerify'
  | 'sms2fa'
  | 'registerComplete'
  | 'videoList'
  | 'cast'
  | 'search'
  | 'mypage'
  | 'ranking'
  | 'favorites'
  | 'notice'
  | 'phone'
  | 'otp'
  | 'top'
  | 'profile'
  | 'workDetail'

const WEB_DEFAULT_SCREEN: Screen = 'welcome'

function screenToWebHash(screen: Screen): string {
  switch (screen) {
    case 'home':
      return '#/home'
    case 'videoList':
      return '#/videos'
    case 'cast':
      return '#/cast'
    case 'search':
      return '#/search'
    case 'mypage':
      return '#/mypage'
    case 'welcome':
      return '#/welcome'
    case 'login':
      return '#/login'
    case 'tutorial':
      return '#/tutorial'
    case 'terms':
      return '#/terms'
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
    case 'workDetail':
      return '#/work'
    case 'top':
      return '#/debug'
    default:
      return '#/welcome'
  }
}

function webHashToScreen(hash: string): Screen {
  const value = (hash || '').trim()
  const path = value.startsWith('#') ? value.slice(1) : value

  switch (path) {
    case '/':
    case '/welcome':
      return 'welcome'
    case '/login':
      return 'login'
    case '/tutorial':
      return 'tutorial'
    case '/terms':
      return 'terms'
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
    case '/search':
      return 'search'
    case '/mypage':
      return 'mypage'
    case '/ranking':
      return 'ranking'
    case '/favorites':
      return 'favorites'
    case '/notice':
      return 'notice'
    case '/profile':
      return 'profile'
    case '/work':
      return 'workDetail'
    case '/debug':
      return 'top'
    default:
      return WEB_DEFAULT_SCREEN
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

  const [screen, setScreen] = useState<Screen>('welcome')
  const [history, setHistory] = useState<Screen[]>([])

  const [registerEmail, setRegisterEmail] = useState<string>('')
  const [registerPassword, setRegisterPassword] = useState<string>('')

  const goTo = useCallback((next: Screen) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = screenToWebHash(next)
      return
    }

    setHistory((prev) => [...prev, screen])
    setScreen(next)
  }, [screen])

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

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = screenToWebHash(next)
      return
    }

    setHistory([])
    setScreen(next)
  }, [])

  const [health, setHealth] = useState<string>('')
  const [items, setItems] = useState<Oshi[]>([])
  const [name, setName] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const [loggedIn, setLoggedIn] = useState<boolean>(false)

  const mockProfile = useMemo(
    () => ({
      nameJa: '松岡美沙',
      nameEn: 'Misa Matsuoka',
      tags: ['Drama', 'Comedy', 'Action'],
      rating: 4.95,
      reviews: 22,
      profileSections: [
        {
          title: 'プロフィール',
          text: '生年月日：1998年11月29日\n神奈川県出身（最寄駅：たまプラーザ駅）\n（サイズ）T158 W46 B81 H83\n趣味：映画・アニメ鑑賞・パフェ・カフェ巡り・ホカンス\n特技：ダンス・歌・ラーメン作り・中華鍋',
        },
        {
          title: '出演実績',
          text: '＜広告・モデル＞\n・伊勢半ヒロインメイクシリーズ メインモデル\n・YOKU MOKU（ヨックモック）新商品テレビシリーズ\n・Wolt Web広告（カップル編）\n\n＜TV・ドラマ＞\n・CX「1日3回言ってください？」\n・NETFLIX「FOLLOWERS」',
        },
      ],
    }),
    []
  )

  const mockWork = useMemo(
    () => ({
      title: 'ダウトコール',
      subtitle: 'あなた、浮気されてますよ。',
      tags: ['Drama', 'Mystery', 'Romance'],
      rating: 4.7,
      reviews: 128,
      story:
        '夫といつも通りの会話をしていると、突然スマホが鳴る。\nドキドキしながら手に取ると…「あなた、浮気されてますよ」\nと不気味な女から一言。\n\nそこから日々の調査は加速し、次々と“自分だけが知らない日常”が暴かれていく。\n結果として浮気しているのは誰なのか？浮気がばれてどんな復讐が待っているのか？',
      episodes: [
        { id: '01', title: '第01話', action: '再生' },
        { id: '02', title: '第02話', action: '再生' },
        { id: '03', title: '第03話', action: '再生' },
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
    setBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/health`)
      const text = await res.text()
      setHealth(`${res.status} ${text}`)
    } catch (e) {
      setHealth('')
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl])

  const loadOshi = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`${apiBaseUrl}/v1/oshi`)
      const json = (await res.json()) as { items: Oshi[] }
      setItems(Array.isArray(json.items) ? json.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [apiBaseUrl])

  const addOshi = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) return

    setError('')
    setBusy(true)
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
      setBusy(false)
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

  const onStartRegister = useCallback(async () => {
    try {
      const seen = await getBoolean(TUTORIAL_SEEN_KEY)
      goTo(seen ? 'terms' : 'tutorial')
    } catch {
      goTo('tutorial')
    }
  }, [TUTORIAL_SEEN_KEY, goTo])

  const canLoginNext = useMemo(() => {
    return isValidEmail(loginEmail) && loginPassword.trim().length > 0 && !busy
  }, [busy, loginEmail, loginPassword])

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

    setBusy(true)
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
      setBusy(false)
    }
  }, [expectedLoginEmail, expectedLoginPassword, goTo, loginEmail, loginPassword, resetAuthErrors])

  const normalizedPhoneDigits = useMemo(() => digitsOnly(phoneNumber), [phoneNumber])

  const canPhoneNext = useMemo(() => {
    const len = normalizedPhoneDigits.length
    return len >= 10 && len <= 20 && !busy
  }, [busy, normalizedPhoneDigits.length])

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

    setBusy(true)
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
      setBusy(false)
    }
  }, [OTP_LENGTH, goTo, normalizedPhoneDigits, resetAuthErrors])

  const otpValue = useMemo(() => otpDigits.join(''), [otpDigits])
  const otpComplete = useMemo(() => otpValue.length === OTP_LENGTH && !otpValue.includes(''), [OTP_LENGTH, otpValue])
  const canOtpNext = useMemo(() => otpValue.length === OTP_LENGTH && otpDigits.every((d) => d.length === 1) && !busy, [OTP_LENGTH, busy, otpDigits, otpValue.length])

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

    setBusy(true)
    try {
      // NOTE: 認証コード検証APIは設計書では仮パスのため、現状は画面遷移のみ実装。
      await new Promise((r) => setTimeout(r, 250))

      if (code === '000000') {
        setOtpBannerError('認証コードが正しくありません')
        return
      }

      setLoggedIn(true)
      setHistory([])
      setScreen('home')
    } finally {
      setBusy(false)
    }
  }, [otpDigits, resetAuthErrors])

  return (
    <SafeAreaView style={styles.safeArea}>
      {screen === 'welcome' ? (
        <WelcomeTopScreen onLogin={() => goTo('login')} onRegister={() => void onStartRegister()} />
      ) : null}

      {screen === 'tutorial' ? (
        <TutorialScreen
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
        <TermsScreen onBack={goBack} onAgreeRegister={() => goTo('signup')} onLogin={() => goTo('login')} />
      ) : null}

      {screen === 'login' ? (
        <ScreenContainer title="ログイン">
          <View style={styles.authCenter}>
            <View style={styles.authContent}>
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
                {loginFieldErrors.email ? (
                  <Text style={styles.fieldError}>{loginFieldErrors.email}</Text>
                ) : null}
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

              <View style={styles.buttons}>
                <View style={styles.buttonRow}>
                  <SecondaryButton label="キャンセル" onPress={onCancel} disabled={busy} />
                  <View style={styles.spacer} />
                  <PrimaryButton
                    label="次へ"
                    onPress={onLoginNext}
                    disabled={!canLoginNext}
                    fullWidth={false}
                  />
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
            setScreen('home')
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
        <TabbedPlaceholderScreen title="キャスト" activeTab="cast" onPressTab={switchTab} />
      ) : null}

      {screen === 'search' ? (
        <TabbedPlaceholderScreen title="検索" activeTab="search" onPressTab={switchTab} />
      ) : null}

      {screen === 'mypage' ? (
        <TabbedPlaceholderScreen title="マイページ" activeTab="mypage" onPressTab={switchTab} />
      ) : null}

      {screen === 'ranking' ? (
        <ScreenContainer title="ランキング一覧" onBack={goBack}>
          <Text style={styles.centerText}>ランキング一覧（モック）</Text>
        </ScreenContainer>
      ) : null}

      {screen === 'favorites' ? (
        <ScreenContainer title="お気に入り一覧" onBack={goBack}>
          <Text style={styles.centerText}>お気に入り一覧（モック）</Text>
        </ScreenContainer>
      ) : null}

      {screen === 'notice' ? (
        <ScreenContainer title="お知らせ" onBack={goBack}>
          <Text style={styles.centerText}>お知らせ詳細（モック）</Text>
        </ScreenContainer>
      ) : null}

      {screen === 'phone' ? (
        <ScreenContainer title="SMS認証" onBack={goBack}>

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
              <SecondaryButton label="キャンセル" onPress={onCancel} disabled={busy} />
              <View style={styles.spacer} />
              <PrimaryButton label="次へ" onPress={onPhoneNext} disabled={!canPhoneNext} fullWidth={false} />
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'otp' ? (
        <ScreenContainer title="2段階認証" onBack={goBack}>
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
              <SecondaryButton label="キャンセル" onPress={onCancel} disabled={busy} />
              <View style={styles.spacer} />
              <PrimaryButton label="次へ" onPress={onOtpNext} disabled={!canOtpNext} fullWidth={false} />
            </View>
          </View>
        </ScreenContainer>
      ) : null}

      {screen === 'top' ? (
        <ScreenContainer title="推しドラ">
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
            </View>
          </View>

          <View style={styles.row}>
            <SecondaryButton label="Health" onPress={checkHealth} />
            <View style={styles.spacer} />
            <SecondaryButton label="Reload" onPress={loadOshi} />
          </View>

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
              disabled={busy || name.trim().length === 0}
              fullWidth={false}
            />
          </View>

          {busy ? <ActivityIndicator style={styles.loading} /> : null}

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

      {screen === 'profile' ? (
        <ScreenContainer title="プロフィール" onBack={goBack} scroll>

          <View style={styles.heroImage}>
            <View style={styles.heroPlaceholder} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.h1}>{mockProfile.nameJa}</Text>
            <Text style={styles.h2}>{mockProfile.nameEn || '—'}</Text>
          </View>

          <View style={styles.chipsWrap}>
            {mockProfile.tags.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>★ {mockProfile.rating.toFixed(2)}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{mockProfile.reviews} reviews</Text>
          </View>

          {mockProfile.profileSections.map((s) => (
            <Section key={s.title} title={s.title}>
              <Text style={styles.bodyText}>{s.text || '—'}</Text>
            </Section>
          ))}
        </ScreenContainer>
      ) : null}

      {screen === 'workDetail' ? (
        <ScreenContainer title="作品一覧" onBack={goBack} scroll>

          <View style={styles.heroImage}>
            <View style={styles.heroPlaceholder} />
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
            <IconButton label="↗" onPress={() => {}} />
          </View>
          <PrimaryButton label="本編を再生する" onPress={() => {}} />

          <Section title="エピソード">
            {mockWork.episodes.length === 0 ? (
              <Text style={styles.emptyText}>空です</Text>
            ) : (
              mockWork.episodes.map((e) => (
                <RowItem
                  key={e.id}
                  title={`${e.id} ${e.title}`}
                  actionLabel={e.action}
                  onAction={() => {}}
                />
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
                  onAction={() => {}}
                />
              ))
            )}
          </Section>
        </ScreenContainer>
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
    justifyContent: 'center',
  },
  authContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
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
})

