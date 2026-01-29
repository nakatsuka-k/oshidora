import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { PrimaryButton, ScreenContainer, THEME } from '../components'
import { type Props } from '../types/phoneScreenTypes'

export function PhoneScreen(props: Props) {
  return (
    <ScreenContainer
      title="SMS認証"
      onBack={props.onBack}
      backgroundColor={THEME.bg}
      background={
        <>
          <View style={styles.smsBgBase} />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.7 }}
            style={styles.smsBgTopGlow}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.80)']}
            locations={[0, 0.6, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.smsBgVignette}
          />
        </>
      }
    >
      <View style={styles.smsSendRoot}>
        {props.bannerError ? <Text style={styles.bannerError}>{props.bannerError}</Text> : null}

        <View style={styles.smsField}>
          <Text style={styles.smsLabel}>電話番号</Text>
          <TextInput
            value={props.phoneNumber}
            onChangeText={props.onChangePhoneNumber}
            placeholder="電話番号"
            placeholderTextColor={THEME.textMuted}
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={[styles.smsInput, props.fieldError ? styles.inputError : null]}
          />
          {props.fieldError ? <Text style={styles.fieldError}>{props.fieldError}</Text> : null}
        </View>

        <Text style={styles.smsHint}>登録用の認証コードを、SMS（携帯電話番号宛）に送信します。</Text>

        <View style={styles.smsButtonWrap}>
          <PrimaryButton label="認証コードを送信" onPress={props.onNext} disabled={!props.canNext} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  smsBgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.bg,
  },
  smsBgTopGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  smsBgVignette: {
    ...StyleSheet.absoluteFillObject,
  },
  smsSendRoot: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 12,
    minHeight: 320,
  },
  bannerError: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '700',
  },
  smsField: {
    gap: 8,
  },
  smsLabel: {
    color: '#E6E6E6',
    fontSize: 12,
    fontWeight: '800',
  },
  smsInput: {
    borderWidth: 1,
    borderColor: THEME.outline,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#E6E6E6',
    fontSize: 14,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  fieldError: {
    color: '#FF3B30',
    fontSize: 11,
    fontWeight: '700',
  },
  smsHint: {
    color: THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  smsButtonWrap: {
    marginTop: 8,
  },
})
