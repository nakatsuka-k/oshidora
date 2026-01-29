export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  // NOTE: Intentionally do not set X-Mock.

  return await fetch(input, {
    ...init,
    headers,
  })
}
