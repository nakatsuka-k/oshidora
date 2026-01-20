import { LinearGradient } from 'expo-linear-gradient'
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer } from '../components'

type WelcomeTopScreenProps = {
  onStart: () => void
  onLogin: () => void
}

export function WelcomeTopScreen({ onStart, onLogin }: WelcomeTopScreenProps) {
  return (
    <ScreenContainer padding={0}>
      <View style={styles.root}>
        <ImageBackground
          source={require('../../img/app_top_01.png')}
          style={styles.bg}
          resizeMode="cover"
          imageStyle={styles.bgImage}
        />
        <View style={styles.content}>
          <Image source={require('../assets/oshidora-logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroTitle}>ショートドラマを、もっと近くに。</Text>
          <Text style={styles.heroSub}>推しドラは、好きな作品をいつでも楽しめるショートドラマサービスです。</Text>
          <Text style={styles.heroSub}>気になる作品を見つけて、すぐに楽しめます。</Text>

          <View style={styles.cta}>
            <PrimaryButton label="はじめる" onPress={onStart} />
          </View>

          <Pressable onPress={onLogin} accessibilityRole="button" hitSlop={10}>
            <Text style={styles.inlineLogin}>すでにアカウントをお持ちですか？ ログイン</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0B0B0B',
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
  },
  bgImage: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  heroLogo: {
    width: 300,
    height: 162,
    marginBottom: 18,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 768,
    marginBottom: 12,
  },
  cta: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 10,
  },
  inlineLogin: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
})
