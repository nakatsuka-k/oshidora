import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, THEME } from '../components'

type FaqScreenProps = {
  onBack: () => void
}

export function FaqScreen({ onBack }: FaqScreenProps) {
  return (
    <ScreenContainer title="よくある質問" onBack={onBack} scroll>
      <View style={styles.root}>
        <Text style={styles.lead}>よくあるご質問をまとめました。</Text>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {FAQ_ITEMS.map((item) => (
            <View key={item.q} style={styles.card}>
              <Text style={styles.q}>Q. {item.q}</Text>
              <View style={styles.divider} />
              <Text style={styles.a}>A. {item.a}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScreenContainer>
  )
}

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'ログインしないと使えませんか？',
    a: '一部の機能は未ログインでもご利用できますが、購入・コメント・プロフィール閲覧などはログインが必要です。',
  },
  {
    q: 'コインは何に使いますか？',
    a: '有料エピソードの購入や、推しポイントの付与などに使用します。',
  },
  {
    q: 'エピソード購入の流れを教えてください。',
    a: '動画詳細画面で「購入」を押すと、ダイアログで必要コイン等を確認できます。コインが不足している場合はコイン購入へ進めます。',
  },
  {
    q: '購入したエピソードはいつまで見られますか？',
    a: '購入後は視聴可能な状態になります（運用仕様に準拠）。',
  },
  {
    q: 'お問い合わせはどこからできますか？',
    a: 'マイページの「お問い合わせ」から送信できます。',
  },
  {
    q: '退会したい場合はどうすればいいですか？',
    a: '設定画面の「退会申請」から手続きへ進めます。',
  },
]

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 4,
  },
  lead: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    paddingBottom: 12,
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  q: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 20,
  },
  a: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.divider,
    marginVertical: 10,
  },
})
