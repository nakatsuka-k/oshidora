import { LinearGradient } from 'expo-linear-gradient'
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, THEME } from '../components'

type WelcomeTopScreenProps = {
  onStart: () => void
  onLogin: () => void
  onContinueAsGuest?: () => void
}

export function WelcomeTopScreen({ onStart, onLogin, onContinueAsGuest }: WelcomeTopScreenProps) {
  return (
    <ScreenContainer padding={0}>
      <View style={styles.root}>
        <ImageBackground
          source={require('../../img/app_top_01.png')}
          style={styles.bg}
          resizeMode="cover"
          imageStyle={styles.bgImage}
        />
        <View pointerEvents="none" style={styles.overlay} />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(11, 11, 11, 0)', 'rgba(11, 11, 11, 0.25)', 'rgba(11, 11, 11, 0.9)', 'rgba(11, 11, 11, 1)']}
          locations={[0, 0.45, 0.82, 1]}
          style={styles.gradient}
        />
        <View style={styles.content}>
          <Image source={require('../assets/oshidora-logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroTitle}>推しの夢 あなたの力で実現！</Text>
          <Text style={styles.heroSub}>若手俳優や若手クリエイターの才能を応援し、新しい才能の誕生に立ち会う。</Text>
          <Text style={styles.heroSub}>あなたの「推し」への想いが、次世代のエンターテインメントを創り出す新しいカタチをご紹介します。</Text>

          <View style={styles.cta}>
            <PrimaryButton label="はじめる" onPress={onStart} />
          </View>

          {onContinueAsGuest ? (
            <Pressable onPress={onContinueAsGuest} accessibilityRole="button" hitSlop={10}>
              <Text style={styles.inlineGuest}>ログインせずに使用する</Text>
            </Pressable>
          ) : null}

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
    backgroundColor: THEME.bg,
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
    height: '80%',
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
  inlineGuest: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
})
