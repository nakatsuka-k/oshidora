/**
 * Email change start screen types
 */

export type EmailChangeStartScreenProps = {
  initialEmail?: string
  onBack: () => void
  onSendCode: (email: string) => Promise<string | void>
  onSent: (email: string, initialCode?: string) => void
}
