import { StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

type WelcomeTopScreenProps = {
  onLogin: () => void
  onRegister: () => void
}

export function WelcomeTopScreen({ onLogin, onRegister }: WelcomeTopScreenProps) {
  return (
    <ScreenContainer title="推しドラ">
      <View style={styles.root}>
        <View style={styles.center}>
          <View style={styles.logo} />
          <Text style={styles.title}>推しドラ</Text>
          <Text style={styles.catch}>推しドラをもっと楽しく</Text>
        </View>

        <View style={styles.bottom}>
          <PrimaryButton label="新規登録" onPress={onRegister} />
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: THEME.placeholder,
    marginBottom: 16,
  },
  catch: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: THEME.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  bottom: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  spacer: {
    height: 12,
  },
})
