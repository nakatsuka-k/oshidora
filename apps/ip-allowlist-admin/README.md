# IP Allowlist Admin

Shared-D1 backed UI to manage `access_ip_allowlist`.

## Auth

This worker is protected via HTTP Basic Auth.

- Username: `ALLOWLIST_ADMIN_USER` (default: `admin`)
- Password (secret): `ALLOWLIST_ADMIN_PASSWORD`

Set the secret:

```sh
cd apps/ip-allowlist-admin
wrangler secret put ALLOWLIST_ADMIN_PASSWORD
```

## Dev

```sh
npm --prefix apps/ip-allowlist-admin install
npm --prefix apps/ip-allowlist-admin run dev
```

## Deploy

```sh
npm --prefix apps/ip-allowlist-admin run deploy
```

Then attach a route / custom domain in Cloudflare as needed.
