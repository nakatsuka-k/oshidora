#!/usr/bin/env node

/**
 * Generate seed images via OpenAI DALL-E and save locally.
 * Outputs file manifest for manual R2 upload.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node ./scripts/generate-seed-images-openai.mjs \
 *     --out ./seed-images-generated \
 *     [--limit 10]
 */

import https from 'node:https'
import fs from 'node:fs/promises'
import path from 'node:path'

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

async function httpRequest(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: { 'User-Agent': 'oshidora-seed-gen/1.0', ...headers },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data })
      })
    })

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function callOpenAI(prompt, size = '1024x1024') {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const body = JSON.stringify({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size,
    quality: 'standard',
    response_format: 'url',
  })

  const res = await httpRequest('POST', 'https://api.openai.com/v1/images/generations', body, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  })

  if (res.status !== 200) {
    throw new Error(`OpenAI API error: ${res.status} ${res.body}`)
  }

  const data = JSON.parse(res.body)
  if (!data.data || !data.data[0] || !data.data[0].url) {
    throw new Error(`Unexpected OpenAI response: ${res.body}`)
  }

  return data.data[0].url
}

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
    }
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.end()
  })
}

async function saveImage(localPath, fileBuffer) {
  await fs.mkdir(path.dirname(localPath), { recursive: true })
  await fs.writeFile(localPath, fileBuffer)
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY is not set')
    process.exitCode = 1
    return
  }

  const outDir = getArg('--out')
  const limitStr = getArg('--limit', '999')
  const limit = Math.min(Math.max(parseInt(limitStr, 10) || 999, 1), 999)

  if (!outDir) {
    console.error('Usage: OPENAI_API_KEY=... node ./generate-seed-images-openai.mjs \\')
    console.error('  --out ./seed-images-generated \\')
    console.error('  [--limit 10]')
    process.exitCode = 1
    return
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    outDir,
    r2UploadInstructions: 'Use: wrangler r2 object put assets ./seed-images-generated/PATH --file ./LOCALFILE',
    files: {
      works: [],
      castProfiles: [],
      castFaces: [],
    },
  }

  console.error(`[OpenAI Image Generation → Local Save]`)
  console.error(`Output directory: ${outDir}`)
  console.error(`Limit: ${limit}`)
  console.error()

  // Works (thumbnails) - 1024x1024
  console.error('📚 Generating work thumbnails (1024x1024)...')
  for (let i = 1; i <= Math.min(20, limit); i++) {
    const workId = id('work', i)
    console.error(`  [${i}/20] ${workId}...`)
    try {
      const prompt = [
        'Japanese drama style key art, cinematic and photorealistic, premium production value,',
        'authentic Japanese actors, emotional tone, realistic lighting,',
        'square 1:1 composition, poster-like framing,',
        'leave tasteful negative space for a title area,',
        'do NOT render any text, letters, numbers, subtitles, captions, logos, or watermarks,',
        `Work ID: ${workId}.`,
      ].join(' ')
      const imageUrl = await callOpenAI(prompt, '1024x1024')
      const imageBuffer = await downloadImage(imageUrl)
      const localPath = path.join(outDir, 'works', `${workId}.png`)
      await saveImage(localPath, imageBuffer)
      const r2Path = `seed-images/works/${workId}.png`
      manifest.files.works.push({ id: workId, localFile: localPath, r2Path })
      console.error(`    ✓ ${localPath}`)
    } catch (err) {
      console.error(`    ✗ Error: ${err.message}`)
    }
  }

  // Cast profiles (vertical portrait) - 1024x1792 (OpenAI supported)
  console.error('👤 Generating cast profile images (vertical portrait, 1024x1792)...')
  for (let i = 1; i <= Math.min(10, limit); i++) {
    const castId = id('cast', i)
    for (let j = 1; j <= 2; j++) {
      const fileName = `${castId}-${j}`
      console.error(`  [${i * j}/20] ${fileName}...`)
      try {
        const prompt = [
          'Japanese drama style portrait of an authentic Japanese actor,',
          'vertical 9:16 composition, cinema-quality still, premium photography,',
          'natural realistic facial features, shallow depth of field,',
          'no text, no logos, no watermarks,',
          `Portrait ID: ${fileName}.`,
        ].join(' ')
        const imageUrl = await callOpenAI(prompt, '1024x1792')
        const imageBuffer = await downloadImage(imageUrl)
        const localPath = path.join(outDir, 'cast-profiles', `${fileName}.png`)
        await saveImage(localPath, imageBuffer)
        const r2Path = `seed-images/cast-profiles/${fileName}.png`
        manifest.files.castProfiles.push({ id: castId, index: j, localFile: localPath, r2Path })
        console.error(`    ✓ ${localPath}`)
      } catch (err) {
        console.error(`    ✗ Error: ${err.message}`)
      }
    }
  }

  // Cast faces (1024x1024)
  console.error('😊 Generating cast face images (1024x1024)...')
  for (let i = 1; i <= Math.min(10, limit); i++) {
    const castId = id('cast', i)
    console.error(`  [${i}/10] ${castId}...`)
    try {
      const prompt = [
        'Close-up professional headshot of an authentic Japanese actor,',
        'square 1:1 composition, premium talent-agency style photography,',
        'natural realistic features, sharp focus on eyes,',
        'no text, no logos, no watermarks,',
        `Cast ID: ${castId}.`,
      ].join(' ')
      const imageUrl = await callOpenAI(prompt, '1024x1024')
      const imageBuffer = await downloadImage(imageUrl)
      const localPath = path.join(outDir, 'cast-faces', `${castId}.png`)
      await saveImage(localPath, imageBuffer)
      const r2Path = `seed-images/cast-faces/${castId}.png`
      manifest.files.castFaces.push({ id: castId, localFile: localPath, r2Path })
      console.error(`    ✓ ${localPath}`)
    } catch (err) {
      console.error(`    ✗ Error: ${err.message}`)
    }
  }

  // Output manifest
  const manifestPath = path.join(outDir, 'manifest.json')
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  console.error()
  console.error(`Manifest saved: ${manifestPath}`)
  console.error()
  console.error('📤 Next steps:')
  console.error(`1. cd ${outDir}`)
  console.error(`2. Upload each file to R2 using:`)
  console.error(`   wrangler r2 object put assets <R2_PATH> --file <LOCAL_FILE>`)
  console.error(`   Example: wrangler r2 object put assets seed-images/works/seed_work_001.png --file works/seed_work_001.png`)
}

main().catch((err) => {
  console.error('Fatal error:', err.message)
  process.exitCode = 1
})
