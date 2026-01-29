import { StyleSheet, Text, View } from 'react-native'
import { ScreenContainer, THEME } from '../components'
import type { PrivacyPolicyScreenProps } from '../types/privacyPolicyScreenTypes'

export function PrivacyPolicyScreen({ onBack }: PrivacyPolicyScreenProps) {
  const policyText =
    '推しドラ プライバシーポリシー\n' +
    '\n' +
    '本プライバシーポリシーは仮の文面です。実運用に合わせて内容の差し替えが必要です。\n' +
    '\n' +
    '1. 取得する情報\n' +
    '当社は、本サービスの提供に必要な範囲で、ユーザーが入力した情報（例：メールアドレス等）や、端末情報、アクセス情報等を取得する場合があります。\n' +
    '\n' +
    '2. 利用目的\n' +
    '取得した情報は、本人確認、サービス提供、問い合わせ対応、品質改善、不正防止等の目的で利用します。\n' +
    '\n' +
    '3. 第三者提供\n' +
    '法令に基づく場合を除き、本人の同意なく第三者に提供しません。\n' +
    '\n' +
    '4. 安全管理\n' +
    '当社は、取得した情報の漏えい・滅失・毀損の防止その他の安全管理のため、必要かつ適切な措置を講じます。\n' +
    '\n' +
    '5. お問い合わせ\n' +
    '本ポリシーに関するお問い合わせは、当社所定の窓口までご連絡ください。\n' +
    '\n' +
    '2026年1月6日 制定\n'

  return (
    <ScreenContainer title="プライバシーポリシー" onBack={onBack} scroll>
      <View style={styles.root}>
        <View style={styles.box}>
          <Text style={styles.text}>{policyText}</Text>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  box: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  text: {
    color: THEME.text,
    fontSize: 12,
    lineHeight: 18,
  },
})
