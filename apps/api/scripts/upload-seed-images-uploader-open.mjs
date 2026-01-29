#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.resolve(__dirname, '../seed-images-generated/manifest.json')
const uploadResultPath = path.resolve(__dirname, '../seed-images-generated/upload-result.json')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getUploadKey(category, file) {
  const id = file?.id
  if (!id) return null
  if (category === 'castProfiles') {
    const idx = Number(file?.index)
    if (Number.isFinite(idx) && idx > 0) return `${id}-${idx}`
    // fallback: unique by localFile
    return file?.localFile ? String(file.localFile) : String(id)
  }
  if (category === 'castProfileBg') {
    return `${id}-bg`
  }
  return String(id)
}

function isDesiredUrl(url) {
  return typeof url === 'string' && url.startsWith('https://assets.oshidra.com/')
}

function loadExistingUploadedUrls() {
  if (!fs.existsSync(uploadResultPath)) return {}
  try {
    const current = JSON.parse(fs.readFileSync(uploadResultPath, 'utf-8'))
    return current?.uploadedUrls && typeof current.uploadedUrls === 'object' ? current.uploadedUrls : {}
  } catch {
    return {}
  }
}

function writeUploadResult({ manifest, uploaderBase, uploadedUrls, errors }) {
  const resultManifest = {
    generatedAt: manifest.generatedAt || new Date().toISOString(),
    outDir: manifest.outDir || './seed-images-generated',
    files: manifest.files || {},
    uploadedUrls,
    timestamp: new Date().toISOString(),
    uploaderBase,
    errors,
  }

  fs.writeFileSync(uploadResultPath, JSON.stringify(resultManifest, null, 2))
}

async function uploadWithRetry({ uploaderBase, relLocalFile, filePath, contentType, retries, timeoutMs }) {
  const url = `${uploaderBase}/cms/images`
  const body = fs.readFileSync(filePath)

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'content-type': contentType,
        },
        body,
        signal: controller.signal,
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        const retriable = res.status === 429 || res.status >= 500
        if (!retriable || attempt === retries) {
          return { ok: false, error: `HTTP ${res.status}: ${txt || '(no body)'}` }
        }
        const backoff = Math.min(15_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250)
        await sleep(backoff)
        continue
      }

      const text = await res.text()
      let json
      try {
        json = JSON.parse(text)
      } catch {
        return { ok: false, error: `Invalid JSON response: ${text.slice(0, 200)}` }
      }

      const uploadedUrl = json?.data?.url
      if (!uploadedUrl) {
        return { ok: false, error: `Missing url in response: ${text.slice(0, 200)}` }
      }

      return { ok: true, url: uploadedUrl }
    } catch (err) {
      const retriable = true
      if (!retriable || attempt === retries) {
        return { ok: false, error: err?.message || String(err) }
      }
      const backoff = Math.min(15_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250)
      await sleep(backoff)
    } finally {
      clearTimeout(t)
    }
  }

  return { ok: false, error: 'Unexpected retry loop termination' }
}

async function main() {
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ manifest.json が見つかりません:', manifestPath)
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const uploaderBase = (process.env.UPLOADER_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
  const force = String(process.env.FORCE || '').trim() === '1'
  const onlyCategories = String(process.env.ONLY_CATEGORIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const concurrency = Math.max(1, Number(process.env.UPLOAD_CONCURRENCY || 3))
  const retries = Math.max(0, Number(process.env.RETRY_COUNT || 3))
  const timeoutMs = Math.max(5_000, Number(process.env.TIMEOUT_MS || 30_000))

  const uploadedUrls = loadExistingUploadedUrls()
  const errors = []
  const filesByCategory = manifest.files || {}

  console.log('🚀 Seed画像を（無認証）アップロード中...')
  console.log(`📍 Uploader Base: ${uploaderBase}`)
  console.log(
    `⚙️  concurrency=${concurrency} retries=${retries} timeoutMs=${timeoutMs} force=${force ? '1' : '0'} onlyCategories=${onlyCategories.length ? onlyCategories.join(',') : '(all)'}`
  )

  let interrupted = false
  const onSigint = () => {
    interrupted = true
    console.warn('\n🛑 SIGINT: 途中結果を保存して終了します...')
    try {
      writeUploadResult({ manifest, uploaderBase, uploadedUrls, errors })
    } catch {
      // ignore
    }
    process.exit(130)
  }
  process.once('SIGINT', onSigint)

  const tasks = []

  const sortedCategories = Object.keys(filesByCategory)
    .sort()
    .filter((c) => (onlyCategories.length ? onlyCategories.includes(c) : true))
  for (const category of sortedCategories) {
    const files = filesByCategory[category]
    if (!Array.isArray(files) || files.length === 0) continue

    console.log(`📁 カテゴリー: ${category} (${files.length})`)

    for (const file of files) {
      const relLocalFile = file.localFile
      const uploadKey = getUploadKey(category, file)
      if (!relLocalFile || !uploadKey) continue

      const existing = uploadedUrls[uploadKey]
      if (!force && isDesiredUrl(existing)) {
        continue
      }

      tasks.push({ category, relLocalFile, uploadKey })
    }
  }

  console.log(`📦 アップロード対象: ${tasks.length} 件 (スキップ済み: ${Object.keys(uploadedUrls).length} 件)`)

  let nextIndex = 0
  async function worker() {
    while (!interrupted) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= tasks.length) return

      const task = tasks[currentIndex]
      const { category, relLocalFile, uploadKey } = task

      const filePath = path.resolve(__dirname, '..', relLocalFile)
      if (!fs.existsSync(filePath)) {
        const msg = `missing file: ${relLocalFile}`
        console.warn(`  ⚠️  ${msg}`)
        errors.push({ uploadKey, category, relLocalFile, error: msg })
        continue
      }

      const ext = path.extname(filePath).toLowerCase()
      const contentType =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream'

      const result = await uploadWithRetry({
        uploaderBase,
        relLocalFile,
        filePath,
        contentType,
        retries,
        timeoutMs,
      })

      if (!result.ok) {
        console.error(`  ❌ アップロード失敗: ${relLocalFile}`)
        console.error(`    ${result.error}`)
        errors.push({ uploadKey, category, relLocalFile, error: result.error })
        continue
      }

      uploadedUrls[uploadKey] = result.url
      console.log(`  ✅ ${relLocalFile} → ${result.url}`)
    }
  }

  await Promise.all(Array.from({ length: concurrency }).map(() => worker()))

  writeUploadResult({ manifest, uploaderBase, uploadedUrls, errors })

  const uploadedCount = Object.values(uploadedUrls).filter((v) => isDesiredUrl(v)).length
  console.log(`\n✨ アップロード完了！ (assets.oshidra.com: ${uploadedCount} 件 / total keys: ${Object.keys(uploadedUrls).length} 件)`) 
  console.log(`📄 結果: ${uploadResultPath}`)

  if (errors.length > 0) {
    console.error(`\n⚠️  失敗: ${errors.length} 件 (upload-result.json は保存済み)`)
    process.exitCode = 1
  }
  return
}

main().catch((err) => {
  console.error('❌ エラー:', err?.stack || err?.message || String(err))
  process.exit(1)
})
