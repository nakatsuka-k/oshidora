/**
 * Phone screen types
 */

export type Props = {
  phoneNumber: string
  onChangePhoneNumber: (value: string) => void
  fieldError: string
  bannerError: string
  canNext: boolean
  onBack: () => void
  onNext: () => void
}
