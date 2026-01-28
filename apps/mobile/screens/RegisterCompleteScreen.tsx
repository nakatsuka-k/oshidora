import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { PrimaryButton, ScreenContainer, THEME } from '../components'

type RegisterCompleteScreenProps = {
  onGoVideos: () => void
}

export function RegisterCompleteScreen({ onGoVideos }: RegisterCompleteScreenProps) {
  return (
    <ScreenContainer title="登録完了">
      <View style={styles.root}>
        <View style={styles.center}>
          <View style={styles.badge} accessibilityRole="image" accessibilityLabel="登録完了">
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20 6 9 17l-5-5"
                stroke={THEME.accent}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <Text style={styles.title}>プロフィール登録が完了しました</Text>
          <Text style={styles.desc}>さっそく動画を見てみましょう</Text>
        </View>

        <View style={styles.bottom}>
          <PrimaryButton label="動画一覧へ" onPress={onGoVideos} />
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
    paddingTop: 10,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(244, 176, 27, 0.10)',
    borderWidth: 1,
    borderColor: THEME.outline,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  desc: {
    color: THEME.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  bottom: {
    paddingTop: 16,
    paddingBottom: 8,
  },
})
