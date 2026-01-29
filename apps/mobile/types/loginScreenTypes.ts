/**
 * Login screen types
 */

export type LoginFieldErrors = {
  email?: string
  password?: string
}

export type Props = {
  email: string
  password: string
  fieldErrors: LoginFieldErrors
  bannerError: string
  busy: boolean
  onChangeEmail: (value: string) => void
  onChangePassword: (value: string) => void
  onCancel: () => void
  onNext: () => void
  canNext: boolean
}
