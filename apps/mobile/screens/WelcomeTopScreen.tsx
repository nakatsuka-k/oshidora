import { Image, Pressable, StyleSheet, View } from 'react-native'
import { ScreenContainer } from '../components'

type WelcomeTopScreenProps = {
  onNext: () => void
}

export function WelcomeTopScreen({ onNext }: WelcomeTopScreenProps) {
  return (
    <ScreenContainer maxWidth={520}>
      <Pressable style={styles.root} onPress={onNext} accessibilityRole="button">
        <View style={styles.center}>
          <Image source={require('../assets/oshidora-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
      </Pressable>
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
    width: 220,
    height: 220,
    marginBottom: 28,
  },
})
