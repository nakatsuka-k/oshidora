import { SafeAreaView, Text, View } from 'react-native'

import { ScreenContainer, SecondaryButton } from '../components'
import type { Props } from '../types/maintenanceScreenTypes'

export function MaintenanceScreen(props: Props) {
  return (
    <SafeAreaView style={props.styles.safeArea}>
      <ScreenContainer title="メンテナンス中">
        <View style={props.styles.ipGate}>
          <Text style={props.styles.ipGateTitle}>現在メンテナンス中です</Text>
          <Text style={props.styles.ipGateText}>{props.message || 'しばらくお待ちください。'}</Text>
          <View style={{ height: 12 }} />
          <SecondaryButton label="再読み込み" onPress={props.onReload} />
          {!props.checkedOnce ? (
            <Text style={[props.styles.ipGateText, { marginTop: 10 }]}>状態を確認中…</Text>
          ) : null}
        </View>
      </ScreenContainer>
    </SafeAreaView>
  )
}
