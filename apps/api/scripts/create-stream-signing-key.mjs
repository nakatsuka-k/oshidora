// Creates a Cloudflare Stream Signed URL signing key.
// Required env:
// - CLOUDFLARE_ACCOUNT_ID
// - CLOUDFLARE_STREAM_API_TOKEN
//
// Usage:
//   cd apps/api
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_STREAM_API_TOKEN=... node scripts/create-stream-signing-key.mjs

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_STREAM_API_TOKEN

if (!accountId || !token) {
  console.error('Missing env. Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN')
  process.exit(1)
}

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/keys`

const resp = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
})

const data = await resp.json().catch(() => null)

if (!resp.ok || !data?.success) {
  console.error('Failed to create signing key')
  console.error('HTTP', resp.status)
  console.error(JSON.stringify(data, null, 2))
  process.exit(2)
}

const result = data.result ?? {}
const keyId = result.id ?? result.kid ?? null
const keyJwk = result.jwk ?? null
const keyPem = result.pem ?? null

console.log('Created Stream signing key')
console.log(JSON.stringify({ keyId, keyJwk, keyPem, result }, null, 2))

if (!keyId || !keyJwk) {
  console.log('\nNOTE: Could not extract keyId/keyJwk automatically. Use the `result` object above.')
} else {
  console.log('\nNext steps (DO NOT COMMIT THESE VALUES):')
  console.log(`- Set CLOUDFLARE_STREAM_SIGNING_KEY_ID=${keyId}`)
  console.log(`- Set CLOUDFLARE_STREAM_SIGNING_KEY_JWK=<paste the keyJwk string shown above>`)
}
