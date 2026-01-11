import { getBoolean } from './storage'

export const DEBUG_MOCK_KEY = 'debug_mock_v1'

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const mock = await getBoolean(DEBUG_MOCK_KEY)

  const headers = new Headers(init?.headers)
  if (mock) headers.set('X-Mock', '1')

  return await fetch(input, {
    ...init,
    headers,
  })
}
