#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function pad3(n) {
  return String(n).padStart(3, '0')
}

function overlaySvg({ label, index, width, height }) {
  const hue = (index * 41) % 360
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hue}, 75%, 60%)" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#111" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#g)"/>

  <g filter="url(#shadow)">
    <circle cx="${Math.floor(width / 2)}" cy="${Math.floor(height * 0.38)}" r="${Math.floor(Math.min(width, height) * 0.18)}" fill="rgba(255,255,255,0.16)"/>
    <circle cx="${Math.floor(width / 2)}" cy="${Math.floor(height * 0.34)}" r="${Math.floor(Math.min(width, height) * 0.12)}" fill="rgba(255,255,255,0.35)"/>
  </g>

  <text x="${Math.floor(width * 0.08)}" y="${Math.floor(height * 0.10)}" font-size="${Math.floor(width * 0.07)}" font-family="Arial, Helvetica, sans-serif" fill="rgba(255,255,255,0.9)" filter="url(#shadow)">
    Oshidora
  </text>

  <text x="${Math.floor(width * 0.08)}" y="${Math.floor(height * 0.92)}" font-size="${Math.floor(width * 0.06)}" font-family="Menlo, Monaco, Consolas, monospace" fill="rgba(255,255,255,0.85)" filter="url(#shadow)">
    ${label}
  </text>
</svg>`)
}

async function ensurePng({ outPath, width, height, label, index }) {
  if (fs.existsSync(outPath)) return
  const svg = overlaySvg({ label, index, width, height })
  await sharp({
    create: { width, height, channels: 3, background: { r: 18, g: 18, b: 18 } },
  })
    .composite([{ input: svg }])
    .png({ compressionLevel: 9 })
    .toFile(outPath)
}

async function main() {
  const manifestPath = path.resolve(__dirname, '../seed-images-generated/manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ manifest.json が見つかりません:', manifestPath)
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  manifest.files ||= {}

  const castProfilesDir = path.resolve(__dirname, '../seed-images-generated/cast-profiles')
  const castFacesDir = path.resolve(__dirname, '../seed-images-generated/cast-faces')
  fs.mkdirSync(castProfilesDir, { recursive: true })
  fs.mkdirSync(castFacesDir, { recursive: true })

  const castCount = Number(process.env.SEED_CAST_COUNT || 10)

  // 9:16 portraits for cast_staff_profiles.profile_images_json
  const castProfiles = []
  for (let i = 1; i <= castCount; i++) {
    const castId = `seed_cast_${pad3(i)}`
    for (let idx = 1; idx <= 2; idx++) {
      const relLocalFile = `seed-images-generated/cast-profiles/${castId}-${idx}.png`
      const relR2Path = `seed-images/cast-profiles/${castId}-${idx}.png`
      const outPath = path.resolve(__dirname, '..', relLocalFile)
      await ensurePng({ outPath, width: 1024, height: 1792, label: `${castId}-${idx}`, index: i * 10 + idx })
      castProfiles.push({ id: castId, index: idx, localFile: relLocalFile, r2Path: relR2Path })
    }
  }

  // 1:1 faces for casts.thumbnail_url and cast_staff_profiles.face_image_url
  const castFaces = []
  for (let i = 1; i <= castCount; i++) {
    const castId = `seed_cast_${pad3(i)}`
    const relLocalFile = `seed-images-generated/cast-faces/${castId}.png`
    const relR2Path = `seed-images/cast-faces/${castId}.png`
    const outPath = path.resolve(__dirname, '..', relLocalFile)
    await ensurePng({ outPath, width: 1024, height: 1024, label: `${castId}`, index: i })
    castFaces.push({ id: castId, localFile: relLocalFile, r2Path: relR2Path })
  }

  manifest.files.castProfiles = castProfiles
  manifest.files.castFaces = castFaces

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`✅ キャスト9:16プロフィール画像を生成: ${castProfiles.length} 件 (2枚 x ${castCount})`)
  console.log(`✅ キャスト顔(1:1)画像を生成: ${castFaces.length} 件`) 
  console.log('✅ manifest.json を更新しました: files.castProfiles / files.castFaces')
}

main().catch((err) => {
  console.error('❌ エラー:', err?.stack || err?.message || String(err))
  process.exit(1)
})
