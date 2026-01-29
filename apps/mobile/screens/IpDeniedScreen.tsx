import { SafeAreaView, Text, View } from 'react-native'

import { ScreenContainer, SecondaryButton } from '../components'

type IpInfo = {
  ip?: string
  city?: string
  region?: string
  country?: string
}

type Props = {
  styles: any
  ipInfo: IpInfo | null
  ipError: string | null
  onRetry: () => void
}

export function IpDeniedScreen(props: Props) {
  return (
    <SafeAreaView style={props.styles.safeArea}>
      <ScreenContainer title="Access Denied">
        <View style={props.styles.ipGate}>
          <Text style={props.styles.ipGateTitle}>このIPは許可されていません</Text>
          <Text style={props.styles.ipGateText}>許可IPに追加してください。</Text>
          <View style={props.styles.ipGateBox}>
            <Text style={props.styles.ipGateMono}>IP: {props.ipInfo?.ip || '(unknown)'}</Text>
            {props.ipInfo?.city || props.ipInfo?.region || props.ipInfo?.country ? (
              <Text style={props.styles.ipGateMono}>
                {props.ipInfo?.country || ''} {props.ipInfo?.region || ''} {props.ipInfo?.city || ''}
              </Text>
            ) : null}
            {props.ipError ? <Text style={props.styles.ipGateError}>{props.ipError}</Text> : null}
          </View>
          <SecondaryButton label="再取得" onPress={props.onRetry} />
        </View>
      </ScreenContainer>
    </SafeAreaView>
  )
}
