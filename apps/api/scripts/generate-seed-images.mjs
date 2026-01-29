#!/usr/bin/env node

// Generates local placeholder images for the seed dataset.
// Default: 16:9 SVG.
// Optional: `--format png` renders the SVG into PNG locally (no external API calls).

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

function usage() {
  console.log(`Usage:
  node ./scripts/generate-seed-images.mjs --out ../admin/public/seed-images [--format svg|png]

Notes:
- Default output is simple 16:9 SVGs.
- With --format png, renders the same placeholders as PNG locally.
`)
}

function getArg(flag, defaultValue = '') {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return defaultValue
  const v = String(process.argv[idx + 1] ?? '').trim()
  return v || defaultValue
}

function pad3(n) {
  return String(n).padStart(3, '0')
}

function id(prefix, n) {
  return `seed_${prefix}_${pad3(n)}`
}

function svg16x9({ title, subtitle, bg = '#111827', fg = '#F9FAFB', accent = '#22C55E' }) {
  // 1280x720 (16:9)
  const safeTitle = String(title).replace(/[<>]/g, '')
  const safeSubtitle = String(subtitle).replace(/[<>]/g, '')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${bg}" />
      <stop offset="1" stop-color="#0B1220" />
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)" />
  <rect x="64" y="64" width="1152" height="592" rx="28" fill="none" stroke="${accent}" stroke-width="6" opacity="0.9" />
  <text x="96" y="140" fill="${fg}" font-family="system-ui, -apple-system, Segoe UI, Roboto" font-size="40" font-weight="700">${safeTitle}</text>
  <text x="96" y="192" fill="${fg}" font-family="system-ui, -apple-system, Segoe UI, Roboto" font-size="22" opacity="0.85">${safeSubtitle}</text>
  <text x="96" y="656" fill="${fg}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco" font-size="18" opacity="0.6">oshidora seed image</text>
</svg>
`
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function writeSvg(filePath, svg) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, svg, 'utf8')
}

async function writePng(filePath, svg) {
  await ensureDir(path.dirname(filePath))
  await sharp(Buffer.from(svg, 'utf8')).png().toFile(filePath)
}

async function main() {
  if (process.argv.includes('--help')) {
    usage()
    return
  }

  const out = getArg('--out')
  const format = getArg('--format', 'svg').toLowerCase()

  if (!out) {
    usage()
    process.exitCode = 1
    return
  }

  if (format !== 'svg' && format !== 'png') {
    console.error(`Invalid --format: ${format} (expected svg|png)`)
    process.exitCode = 1
    return
  }

  // Align filenames with apps/api/scripts/seed-dataset.mjs

  const outRoot = path.resolve(process.cwd(), out)

  const writeImage = async (filePathNoExt, svg) => {
    if (format === 'png') {
      await writePng(`${filePathNoExt}.png`, svg)
    } else {
      await writeSvg(`${filePathNoExt}.svg`, svg)
    }
  }

  // Cast thumbnails
  for (let i = 1; i <= 24; i++) {
    const castId = id('cast', i)
    await writeImage(path.join(outRoot, 'casts', castId), svg16x9({ title: 'CAST', subtitle: castId, accent: '#60A5FA' }))
  }

  // Cast profile images (2 each)
  for (let i = 1; i <= 10; i++) {
    const castId = id('cast', i)
    await writeImage(
      path.join(outRoot, 'cast-profiles', `${castId}-1`),
      svg16x9({ title: 'PROFILE', subtitle: `${castId} / 1`, accent: '#F59E0B' })
    )
    await writeImage(
      path.join(outRoot, 'cast-profiles', `${castId}-2`),
      svg16x9({ title: 'PROFILE', subtitle: `${castId} / 2`, accent: '#F59E0B' })
    )
    await writeImage(path.join(outRoot, 'cast-faces', castId), svg16x9({ title: 'FACE', subtitle: castId, accent: '#A78BFA' }))
  }

  // Works
  for (let i = 1; i <= 20; i++) {
    const workId = id('work', i)
    await writeImage(path.join(outRoot, 'works', workId), svg16x9({ title: 'WORK', subtitle: workId, accent: '#22C55E' }))
  }

  // Videos (60)
  for (let i = 1; i <= 60; i++) {
    const videoId = id('video', i)
    await writeImage(path.join(outRoot, 'videos', videoId), svg16x9({ title: 'VIDEO', subtitle: videoId, accent: '#EF4444' }))
  }

  console.log(`Seed images generated under: ${outRoot} (format=${format})`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
