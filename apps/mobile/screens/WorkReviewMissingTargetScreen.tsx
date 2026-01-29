import { Text, View } from 'react-native'

import { PrimaryButton, ScreenContainer, SecondaryButton } from '../components'

type Props = {
  styles: any
  onBack: () => void
  onGoDev: () => void
  onGoHome: () => void
}

export function WorkReviewMissingTargetScreen(props: Props) {
  return (
    <ScreenContainer title="評価" onBack={props.onBack}>
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24 }}>
        <Text style={props.styles.centerText}>
          対象の作品が未選択です。{`\n`}作品詳細から「☆」を押して開いてください。
        </Text>
        <View style={{ height: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <SecondaryButton label="Developer" onPress={props.onGoDev} />
          <PrimaryButton label="ホームへ" onPress={props.onGoHome} />
        </View>
      </View>
    </ScreenContainer>
  )
}
