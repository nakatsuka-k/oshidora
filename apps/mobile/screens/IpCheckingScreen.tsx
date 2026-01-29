import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native'

import { ScreenContainer } from '../components'
import type { Props } from '../types/ipCheckingScreenTypes'

export function IpCheckingScreen(props: Props) {
  return (
    <SafeAreaView style={props.styles.safeArea}>
      <ScreenContainer title="IP確認中">
        <View style={props.styles.ipGate}>
          <ActivityIndicator />
          <Text style={props.styles.ipGateText}>アクセス元IPを確認しています…</Text>
        </View>
      </ScreenContainer>
    </SafeAreaView>
  )
}
