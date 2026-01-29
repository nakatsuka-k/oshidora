/**
 * OTP screen types
 */

import { TextInput } from 'react-native'

export type Props = {
  otpDigits: string[]
  otpRefs: React.MutableRefObject<Array<TextInput | null>>
  bannerError: string
  fieldError: string
  busy: boolean
  canNext: boolean
  onBack: () => void
  onCancel: () => void
  onNext: () => void
  onChangeDigit: (index: number, value: string) => void
  onKeyPress: (index: number, key: string) => void
}
