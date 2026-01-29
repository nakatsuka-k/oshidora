import { useCallback, useEffect, useState } from 'react'
import { getBoolean, setBoolean, getString, setString } from '../utils/storage'

export const AUTH_TOKEN_KEY = 'auth_token'
export const DEBUG_AUTH_AUTOFILL_KEY = 'debug_auth_autofill'
export const DEBUG_USER_TYPE_KEY = 'debug_user_type'
export const DEBUG_PAYPAY_LINKED_KEY = 'debug_paypay_linked'

/**
 * Manages authentication state and token persistence
 */
export function useAuthState() {
  const [loggedIn, setLoggedIn] = useState<boolean>(false)
  const [authToken, setAuthToken] = useState<string>('')
  const [authPendingToken, setAuthPendingToken] = useState<string>('')
  const [authBusy, setAuthBusy] = useState<boolean>(false)

  // Debug flags
  const [debugAuthAutofill, setDebugAuthAutofill] = useState<boolean>(false)
  const [debugUserType, setDebugUserType] = useState<'user' | 'cast'>('user')
  const [debugPaypayLinked, setDebugPaypayLinked] = useState<boolean>(false)

  // Initialize auth state from storage
  useEffect(() => {
    void (async () => {
      try {
        const [token, autofill, userTypeValue, paypayLinked] = await Promise.all([
          getString(AUTH_TOKEN_KEY),
          getBoolean(DEBUG_AUTH_AUTOFILL_KEY),
          getString(DEBUG_USER_TYPE_KEY),
          getBoolean(DEBUG_PAYPAY_LINKED_KEY),
        ])
        if (token) {
          setAuthToken(token)
          setLoggedIn(true)
        }
        setDebugAuthAutofill(autofill)
        const t = (userTypeValue || '').trim()
        if (t === 'cast' || t === 'user') setDebugUserType(t)
        setDebugPaypayLinked(paypayLinked)
      } catch {
        // ignore
      }
    })()
  }, [])

  const setAuthTokenAndPersist = useCallback(async (token: string) => {
    setAuthToken(token)
    setLoggedIn(true)
    try {
      await setString(AUTH_TOKEN_KEY, token)
    } catch {
      // ignore storage errors
    }
  }, [])

  const clearAuth = useCallback(async () => {
    setAuthToken('')
    setLoggedIn(false)
    setAuthPendingToken('')
    try {
      await setString(AUTH_TOKEN_KEY, '')
    } catch {
      // ignore storage errors
    }
  }, [])

  const toggleDebugUserType = useCallback(async () => {
    const next = debugUserType === 'user' ? 'cast' : 'user'
    setDebugUserType(next)
    try {
      await setString(DEBUG_USER_TYPE_KEY, next)
    } catch {
      // ignore storage errors
    }
  }, [debugUserType])

  return {
    loggedIn,
    setLoggedIn,
    authToken,
    setAuthToken: setAuthTokenAndPersist,
    authPendingToken,
    setAuthPendingToken,
    authBusy,
    setAuthBusy,
    debugAuthAutofill,
    setDebugAuthAutofill,
    debugUserType,
    toggleDebugUserType,
    debugPaypayLinked,
    setDebugPaypayLinked,
    clearAuth,
  }
}
