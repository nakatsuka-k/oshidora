import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { PrimaryButton, ScreenContainer, SecondaryButton, THEME } from '../components'

function XIcon({ size = 20, color = THEME.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18.901 2H22l-6.77 7.73L23.2 22h-6.38l-4.99-6.02L6.55 22H3.45l7.24-8.27L1.2 2h6.54l4.51 5.47L18.9 2Zm-1.11 18.1h1.72L6.8 3.8H4.96l12.83 16.3Z"
        fill={color}
      />
    </Svg>
  )
}

function InstagramIcon({ size = 20, color = THEME.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9A3.5 3.5 0 0 0 20 16.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.75-2.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
        fill={color}
      />
    </Svg>
  )
}

function YouTubeIcon({ size = 20, color = THEME.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5A3 3 0 0 0 2.4 7.2 31.2 31.2 0 0 0 2 12s.1 3.7.4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.3-1.1.4-4.8.4-4.8s-.1-3.7-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"
        fill={color}
      />
    </Svg>
  )
}

function SnsIconButton({
  label,
  onPress,
  children,
}: {
  label: string
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={styles.snsButton}>
      {children}
    </Pressable>
  )
}

type WelcomeTopScreenProps = {
  onStart: () => void
  onLogin: () => void
}

export function WelcomeTopScreen({ onStart, onLogin }: WelcomeTopScreenProps) {
  const { width, height } = useWindowDimensions()
  const heroLogoSize = Math.max(160, Math.min(260, Math.round(width * 0.45)))
  const headerHeight = 64
  const bgTopHeight = Math.max(340, Math.min(560, Math.round(height * 0.6)))
  const bgBottomHeight = Math.max(320, Math.min(560, Math.round(height * 0.55)))

  const showLocalFooter =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '8081' &&
    (window.location.hash === '#/welcome' || window.location.hash.startsWith('#/welcome?'))

  const openExternal = (url: string) => {
    if (typeof window === 'undefined') return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <ScreenContainer padding={0}>
      <View style={styles.root}>
        <View style={styles.bgFrame} pointerEvents="none">
          <View style={[styles.bgTopWrap, { height: bgTopHeight }]}>
            <Image source={require('../assets/oshidora-top-bg.png')} style={styles.bgImage} resizeMode="cover" />
          </View>
          <View style={[styles.bgBottomWrap, { height: bgBottomHeight }]}>
            <Image source={require('../assets/oshidora-top-bg-2.png')} style={styles.bgImage} resizeMode="cover" />
          </View>
        </View>
        <View style={styles.bgOverlayTopWrap} pointerEvents="none">
          <View style={styles.bgOverlayTopInner} />
        </View>
        <View style={styles.bgOverlayBottomWrap} pointerEvents="none">
          <View style={styles.bgOverlayBottomInner} />
        </View>

        <View style={styles.header}>
          <View style={styles.headerInner}>
            <Image source={require('../assets/oshidora-logo.png')} style={styles.headerLogo} resizeMode="contain" />
            <View style={styles.headerSpacer} />
            <SecondaryButton label="ログイン" onPress={onLogin} fullWidth={false} />
          </View>
        </View>

        <View style={styles.body}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 10 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
            <Image
              source={require('../assets/oshidora-logo.png')}
              style={[styles.heroLogo, { width: heroLogoSize, height: heroLogoSize }]}
              resizeMode="contain"
            />
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
          </ScrollView>

          {showLocalFooter ? (
            <View style={styles.footer}>
              <View style={styles.footerInner}>
                <View style={styles.footerCol}>
                  <Text style={styles.footerText}>XXX株式会社</Text>
                  <Text style={styles.footerMuted}>© 2026 XXX</Text>
                </View>

                <View style={styles.footerColRight}>
                  <View style={styles.footerSns}>
                    <SnsIconButton label="X" onPress={() => openExternal('https://x.com/')}>
                      <XIcon />
                    </SnsIconButton>
                    <SnsIconButton label="Instagram" onPress={() => openExternal('https://www.instagram.com/')}>
                      <InstagramIcon />
                    </SnsIconButton>
                    <SnsIconButton label="YouTube" onPress={() => openExternal('https://www.youtube.com/')}>
                      <YouTubeIcon />
                    </SnsIconButton>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 0,
  },
  bgFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  bgTopWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bgBottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bgImage: {
    width: '100%',
    maxWidth: 1440,
    height: '100%',
  },
  bgOverlayTopWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    alignItems: 'center',
  },
  bgOverlayTopInner: {
    width: '100%',
    maxWidth: 1440,
    height: '100%',
    backgroundColor: THEME.card,
    opacity: 0.5,
  },
  bgOverlayBottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 360,
    alignItems: 'center',
  },
  bgOverlayBottomInner: {
    width: '100%',
    maxWidth: 1440,
    height: '100%',
    backgroundColor: THEME.card,
    opacity: 0.65,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: THEME.bg,
  },
  headerInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    width: 132,
    height: 34,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 32,
    paddingHorizontal: 12,
  },
  heroLogo: {
    marginBottom: 14,
  },
  heroTitle: {
    color: THEME.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  heroSub: {
    color: THEME.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 520,
    marginBottom: 18,
  },
  cta: {
    width: '100%',
    maxWidth: 420,
    marginBottom: 14,
  },
  inlineLogin: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  footer: {
    width: '100%',
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.outline,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  footerInner: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerCol: {
    flex: 1,
  },
  footerColRight: {
    alignItems: 'flex-end',
  },
  footerTitle: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  footerText: {
    color: THEME.text,
    fontSize: 12,
    lineHeight: 18,
  },
  footerMuted: {
    marginTop: 8,
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  footerSns: {
    flexDirection: 'row',
    gap: 10,
  },
  snsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
