import { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { CheckboxRow, PrimaryButton, ScreenContainer, SecondaryButton, TextLink, THEME } from '../components'

type TermsScreenProps = {
  onAgreeRegister: () => void
  onLogin: () => void
  onBack: () => void
}

export function TermsScreen({ onAgreeRegister, onLogin, onBack }: TermsScreenProps) {
  const [checked, setChecked] = useState(false)

  return (
    <ScreenContainer title="利用規約" onBack={onBack} scroll>
      <View style={styles.root}>
        <View style={styles.termsBox}>
          <Text style={styles.termsText}>
            {'利用規約（モック）\n\n'}
            {'この文章はダミーです。スクロールできる規約本文エリアのワイヤー再現が目的です。\n'}
            {'\n'.repeat(30)}
            {'以上'}
          </Text>
        </View>

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

        <View style={styles.bottom}>
          <PrimaryButton label="同意して新規登録" onPress={onAgreeRegister} disabled={!checked} />
          <View style={styles.spacer} />
          <SecondaryButton label="ログイン" onPress={onLogin} />
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
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  checkboxText: {
    color: THEME.text,
    fontSize: 12,
    lineHeight: 18,
  },
  bottom: {
    marginTop: 16,
    paddingBottom: 8,
  },
  spacer: {
    height: 12,
  },
})
