/**
 * Email verify screen types
 */

export type EmailVerifyScreenProps = {
  email: string
  onResend: () => Promise<void>
  onVerify: (code: string) => Promise<void>
  onBack: () => void
  initialCode?: string
}
