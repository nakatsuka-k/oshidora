import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useMemo } from 'react'
import { Image, ImageBackground, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { THEME } from './theme'

type Props = {
  visible: boolean
  thumbnailUrl?: string | null
  workTitle?: string | null
  onClose: () => void
  onStartTrial: () => void
}

export function SubscriptionPromptModal({ visible, thumbnailUrl, workTitle, onClose, onStartTrial }: Props) {
  const title = useMemo(() => (workTitle?.trim() ? workTitle.trim() : '作品詳細'), [workTitle])

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        {...(Platform.OS === 'web'
          ? ({
              role: 'button',
              'aria-label': 'close subscription prompt',
            } as any)
          : null)}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.backdropDim} />

        <Pressable
          onPress={() => {
            // Prevent backdrop close when tapping inside.
          }}
          style={styles.card}
        >
          <View style={styles.heroWrap}>
            <ImageBackground
              source={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
              resizeMode="cover"
              style={styles.hero}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
              />

              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>

              <View style={styles.heroCenter}>
                <Image source={require('../assets/oshidora_logo.png')} style={styles.logo} resizeMode="contain" />
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {title}
                </Text>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.body}>
            <Text style={styles.headline}>推しポイントを送って、{`\n`}あなたの推しを応援しよう！</Text>

            <View style={styles.bullets}>
              <Bullet>毎月、推しポイントを付与</Bullet>
              <Bullet>全ての動画が見放題</Bullet>
            </View>

            <Text style={styles.subHeadline}>新規登録なら1カ月無料！{`\n`}解約はいつでも可能。</Text>

            <Pressable style={styles.ctaButton} onPress={onStartTrial} accessibilityRole="button" accessibilityLabel="まずは無料トライアル">
              <Text style={styles.ctaText}>まずは無料トライアル</Text>
            </Pressable>

            <Text style={styles.finePrint}>無料期間終了後は、¥2,000/月で自動更新。{`\n`}更新前に解約することも可能です。</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>✓</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  backdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroWrap: {
    width: '100%',
  },
  hero: {
    height: 190,
    width: '100%',
    justifyContent: 'flex-end',
  },
  heroImage: {
    transform: [{ scale: 1.02 }],
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: THEME.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: -1,
  },
  heroCenter: {
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  logo: {
    width: 120,
    height: 28,
    marginBottom: 8,
    opacity: 0.95,
  },
  heroTitle: {
    color: '#E7D3A2',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headline: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24,
  },
  bullets: {
    marginTop: 12,
    alignItems: 'center',
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletMark: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: '900',
    width: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
  bulletText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  subHeadline: {
    marginTop: 14,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 18,
  },
  ctaButton: {
    marginTop: 12,
    backgroundColor: THEME.accent,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  ctaText: {
    color: '#0B0B0B',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  finePrint: {
    marginTop: 10,
    color: 'rgba(230,230,230,0.55)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
})
