#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function mulberry32(seed) {
  let t = seed >>> 0
  return function rand() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function pad3(n) {
  return String(n).padStart(3, '0')
}

function pick(arr, r) {
  return arr[Math.floor(r() * arr.length)]
}

function makeOverlaySvg({ videoId, index }) {
  // Cinematic / drama-like synthetic thumbnail (no copyrighted assets).
  // Visual: dark grade + vignette + bokeh + grain + bold title area.
  const r = mulberry32(0xdecafbad ^ (index * 7919))
  const hueA = (220 + index * 19) % 360
  const hueB = (20 + index * 29) % 360

  const titles = [
    'MIDNIGHT PROMISE',
    'SILENT ROOM',
    'BROKEN VOW',
    'LAST MESSAGE',
    'SHADOW LINE',
    'FADING CITY',
    'DEAR STRANGER',
    'AFTER THE RAIN',
    'THE SECRET TAPE',
    'NO TURNING BACK',
  ]
  const taglines = [
    'A story of love and lies.',
    'Truth has a price.',
    'Tonight, everything changes.',
    'One choice. Two futures.',
    'Keep it hidden.',
    'When the lights go out.',
  ]

  const title = pick(titles, r)
  const tagline = pick(taglines, r)
  const episode = `EP.${String(((index - 1) % 12) + 1).padStart(2, '0')}`

  const bokeh = Array.from({ length: 16 })
    .map(() => {
      const cx = Math.floor(r() * 1792)
      const cy = Math.floor(r() * 1024)
      const rad = Math.floor(60 + r() * 220)
      const a = (0.06 + r() * 0.12).toFixed(3)
      const hue = Math.floor(r() * 360)
      return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="hsla(${hue}, 85%, 70%, ${a})"/>`
    })
    .join('')

  const accentX = Math.floor(160 + r() * 220)
  const accentY = Math.floor(160 + r() * 120)
  const accentW = Math.floor(520 + r() * 300)
  const accentH = Math.floor(18 + r() * 10)

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="1792" height="1024" viewBox="0 0 1792 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hueA}, 60%, 24%)"/>
      <stop offset="55%" stop-color="#0b0c10"/>
      <stop offset="100%" stop-color="hsl(${hueB}, 65%, 18%)"/>
    </linearGradient>

    <radialGradient id="v" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="70%" stop-color="rgba(0,0,0,0.15)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.70)"/>
    </radialGradient>

    <linearGradient id="titleFade" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="rgba(0,0,0,0.78)"/>
      <stop offset="45%" stop-color="rgba(0,0,0,0.52)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.0)"/>
    </linearGradient>

    <filter id="bokehBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>

    <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.40"/>
    </filter>

    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${index}" result="noise"/>
      <feColorMatrix type="matrix" values="
        1 0 0 0 0
        0 1 0 0 0
        0 0 1 0 0
        0 0 0 0.18 0" in="noise" result="grain"/>
      <feBlend mode="overlay" in="SourceGraphic" in2="grain"/>
    </filter>
  </defs>

  <rect width="1792" height="1024" fill="url(#bg)"/>

  <!-- subtle light leak -->
  <ellipse cx="${Math.floor(1792 * (0.15 + r() * 0.15))}" cy="${Math.floor(1024 * (0.25 + r() * 0.25))}" rx="520" ry="420" fill="hsla(${(hueB + 30) % 360}, 80%, 65%, 0.12)" filter="url(#bokehBlur)"/>

  <!-- bokeh lights -->
  <g filter="url(#bokehBlur)">
    ${bokeh}
  </g>

  <!-- abstract silhouettes -->
  <g opacity="0.35" filter="url(#softShadow)">
    <path d="M 1040 880 C 980 700 1040 540 1180 480 C 1320 420 1500 520 1560 700 C 1620 880 1500 980 1350 980 C 1200 980 1100 940 1040 880 Z" fill="rgba(0,0,0,0.75)"/>
    <path d="M 680 900 C 620 740 650 560 770 500 C 890 440 1040 540 1100 710 C 1160 880 1050 980 920 980 C 790 980 740 960 680 900 Z" fill="rgba(0,0,0,0.68)"/>
  </g>

  <rect width="1792" height="1024" fill="url(#v)"/>

  <!-- title band -->
  <rect x="0" y="560" width="1792" height="520" fill="url(#titleFade)"/>

  <!-- accent line -->
  <rect x="${accentX}" y="${accentY}" width="${accentW}" height="${accentH}" rx="${Math.floor(accentH / 2)}" fill="hsla(${(hueB + 20) % 360}, 85%, 60%, 0.85)"/>

  <!-- labels -->
  <g filter="url(#softShadow)">
    <text x="96" y="140" font-size="44" font-family="Arial Black, Arial, Helvetica, sans-serif" fill="rgba(255,255,255,0.88)" letter-spacing="2">
      OSHIDORA
    </text>

    <text x="96" y="208" font-size="28" font-family="Menlo, Monaco, Consolas, monospace" fill="rgba(255,255,255,0.72)">
      ${episode}  •  DRAMA SERIES
    </text>
  </g>

  <!-- main title -->
  <g filter="url(#softShadow)">
    <text x="96" y="820" font-size="96" font-family="Arial Black, Arial, Helvetica, sans-serif" fill="rgba(255,255,255,0.93)" letter-spacing="1">
      ${title}
    </text>
    <text x="96" y="890" font-size="34" font-family="Arial, Helvetica, sans-serif" fill="rgba(255,255,255,0.78)">
      ${tagline}
    </text>
    <text x="96" y="980" font-size="28" font-family="Menlo, Monaco, Consolas, monospace" fill="rgba(255,255,255,0.55)">
      ${videoId}
    </text>
  </g>

  <!-- grain pass -->
  <g filter="url(#grain)">
    <rect width="1792" height="1024" fill="rgba(255,255,255,0.01)"/>
  </g>
</svg>`)
}

async function ensureVideoThumbnailPng({ outPath, videoId, index, force }) {
  if (!force && fs.existsSync(outPath)) return

  const overlay = makeOverlaySvg({ videoId, index })

  await sharp({
    create: {
      width: 1792,
      height: 1024,
      channels: 3,
      background: { r: 20, g: 20, b: 20 },
    },
  })
    .composite([{ input: overlay }])
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

  const videosDir = path.resolve(__dirname, '../seed-images-generated/videos')
  fs.mkdirSync(videosDir, { recursive: true })

  const count = Number(process.env.SEED_VIDEO_THUMB_COUNT || 60)
  const force = String(process.env.FORCE || '').trim() === '1'

  const entries = []
  for (let i = 1; i <= count; i++) {
    const videoId = `seed_video_${pad3(i)}`
    const relLocalFile = `seed-images-generated/videos/${videoId}.png`
    const relR2Path = `seed-images/videos/${videoId}.png`

    const outPath = path.resolve(__dirname, '..', relLocalFile)
    await ensureVideoThumbnailPng({ outPath, videoId, index: i, force })

    entries.push({ id: videoId, localFile: relLocalFile, r2Path: relR2Path })
  }

  manifest.files.videos = entries

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`✅ 動画サムネイルを生成しました: ${count} 件 (force=${force ? '1' : '0'})`)
  console.log(`✅ manifest.json を更新しました: files.videos = ${count} 件`)
}

main().catch((err) => {
  console.error('❌ エラー:', err?.stack || err?.message || String(err))
  process.exit(1)
})
