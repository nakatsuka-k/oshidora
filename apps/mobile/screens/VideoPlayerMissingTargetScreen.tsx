import { ActivityIndicator, Text, View } from 'react-native'

import { PrimaryButton, ScreenContainer } from '../components'

type Props = {
  styles: any
  hydrating: boolean
  onBack: () => void
  onGoHome: () => void
}

export function VideoPlayerMissingTargetScreen(props: Props) {
  return (
    <ScreenContainer title="再生" onBack={props.onBack}>
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
        {props.hydrating ? (
          <>
            <ActivityIndicator />
            <View style={{ height: 12 }} />
            <Text style={props.styles.centerText}>動画情報を取得中です…</Text>
          </>
        ) : (
          <Text style={props.styles.centerText}>動画が未指定です。{`\n`}作品詳細から再生してください。</Text>
        )}
        <View style={{ height: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <PrimaryButton label="ホームへ" onPress={props.onGoHome} />
        </View>
      </View>
    </ScreenContainer>
  )
}
