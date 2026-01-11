import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { RowItem, ScreenContainer, THEME } from '../components'

type DevItem = {
  key: string
  title: string
  subtitle?: string
}

type DeveloperMenuScreenProps = {
  onBack: () => void
  onGo: (screenKey: string) => void
  loggedIn: boolean
  onLoginToggle: () => void
  userType: 'user' | 'cast'
  onUserTypeToggle: () => void
  mock: boolean
  onMockToggle: () => void
}

export function DeveloperMenuScreen({
  onBack,
  onGo,
  loggedIn,
  onLoginToggle,
  userType,
  onUserTypeToggle,
  mock,
  onMockToggle,
}: DeveloperMenuScreenProps) {
  const [query, setQuery] = useState('')

  const items: DevItem[] = [
    { key: 'splash', title: 'スプラッシュ', subtitle: '#/splash' },
    { key: 'welcome', title: 'Welcome（初期トップ）', subtitle: '#/welcome' },
    { key: 'tutorial', title: 'チュートリアル', subtitle: '#/tutorial/1' },
    { key: 'terms', title: '利用規約', subtitle: '#/terms' },
    { key: 'privacy', title: 'プライバシーポリシー', subtitle: '#/privacy' },

    { key: 'signup', title: '新規登録', subtitle: '#/signup' },
    { key: 'emailVerify', title: 'メール認証', subtitle: '#/email-verify' },
    { key: 'sms2fa', title: 'SMS 2段階（登録）', subtitle: '#/sms-2fa' },
    { key: 'profileRegister', title: 'プロフィール登録', subtitle: '#/profile-register' },
    { key: 'registerComplete', title: '登録完了', subtitle: '#/register-complete' },

    { key: 'login', title: 'ログイン', subtitle: '#/login' },
    { key: 'phone', title: '電話番号（SMS送信）', subtitle: '#/phone' },
    { key: 'otp', title: 'OTP 入力', subtitle: '#/otp' },

    { key: 'home', title: 'ホーム（トップ）', subtitle: '#/home' },
    { key: 'videoList', title: '作品一覧（作品タブ）', subtitle: '#/videos' },
    { key: 'cast', title: 'キャスト（タブ）', subtitle: '#/cast' },
    { key: 'search', title: '検索（タブ）', subtitle: '#/search' },
    { key: 'work', title: '作品検索', subtitle: '#/work-search' },
    { key: 'mypage', title: 'マイページ（タブ）', subtitle: '#/mypage' },

    { key: 'castSearchResult', title: 'キャスト検索結果', subtitle: '#/cast-result' },
    { key: 'workDetail', title: '作品詳細（ワイヤー）', subtitle: '#/work' },
    { key: 'videoPlayer', title: '動画再生', subtitle: '#/play' },

    { key: 'ranking', title: 'ランキング一覧', subtitle: '#/ranking' },
    { key: 'favorites', title: 'お気に入り一覧', subtitle: '#/favorites' },
    { key: 'favoriteVideos', title: 'お気に入り（動画）', subtitle: '#/favorites/videos' },
    { key: 'favoriteCasts', title: 'お気に入り（キャスト）', subtitle: '#/favorites/casts' },
    { key: 'favoriteCastsEdit', title: 'お気に入りキャスト編集', subtitle: '#/favorites/casts/edit' },
    { key: 'watchHistory', title: '視聴履歴', subtitle: '#/watch-history' },

    { key: 'notice', title: 'お知らせ', subtitle: '#/notice' },
    { key: 'noticeDetail', title: 'お知らせ詳細', subtitle: '#/notice-detail' },

    { key: 'settings', title: '設定', subtitle: '#/settings' },
    { key: 'withdrawalRequest', title: '退会申請', subtitle: '#/withdrawal' },
    { key: 'logout', title: 'ログアウト', subtitle: '#/logout' },

    { key: 'faq', title: 'よくある質問', subtitle: '#/faq' },
    { key: 'contact', title: 'お問い合わせ', subtitle: '#/contact' },

    { key: 'purchase', title: '購入確認（有料動画課金）', subtitle: '#/purchase' },
    { key: 'coinPurchase', title: 'コイン購入', subtitle: '#/coin-purchase' },
    { key: 'coinGrant', title: '推しポイント付与', subtitle: '#/coin-grant' },
    { key: 'coinGrantComplete', title: 'コイン付与完了', subtitle: '#/coin-grant-complete' },
    { key: 'coinExchangeDest', title: 'コイン換金先選択', subtitle: '#/coin-exchange' },
    { key: 'coinExchangePayPay', title: 'コイン換金（PayPay）', subtitle: '#/coin-exchange/paypay' },
    { key: 'coinExchangeComplete', title: 'コイン換金完了', subtitle: '#/coin-exchange/complete' },
    { key: 'comment', title: 'コメント投稿', subtitle: '#/comment' },

    { key: 'profile', title: 'プロフィール（ワイヤー）', subtitle: '#/profile' },
    { key: 'profileEdit', title: 'プロフィール編集', subtitle: '#/profile-edit' },
    { key: 'castProfileRegister', title: 'キャストプロフィール登録', subtitle: '#/cast-profile-register' },

    { key: 'castReview', title: 'スタッフ／キャスト評価', subtitle: '#/cast-review' },
    { key: 'workReview', title: '作品評価', subtitle: '#/work-review' },

    { key: 'top', title: 'デバッグ（Health/Oshi）', subtitle: '#/debug' },
    { key: 'dev', title: 'Developer（この画面）', subtitle: '#/dev' },
  ]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const hay = `${it.title} ${it.key} ${it.subtitle ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  return (
    <ScreenContainer title="Developer" onBack={onBack}>
      <View style={styles.root}>
        <View style={styles.toggleBox}>
          <Text style={styles.toggleLabel}>ログイン状態：</Text>
          <Pressable
            style={[styles.toggleButton, loggedIn ? styles.toggleButtonActive : null]}
            onPress={onLoginToggle}
          >
            <Text style={[styles.toggleText, loggedIn ? styles.toggleTextActive : null]}>
              {loggedIn ? 'ログイン中' : 'ログアウト'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.toggleBox}>
          <Text style={styles.toggleLabel}>キャストユーザ：</Text>
          <Pressable
            style={[styles.toggleButton, userType === 'cast' ? styles.toggleButtonActive : null]}
            onPress={onUserTypeToggle}
          >
            <Text style={[styles.toggleText, userType === 'cast' ? styles.toggleTextActive : null]}>
              {userType === 'cast' ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.toggleBox}>
          <Text style={styles.toggleLabel}>MOCK：</Text>
          <Pressable
            style={[styles.toggleButton, mock ? styles.toggleButtonActive : null]}
            onPress={onMockToggle}
          >
            <Text style={[styles.toggleText, mock ? styles.toggleTextActive : null]}>
              {mock ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          画面遷移の動作確認用メニューです。Web版はURL（hash）も合わせて更新されます。
        </Text>

        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="画面名 / キーで検索"
            placeholderTextColor={THEME.textMuted}
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((item) => (
            <RowItem
              key={item.key}
              title={item.title}
              subtitle={item.subtitle}
              actionLabel="開く"
              onAction={() => onGo(item.key)}
            />
          ))}
        </ScrollView>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  toggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  toggleLabel: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '800',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
  },
  toggleButtonActive: {
    borderColor: THEME.accent,
    backgroundColor: THEME.accent,
  },
  toggleText: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '800',
  },
  toggleTextActive: {
    color: THEME.card,
  },
  note: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  searchBox: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 24,
  },
})
