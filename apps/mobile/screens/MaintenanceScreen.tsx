import { useCallback, useState } from 'react'
import { ActivityIndicator, Image, SafeAreaView, Text, View } from 'react-native'

import { ScreenContainer, SecondaryButton } from '../components'
import type { Props } from '../types/maintenanceScreenTypes'

export function MaintenanceScreen(props: Props) {
  const [reloading, setReloading] = useState(false)
  const [reloadError, setReloadError] = useState('')

  const onPressReload = useCallback(async () => {
    if (reloading) return
    setReloading(true)
    setReloadError('')
    try {
      await Promise.resolve(props.onReload())
    } catch (e) {
      setReloadError(e instanceof Error ? e.message : String(e))
    } finally {
      setReloading(false)
    }
  }, [props, reloading])

  return (
    <SafeAreaView style={props.styles.safeArea}>
      <ScreenContainer>
        <View style={props.styles.ipGate}>
          <Image
            source={require('../assets/oshidora-logo.png')}
            style={{ width: 120, height: 120, marginBottom: 14 }}
            resizeMode="contain"
          />
          <Text style={props.styles.ipGateTitle}>現在メンテナンス中です</Text>
          <Text style={props.styles.ipGateText}>{props.message || 'しばらくお待ちください。'}</Text>
          <View style={{ height: 12 }} />
          <SecondaryButton
            label={reloading ? '確認中…' : '再読み込み'}
            onPress={() => void onPressReload()}
            disabled={reloading}
            containerStyle={{ flex: 0, width: 220, alignSelf: 'center' }}
          />
          {reloading ? (
            <View style={{ marginTop: 10 }}>
              <ActivityIndicator />
            </View>
          ) : null}
          {reloadError ? (
            <Text style={[props.styles.ipGateText, { marginTop: 10, color: '#ef4444' }]}>{reloadError}</Text>
          ) : null}
          {!props.checkedOnce ? (
            <Text style={[props.styles.ipGateText, { marginTop: 10 }]}>状態を確認中…</Text>
          ) : null}
        </View>
      </ScreenContainer>
    </SafeAreaView>
  )
}
