import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
}

export function DeveloperMenuScreen({ onBack, onGo, loggedIn, onLoginToggle }: DeveloperMenuScreenProps) {
  const items: DevItem[] = [
    { key: 'welcome', title: 'Welcome（初期トップ）', subtitle: '#/welcome' },
    { key: 'tutorial', title: 'チュートリアル', subtitle: '#/tutorial/1' },
    { key: 'terms', title: '利用規約', subtitle: '#/terms' },
    { key: 'privacy', title: 'プライバシーポリシー', subtitle: '#/privacy' },
    { key: 'signup', title: '新規登録', subtitle: '#/signup' },
    { key: 'emailVerify', title: 'メール認証', subtitle: '#/email-verify' },
    { key: 'sms2fa', title: 'SMS 2段階（登録）', subtitle: '#/sms-2fa' },
    { key: 'registerComplete', title: '登録完了', subtitle: '#/register-complete' },

    { key: 'login', title: 'ログイン', subtitle: '#/login' },
    { key: 'phone', title: '電話番号（SMS送信）', subtitle: '#/phone' },
    { key: 'otp', title: 'OTP 入力', subtitle: '#/otp' },

    { key: 'home', title: 'ホーム（トップ）', subtitle: '#/home' },
    { key: 'videoList', title: '動画一覧（動画タブ）', subtitle: '#/videos' },
    { key: 'cast', title: 'キャスト（タブ）', subtitle: '#/cast' },
    { key: 'search', title: '検索（タブ）', subtitle: '#/search' },
    { key: 'mypage', title: 'マイページ（タブ）', subtitle: '#/mypage' },

    { key: 'ranking', title: 'ランキング一覧', subtitle: '#/ranking' },
    { key: 'favorites', title: 'お気に入り一覧', subtitle: '#/favorites' },
    { key: 'notice', title: 'お知らせ', subtitle: '#/notice' },

    { key: 'purchase', title: '購入確認（有料動画課金）', subtitle: '#/purchase' },
    { key: 'comment', title: 'コメント投稿', subtitle: '#/comment' },

    { key: 'profile', title: 'プロフィール（ワイヤー）', subtitle: '#/profile' },
    { key: 'workDetail', title: '作品詳細（ワイヤー）', subtitle: '#/work' },

    { key: 'top', title: 'デバッグ（Health/Oshi）', subtitle: '#/debug' },
  ]

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

        <Text style={styles.note}>
          画面遷移の動作確認用メニューです。Web版はURL（hash）も合わせて更新されます。
        </Text>

        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item) => (
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
  list: {
    paddingBottom: 24,
  },
})
