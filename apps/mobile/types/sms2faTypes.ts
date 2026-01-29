/**
 * SMS 2FA screen types
 */

export type Sms2faScreenProps = {
  onBack: () => void
  onSendCode: (phone: string) => Promise<string | void>
  onVerifyCode: (phone: string, code: string) => Promise<void>
  onComplete: (phone: string) => void
  initialCode?: string
}
