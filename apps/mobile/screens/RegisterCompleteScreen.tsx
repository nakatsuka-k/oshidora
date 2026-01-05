import { StyleSheet, Text, View } from 'react-native'
import { PrimaryButton, ScreenContainer, THEME } from '../components'

type RegisterCompleteScreenProps = {
  onGoVideos: () => void
}

export function RegisterCompleteScreen({ onGoVideos }: RegisterCompleteScreenProps) {
  return (
    <ScreenContainer title="登録完了" maxWidth={520}>
      <View style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.title}>登録が完了しました</Text>
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
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.placeholder,
    marginBottom: 16,
  },
  title: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  desc: {
    color: THEME.textMuted,
    fontSize: 12,
  },
  bottom: {
    paddingTop: 16,
    paddingBottom: 8,
  },
})
