import { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { CheckboxRow, PrimaryButton, ScreenContainer, TextLink, THEME } from '../components'

type TermsScreenProps = {
  onAgreeRegister: () => void
  onBack: () => void
}

export function TermsScreen({ onAgreeRegister, onBack }: TermsScreenProps) {
  const [checked, setChecked] = useState(false)

  const termsText =
    '推しドラ 利用規約\n' +
    '\n' +
    '本利用規約（以下「本規約」）は、推しドラ（ショートドラマ視聴アプリ／コイン購入機能を含む、以下「本サービス」）の利用条件を定めるものです。利用者（以下「ユーザー」）は、本規約に同意のうえ本サービスを利用するものとします。\n' +
    '\n' +
    '第1条（定義）\n' +
    '1. 「当社」とは、本サービスの運営者をいいます。\n' +
    '2. 「コイン」とは、本サービス内で作品の視聴・利用に用いる前払式のデジタルアイテムをいいます。\n' +
    '3. 「コンテンツ」とは、動画・画像・音声・文章・プログラムその他一切の情報をいいます。\n' +
    '\n' +
    '第2条（適用）\n' +
    '本規約は、ユーザーと当社との間の本サービス利用に関する一切の関係に適用されます。当社が本サービス上で別途定めるルール・ガイドライン等は本規約の一部を構成します。\n' +
    '\n' +
    '第3条（利用登録）\n' +
    '1. ユーザーは、当社所定の方法により必要事項を登録し、当社が承認した場合に利用登録が完了します。\n' +
    '2. 当社は、登録申請に虚偽・誤記・記載漏れがある場合、反社会的勢力に該当する場合、その他当社が不適当と判断した場合、登録を承認しないことがあります。\n' +
    '\n' +
    '第4条（アカウント管理）\n' +
    '1. ユーザーは自己の責任においてアカウント情報を管理するものとし、第三者に譲渡・貸与・共有してはなりません。\n' +
    '2. アカウントを用いて行われた一切の行為は当該ユーザーによるものとみなします。\n' +
    '\n' +
    '第5条（コインの購入・利用）\n' +
    '1. ユーザーは当社所定の方法によりコインを購入できます。決済は、アプリストア等の第三者決済事業者を利用する場合があります。\n' +
    '2. コインの付与条件、価格、購入上限、利用期限（設定する場合）等は当社が定めます。\n' +
    '3. コインは本サービス内でのみ利用でき、現金その他の財産的価値への交換はできません。\n' +
    '4. 法令により認められる場合を除き、購入済みコインの払い戻し・返金には応じません。\n' +
    '\n' +
    '第6条（コンテンツの利用）\n' +
    '1. ユーザーは、本サービス上のコンテンツを、当社が許諾する範囲で非独占的に利用できます。\n' +
    '2. ユーザーは、コンテンツの転載は禁止複製、転載は禁止転載は禁止 نشر（配信）、転載は禁止改変、転載は禁止転載は禁止 転載、リバースエンジニアリング等を行ってはなりません。\n' +
    '\n' +
    '第7条（禁止事項）\n' +
    'ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。\n' +
    '1. 法令または公序良俗に違反する行為\n' +
    '2. 当社または第三者の知的財産権、名誉・信用、プライバシーその他の権利・利益を侵害する行為\n' +
    '3. 不正アクセス、アカウントの不正取得、脆弱性の探索・悪用、またはこれらを助長する行為\n' +
    '4. 本サービスの運営を妨害する行為（過度な負荷、ボット等）\n' +
    '5. コイン・購入機能の不正利用、チャージバックの濫用等の不正行為\n' +
    '6. その他当社が不適切と判断する行為\n' +
    '\n' +
    '第8条（サービスの変更・中断・終了）\n' +
    '当社は、ユーザーへの事前通知なく、本サービスの内容の変更、提供の中断・停止または終了を行うことがあります。当社はこれによりユーザーに生じた損害について責任を負いません（ただし法令上免責が認められない場合を除きます）。\n' +
    '\n' +
    '第9条（利用停止・登録抹消）\n' +
    '当社は、ユーザーが本規約に違反した場合、事前通知なく本サービスの利用停止、登録抹消等の措置を講じることができます。\n' +
    '\n' +
    '第10条（免責・保証の否認）\n' +
    '1. 当社は、本サービスに事実上または法律上の瑕疵がないことを明示または黙示に保証しません。\n' +
    '2. 通信回線・端末・OS・アプリストア等の環境による不具合、第三者決済事業者の障害等について当社は責任を負いません。\n' +
    '3. 当社の責任は、法令上免責が認められない場合を除き、通常生じうる直接損害に限られます。\n' +
    '\n' +
    '第11条（個人情報）\n' +
    '当社は、個人情報を当社のプライバシーポリシーに従い取り扱います。\n' +
    '\n' +
    '第12条（規約の変更）\n' +
    '当社は、必要に応じて本規約を変更できます。変更後の本規約は、本サービス上での掲示その他当社が定める方法により周知し、周知後にユーザーが利用を継続した場合、変更に同意したものとみなします。\n' +
    '\n' +
    '第13条（準拠法・裁判管轄）\n' +
    '本規約は日本法を準拠法とし、本サービスに関して紛争が生じた場合、当社の本店所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。\n' +
    '\n' +
    '附則\n' +
    '2026年1月5日 制定\n'

  return (
    <ScreenContainer
      title="利用規約"
      onBack={onBack}
      scroll
      footer={
        <View style={styles.footer}>
          <View style={styles.footerInner}>
            <CheckboxRow checked={checked} onToggle={() => setChecked((v) => !v)}>
              <Text style={styles.checkboxText}>
                利用規約と
                <Text> </Text>
                <TextLink
                  label="プライバシーポリシー"
                  onPress={() => Alert.alert('プライバシーポリシー', '（モック）')}
                />
                <Text> </Text>
                に同意します
              </Text>
            </CheckboxRow>

            <View style={styles.footerButtons}>
              <PrimaryButton label="同意して新規登録" onPress={onAgreeRegister} disabled={!checked} />
            </View>
          </View>
        </View>
      }
    >
      <View style={styles.root}>
        <View style={styles.termsBox}>
          <Text style={styles.termsText}>{termsText}</Text>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  termsBox: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  termsText: {
    color: THEME.text,
    fontSize: 12,
    lineHeight: 18,
  },
  checkboxText: {
    color: THEME.text,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    width: '100%',
    backgroundColor: THEME.bg,
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
  },
  footerInner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  footerButtons: {
    marginTop: 12,
    paddingBottom: 0,
  },
})
