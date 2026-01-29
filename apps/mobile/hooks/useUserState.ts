import { useState } from 'react'

export type UserProfile = {
  displayName: string
  fullName: string
  fullNameKana: string
  email: string
  phone: string
  birthDate: string
  favoriteGenres: string[]
  avatarUrl?: string
}

const DEFAULT_USER_PROFILE: UserProfile = {
  displayName: '',
  fullName: '',
  fullNameKana: '',
  email: '',
  phone: '',
  birthDate: '',
  favoriteGenres: [],
  avatarUrl: undefined,
}

/**
 * Manages user profile and registration state
 */
export function useUserState() {
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE)

  // Registration form state
  const [registerEmail, setRegisterEmail] = useState<string>('')
  const [registerPassword, setRegisterPassword] = useState<string>('')
  const [registerPhone, setRegisterPhone] = useState<string>('')

  // Email/Phone change state
  const [emailChangeEmail, setEmailChangeEmail] = useState<string>('')
  const [debugEmailChangeCode, setDebugEmailChangeCode] = useState<string>('')
  const [debugPhoneChangeCode, setDebugPhoneChangeCode] = useState<string>('')

  // UI state
  const [termsReadOnly, setTermsReadOnly] = useState<boolean>(false)
  const [postLoginTarget, setPostLoginTarget] = useState<string | null>(null)

  return {
    userProfile,
    setUserProfile,
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    registerPhone,
    setRegisterPhone,
    emailChangeEmail,
    setEmailChangeEmail,
    debugEmailChangeCode,
    setDebugEmailChangeCode,
    debugPhoneChangeCode,
    setDebugPhoneChangeCode,
    termsReadOnly,
    setTermsReadOnly,
    postLoginTarget,
    setPostLoginTarget,
  }
}
