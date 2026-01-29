#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.resolve(__dirname, '../seed-images-generated/manifest.json')
const seedImagesDir = path.resolve(__dirname, '../seed-images-generated')

function getUploadKey(category, file) {
  const id = file?.id
  if (!id) return null
  if (category === 'castProfiles') {
    const idx = Number(file?.index)
    if (Number.isFinite(idx) && idx > 0) return `${id}-${idx}`
    return file?.localFile ? String(file.localFile) : String(id)
  }
  if (category === 'castProfileBg') {
    return `${id}-bg`
  }
  return String(id)
}

// Token生成：署名付き JWT风格のトークン
function generateToken() {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }
  
  const payload = {
    iss: 'oshidora-seed',
    sub: 'seed-uploader',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24時間有効
  }

  const secret = process.env.UPLOADER_SECRET_KEY || 'seed-uploader-secret-key'
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url')
  
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

// アップロード実行
async function uploadImages() {
  try {
    // manifest.json を読込
    if (!fs.existsSync(manifestPath)) {
      console.error('manifest.json が見つかりません:', manifestPath)
      process.exit(1)
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    const uploaderBase = process.env.UPLOADER_BASE_URL || 'https://assets-uploader.oshidora.com'
    const token = generateToken()

    console.log('🚀 Seed画像をアップロード中...')
    console.log(`📍 Uploader Base: ${uploaderBase}`)
    console.log(`🔑 Token生成完了 (有効期限: 24時間)`)
    console.log(``)

    if (!process.env.UPLOADER_SECRET_KEY) {
      console.error('❌ UPLOADER_SECRET_KEY が未設定です（assets-uploader のJWT署名用）')
      console.error('   例: UPLOADER_SECRET_KEY=... UPLOADER_BASE_URL=https://assets-uploader.oshidora.com node scripts/upload-seed-images-uploader.mjs')
      process.exit(1)
    }

    const uploadedUrls = {}
    const filesByCategory = manifest.files || {}
    const categories = Object.keys(filesByCategory)

    for (const category of categories) {
      const files = filesByCategory[category]
      if (!Array.isArray(files) || files.length === 0) continue

      console.log(`📁 カテゴリー: ${category} (${files.length})`)

      for (const file of files) {
        const relLocalFile = file.localFile
        const uploadKey = getUploadKey(category, file)
        if (!relLocalFile || !uploadKey) continue

        const filePath = path.resolve(__dirname, '..', relLocalFile)
        if (!fs.existsSync(filePath)) {
          console.warn(`  ⚠️  ファイルが見つかりません: ${relLocalFile}`)
          continue
        }

        const ext = path.extname(filePath).toLowerCase()
        const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream'

        try {
          const fileBuffer = fs.readFileSync(filePath)

          const response = await fetch(`${uploaderBase}/cms/images`, {
            method: 'PUT',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': contentType,
            },
            body: fileBuffer,
          })

          if (!response.ok) {
            const error = await response.text()
            console.error(`  ❌ アップロード失敗 [${response.status}]: ${relLocalFile}`)
            console.error(`    ${error}`)
            continue
          }

          const result = await response.json()
          const uploadedUrl = result.data?.url

          if (uploadedUrl) {
            uploadedUrls[uploadKey] = uploadedUrl
            console.log(`  ✅ ${relLocalFile} → ${uploadedUrl}`)
          } else {
            console.error(`  ❌ URLが返されませんでした: ${relLocalFile}`)
          }
        } catch (err) {
          console.error(`  ❌ アップロード処理エラー: ${relLocalFile}`)
          console.error(`    ${err.message}`)
        }
      }
    }

    // アップロード結果を manifest.json に追記
    const resultManifest = {
      generatedAt: manifest.generatedAt || new Date().toISOString(),
      outDir: manifest.outDir || './seed-images-generated',
      files: manifest.files || {},
      uploadedUrls,
      timestamp: new Date().toISOString(),
      uploaderBase,
    }

    const resultPath = path.resolve(seedImagesDir, 'upload-result.json')
    fs.writeFileSync(resultPath, JSON.stringify(resultManifest, null, 2))
    
    console.log(``)
    console.log(`✨ アップロード完了！`)
    console.log(`📄 結果は以下に保存されました:`)
    console.log(`   ${resultPath}`)
    console.log(``)
    console.log(`次ステップ: seed-dataset.mjs に uploader URLs を統合します`)

    return uploadedUrls
  } catch (err) {
    console.error('エラー:', err)
    process.exit(1)
  }
}

// 実行
uploadImages()
