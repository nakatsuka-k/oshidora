#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadResultPath = path.resolve(__dirname, '../seed-images-generated/upload-result.json')
const outSqlPath = path.resolve(__dirname, '../seed-images-generated/update-casts-faces.sql')

function mustGetUploadedUrl(uploadedUrls, key) {
  const url = uploadedUrls?.[key]
  if (url == null || url === '') throw new Error(`Missing uploadedUrls[${key}]`) 
  if (!String(url).startsWith('https://assets.oshidra.com/')) {
    throw new Error(`Unexpected url for ${key}: ${url}`)
  }
  return String(url)
}

function main() {
  if (!fs.existsSync(uploadResultPath)) {
    console.error('❌ upload-result.json が見つかりません:', uploadResultPath)
    process.exit(1)
  }

  const uploadResult = JSON.parse(fs.readFileSync(uploadResultPath, 'utf-8'))
  const uploadedUrls = uploadResult?.uploadedUrls || {}

  let sql = ''
  sql += '-- Auto-generated: update seed casts to latest castFaces assets URLs\n'
  sql += `-- generatedAt: ${new Date().toISOString()}\n\n`

  for (let i = 1; i <= 24; i++) {
    const castId = `seed_cast_${String(i).padStart(3, '0')}`
    const url = mustGetUploadedUrl(uploadedUrls, castId)
    sql += `UPDATE casts SET thumbnail_url='${url}', updated_at=datetime('now') WHERE id='${castId}';\n`
  }

  sql += '\n'

  // Cast/staff profiles exist only for seed_cast_001..010 in current seed set.
  for (let i = 1; i <= 10; i++) {
    const castId = `seed_cast_${String(i).padStart(3, '0')}`
    const url = mustGetUploadedUrl(uploadedUrls, castId)
    sql += `UPDATE cast_staff_profiles SET face_image_url='${url}', updated_at=datetime('now') WHERE cast_id='${castId}';\n`
  }

  fs.writeFileSync(outSqlPath, sql)
  console.log(`✅ Wrote: ${outSqlPath}`)
}

main()
