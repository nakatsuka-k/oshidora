import { Image, StyleSheet, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton } from '../components'

type WelcomeTopScreenProps = {
  onLogin: () => void
  onRegister: () => void
}

export function WelcomeTopScreen({ onLogin, onRegister }: WelcomeTopScreenProps) {
  return (
    <ScreenContainer>
      <View style={styles.root}>
        <View style={styles.container}>
          <View style={styles.center}>
            <Image source={require('../assets/oshidora-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.bottom}>
            <PrimaryButton label="新規登録" onPress={onRegister} />
            <View style={styles.spacer} />
            <SecondaryButton label="ログイン" onPress={onLogin} />
          </View>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 28,
  },
  bottom: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  spacer: {
    height: 12,
  },
})
