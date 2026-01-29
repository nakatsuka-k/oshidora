import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useMemo } from 'react'
import { ImageBackground, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
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

  const heroSource = useMemo(() => {
    const t = String(thumbnailUrl ?? '').trim()
    if (t) return { uri: t }
    // Fallback: use the same top background image to keep visual consistency.
    return require('../../img/app_top_01.png')
  }, [thumbnailUrl])

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          // Don't close on backdrop tap (誤タップ防止)
        }}
        {...(Platform.OS === 'web'
          ? ({
              role: 'presentation',
              'aria-label': `subscription prompt: ${title}`,
            } as any)
          : null)}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.backdropDim} />

        <View style={styles.panel}>
          <View style={styles.heroWrap}>
            <ImageBackground
              source={heroSource}
              resizeMode="cover"
              style={styles.hero}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,1)']}
                locations={[0, 0.45, 0.82, 1]}
                style={StyleSheet.absoluteFill}
              />

              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </ImageBackground>
          </View>

          <View style={styles.body}>
            <Text style={styles.headline}>
              推しポイントを送って、{`\n`}あなたの推しを応援しよう！
            </Text>

            <View style={styles.bullets}>
              <Bullet>毎月、推しポイントを付与</Bullet>
              <Bullet>全ての動画が見放題</Bullet>
            </View>

            <Text style={styles.subHeadline}>
              <Text style={styles.subHeadlineStrong}>新規登録なら1カ月無料！</Text>
              {`\n`}解約はいつでも可能。
            </Text>

            <Pressable style={styles.ctaButton} onPress={onStartTrial} accessibilityRole="button" accessibilityLabel="まずは無料トライアル">
              <Text style={styles.ctaText}>まずは無料トライアル</Text>
            </Pressable>

            <Text style={styles.finePrint}>無料期間終了後は、¥2,000/月で自動更新。{`\n`}更新前に解約することも可能です。</Text>
          </View>
        </View>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  panel: {
    width: '88%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0E0E0E',
  },
  heroWrap: {
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  hero: {
    height: 210,
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: THEME.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: -1,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headline: {
    color: THEME.text,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
  },
  bullets: {
    marginTop: 12,
    alignSelf: 'center',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletMark: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '800',
    width: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
  bulletText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
  },
  subHeadline: {
    marginTop: 14,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  subHeadlineStrong: {
    fontWeight: '800',
    color: THEME.text,
  },
  ctaButton: {
    marginTop: 12,
    backgroundColor: THEME.accent,
    borderRadius: 999,
    height: 48,
    width: '100%',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
})
