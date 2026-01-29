import { Text, View } from 'react-native'

import { PrimaryButton, ScreenContainer, SecondaryButton } from '../components'
import type { Props } from '../types/commentMissingTargetScreenTypes'

export function CommentMissingTargetScreen(props: Props) {
  return (
    <ScreenContainer title="コメント" onBack={props.onBack}>
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 420 }}>
          <Text style={props.styles.centerText}>
            対象の作品が未選択です。{`\n`}作品詳細から「コメントを書く」を開いてください。
          </Text>
          <View style={{ height: 16 }} />
          <View style={{ width: '100%' }}>
            <SecondaryButton label="Developer" onPress={props.onGoDev} />
            <View style={{ height: 10 }} />
            <PrimaryButton label="ホームへ" onPress={props.onGoHome} />
          </View>
        </View>
      </View>
    </ScreenContainer>
  )
}
