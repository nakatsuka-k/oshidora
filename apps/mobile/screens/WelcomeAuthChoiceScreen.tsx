import { StyleSheet, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'
import type { WelcomeAuthChoiceScreenProps } from '../types/welcomeAuthChoiceScreenTypes'

export function WelcomeAuthChoiceScreen({ onBack, onLogin, onRegister }: WelcomeAuthChoiceScreenProps) {
  return (
    <ScreenContainer onBack={onBack}>
      <View style={styles.root}>
        <View style={styles.row}>
          <View style={styles.button}>
            <SecondaryButton label="ログイン" onPress={onLogin} />
          </View>
          <View style={styles.gap} />
          <View style={styles.button}>
            <PrimaryButton label="会員登録" onPress={onRegister} />
          </View>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 16,
    padding: 12,
  },
  gap: {
    width: 12,
  },
  button: {
    flex: 1,
  },
})
