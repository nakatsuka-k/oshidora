import { getBoolean } from './storage'

export const DEBUG_MOCK_KEY = 'debug_mock_v1'

export async function isDebugMockEnabled(): Promise<boolean> {
  // App-side mock is disabled.
  return false
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  // NOTE: Intentionally do not set X-Mock.

  return await fetch(input, {
    ...init,
    headers,
  })
}
