#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadResultPath = path.resolve(__dirname, '../seed-images-generated/upload-result.json')
const outSqlPath = path.resolve(__dirname, '../seed-images-generated/update-cast-profile-images.sql')

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

  const castCount = Number(process.env.SEED_CAST_COUNT || 10)
  const profileImageCount = Number(process.env.SEED_CAST_PROFILE_IMAGE_COUNT || 10)

  let sql = ''
  sql += '-- Auto-generated: update cast_staff_profiles.profile_images_json (vertical 9:16)\n'
  sql += `-- generatedAt: ${new Date().toISOString()}\n`
  sql += `-- castCount: ${castCount}, profileImageCount: ${profileImageCount}\n\n`

  for (let i = 1; i <= castCount; i++) {
    const castId = `seed_cast_${String(i).padStart(3, '0')}`
    const urls = []

    for (let j = 1; j <= profileImageCount; j++) {
      const key = `${castId}-${j}`
      urls.push(mustGetUploadedUrl(uploadedUrls, key))
    }

    const json = JSON.stringify(urls)
    sql += `UPDATE cast_staff_profiles SET profile_images_json='${json.replaceAll("'", "''")}', updated_at=datetime('now') WHERE cast_id='${castId}';\n`
  }

  fs.writeFileSync(outSqlPath, sql)
  console.log(`✅ Wrote: ${outSqlPath}`)
}

main()
