#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadResultPath = path.resolve(__dirname, '../seed-images-generated/upload-result.json')
const outSqlPath = path.resolve(__dirname, '../seed-images-generated/update-cast-profile-images-loop.sql')

function isAssetUrl(url) {
  return typeof url === 'string' && url.startsWith('https://assets.oshidra.com/')
}

function main() {
  if (!fs.existsSync(uploadResultPath)) {
    console.error('❌ upload-result.json が見つかりません:', uploadResultPath)
    process.exit(1)
  }

  const uploadResult = JSON.parse(fs.readFileSync(uploadResultPath, 'utf-8'))
  const uploadedUrls = uploadResult?.uploadedUrls || {}

  // Collect existing uploaded castProfiles URLs (seed_cast_XXX-N)
  // We reuse these URLs to fill 10 slots per cast.
  const pool = Object.keys(uploadedUrls)
    .filter((k) => /^seed_cast_\d{3}-\d+$/.test(k))
    .map((k) => uploadedUrls[k])
    .filter(isAssetUrl)

  const uniquePool = Array.from(new Set(pool))

  if (uniquePool.length === 0) {
    console.error('❌ castProfiles のURLプールが空です。先に castProfiles を uploader-open へアップロードしてください。')
    process.exit(1)
  }

  const castIds = Array.isArray(uploadResult?.files?.castProfiles)
    ? Array.from(
        new Set(
          uploadResult.files.castProfiles
            .map((f) => String(f?.id ?? '').trim())
            .filter((v) => v && /^seed_cast_\d{3}$/.test(v))
        )
      ).sort()
    : []

  // Fallback to the known production set for /profile page
  const defaultCastIds = Array.from({ length: 10 }, (_, i) => `seed_cast_${String(i + 1).padStart(3, '0')}`)
  const targetCastIds = castIds.length >= 10 ? castIds : defaultCastIds

  const imageCount = Number(process.env.SEED_CAST_PROFILE_IMAGE_COUNT || 10)

  let sql = ''
  sql += '-- Auto-generated: fill cast_staff_profiles.profile_images_json by looping existing castProfiles URLs\n'
  sql += `-- generatedAt: ${new Date().toISOString()}\n`
  sql += `-- poolSize: ${uniquePool.length}, imageCountPerCast: ${imageCount}, casts: ${targetCastIds.length}\n\n`

  targetCastIds.forEach((castId, castIndex) => {
    const urls = []
    for (let j = 0; j < imageCount; j++) {
      const idx = (castIndex * imageCount + j) % uniquePool.length
      urls.push(uniquePool[idx])
    }

    const json = JSON.stringify(urls)
    const escaped = json.replaceAll("'", "''")

    sql += `UPDATE cast_staff_profiles SET profile_images_json='${escaped}', updated_at=datetime('now') WHERE cast_id='${castId}';\n`
  })

  fs.writeFileSync(outSqlPath, sql)
  console.log(`✅ Wrote: ${outSqlPath}`)
  console.log(`ℹ️ poolSize=${uniquePool.length} casts=${targetCastIds.length} imageCount=${imageCount}`)
}

main()
