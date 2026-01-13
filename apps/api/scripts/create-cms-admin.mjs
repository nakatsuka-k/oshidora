#!/usr/bin/env node

// Generates a cms_admins INSERT SQL with PBKDF2(SHA-256) password hash.
// Matches apps/api/src/index.ts: salt 16 bytes, hash 32 bytes, iterations 100_000.

import crypto from 'node:crypto'

function usage() {
  console.log(`Usage:
  node ./scripts/create-cms-admin.mjs --email you@example.com --name "Admin" --password "..." [--id cms_...] [--role Admin]

Outputs JSON + an INSERT statement for cms_admins.
`)
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return ''
  return String(process.argv[idx + 1] ?? '').trim()
}

function base64Encode(u8) {
  return Buffer.from(u8).toString('base64')
}

async function pbkdf2HashPassword(password, saltBytes, iterations = 100_000) {
  const keyMaterial = await crypto.webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    32 * 8
  )
  return new Uint8Array(bits)
}

async function hashPasswordForStorage(password) {
  const salt = crypto.webcrypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2HashPassword(password, salt)
  return { saltB64: base64Encode(salt), hashB64: base64Encode(hash) }
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''")
}

async function main() {
  const email = getArg('--email').toLowerCase()
  const name = getArg('--name')
  const password = getArg('--password')
  const id = getArg('--id') || crypto.randomUUID()
  const role = getArg('--role') || 'Admin'

  if (!email || !name || !password) {
    usage()
    process.exitCode = 1
    return
  }

  const { saltB64, hashB64 } = await hashPasswordForStorage(password)
  const now = new Date().toISOString()

  const row = {
    id,
    email,
    name,
    role,
    password_salt: saltB64,
    password_hash: hashB64,
    disabled: 0,
    created_at: now,
    updated_at: now,
  }

  console.log(JSON.stringify(row, null, 2))
  console.log('')

  const sql =
    "INSERT INTO cms_admins (id, email, name, role, password_hash, password_salt, disabled, created_at, updated_at) VALUES (" +
    [
      row.id,
      row.email,
      row.name,
      row.role,
      row.password_hash,
      row.password_salt,
      String(row.disabled),
      row.created_at,
      row.updated_at,
    ]
      .map((v, i) => (i === 6 ? v : `'${escapeSqlString(v)}'`))
      .join(', ') +
    ');'

  console.log(sql)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
