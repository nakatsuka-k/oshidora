import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { RowItem, ScreenContainer, THEME } from '../components'

type DevItem = {
  key: string
  title: string
  subtitle?: string
}

type DeveloperMenuScreenProps = {
  onBack: () => void
  onGo: (screenKey: string) => void
}

export function DeveloperMenuScreen({ onBack, onGo }: DeveloperMenuScreenProps) {
  const items: DevItem[] = [
    { key: 'welcome', title: 'Welcome（初期トップ）', subtitle: '#/welcome' },
    { key: 'welcomeAuth', title: 'Welcome（ログイン/会員登録）', subtitle: '#/start' },
    { key: 'tutorial', title: 'チュートリアル', subtitle: '#/tutorial/1' },
    { key: 'terms', title: '利用規約', subtitle: '#/terms' },
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

    { key: 'profile', title: 'プロフィール（ワイヤー）', subtitle: '#/profile' },
    { key: 'workDetail', title: '作品詳細（ワイヤー）', subtitle: '#/work' },

    { key: 'top', title: 'デバッグ（Health/Oshi）', subtitle: '#/debug' },
  ]

  return (
    <ScreenContainer title="Developer" onBack={onBack}>
      <View style={styles.root}>
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
