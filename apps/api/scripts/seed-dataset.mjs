#!/usr/bin/env node

// Seed dataset generator for local D1 (oshidora-db).
// - Outputs SQL to stdout.
// - Uses deterministic `seed_...` IDs.
// - Safe-by-default: designed for `wrangler d1 execute --local`.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function usage() {
  console.log(`Usage:
  node ./scripts/seed-dataset.mjs [--seed oshidora] [--assetBaseUrl http://localhost:8084/seed-images] [--assetExt svg|png]

Outputs SQL to stdout.
Example:
  node ./scripts/seed-dataset.mjs --assetBaseUrl http://localhost:8084/seed-images > /tmp/oshidora-seed.sql
  npx -y wrangler d1 execute oshidora-db --local --file /tmp/oshidora-seed.sql
`)
}

function getArg(flag, defaultValue = '') {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return defaultValue
  const v = String(process.argv[idx + 1] ?? '').trim()
  return v || defaultValue
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''")
}

function q(value) {
  return `'${escapeSqlString(value)}'`
}

function mulberry32(seed) {
  let t = seed >>> 0
  return function rand() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeedToUint32(seed) {
  const h = crypto.createHash('sha256').update(seed).digest()
  return h.readUInt32LE(0)
}

function pad3(n) {
  return String(n).padStart(3, '0')
}

function id(prefix, n) {
  return `seed_${prefix}_${pad3(n)}`
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)]
}

function pickN(rand, arr, n) {
  const copy = [...arr]
  const out = []
  while (out.length < n && copy.length) {
    const idx = Math.floor(rand() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

function isoDaysAgo(daysAgo) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString()
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

async function hashPasswordForStorageDeterministic(password, seedStr) {
  // Deterministic salt per (seedStr) to keep seed stable across runs.
  const salt = crypto.createHash('sha256').update(`salt:${seedStr}`).digest().subarray(0, 16)
  const hash = await pbkdf2HashPassword(password, salt)
  return { saltB64: base64Encode(salt), hashB64: base64Encode(hash) }
}

function insertOnConflictKey(table, cols, values, conflictKey, updateCols) {
  const colList = cols.join(', ')
  const valList = values.map((v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : q(v))).join(', ')

  if (!updateCols || updateCols.length === 0) {
    return [
      `INSERT INTO ${table} (${colList}) VALUES (${valList})`,
      `ON CONFLICT(${conflictKey}) DO NOTHING;`,
    ].join('\n')
  }

  const updates = updateCols.map((c) => `${c} = excluded.${c}`).join(', ')

  return [
    `INSERT INTO ${table} (${colList}) VALUES (${valList})`,
    `ON CONFLICT(${conflictKey}) DO UPDATE SET ${updates};`,
  ].join('\n')
}

function insertOnConflictId(table, cols, values, updateCols = cols) {
  return insertOnConflictKey(table, cols, values, 'id', updateCols)
}

// アップローダー URL マップから URL を取得、またはデフォルト URL を返す
function getAssetUrl(uploaderUrls, imageId, fallbackUrl) {
  if (uploaderUrls && uploaderUrls[imageId]) {
    return uploaderUrls[imageId]
  }
  return fallbackUrl
}

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

async function main() {
  // Allow piping (e.g. `| head`) without crashing on EPIPE.
  process.stdout.on('error', (err) => {
    if (err && err.code === 'EPIPE') process.exit(0)
  })

  if (process.argv.includes('--help')) {
    usage()
    return
  }

  const seed = getArg('--seed', 'oshidora')
  let assetBaseUrl = getArg('--assetBaseUrl', 'http://localhost:8084/seed-images').replace(/\/$/, '')
  const assetExt = getArg('--assetExt', 'svg').toLowerCase()
  
  // manifest.json を読み込む
  const manifestPath = path.resolve(__dirname, '../seed-images-generated/manifest.json')
  let manifest = { files: { works: [], castProfiles: [], castFaces: [] } }
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    } catch (err) {
      console.error(`⚠️  manifest.json を読み込めません: ${err.message}`)
    }
  }
  
  // アップロード結果ファイルがあれば、そこから URL マップを読み込む
  const uploadResultPath = path.resolve(__dirname, '../seed-images-generated/upload-result.json')
  let uploaderUrls = {}
  if (fs.existsSync(uploadResultPath)) {
    try {
      const result = JSON.parse(fs.readFileSync(uploadResultPath, 'utf-8'))
      uploaderUrls = result.uploadedUrls || {}
      if (Object.keys(uploaderUrls).length > 0) {
        console.error(`✅ アップロード結果を読み込みました (${Object.keys(uploaderUrls).length} ファイル)`)
      }
    } catch (err) {
      // ファイルがなければそのまま続ける
    }
  }
  
  if (assetExt !== 'svg' && assetExt !== 'png') {
    console.error(`Invalid --assetExt: ${assetExt} (expected svg|png)`)
    process.exitCode = 1
    return
  }
  const password = 'Passw0rd!'

  const rand = mulberry32(hashSeedToUint32(seed))

  const now = new Date().toISOString()
  // Align with API's daily rankings job: compute for previous UTC day.
  const yesterdayYmd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const rankingsAsOf = `${yesterdayYmd}T00:00:00.000Z`

  const sql = []
  sql.push('-- Generated by apps/api/scripts/seed-dataset.mjs')
  sql.push(`-- Generated at: ${now}`)
  // NOTE: `wrangler d1 execute --local` rejects BEGIN/COMMIT statements.
  // Keep this script transaction-free for local seeding.

  // Clean previous seed rows (best-effort).
  // Order matters due to foreign keys.
  const seedLike = q('seed_%')
  sql.push('-- Cleanup seed rows')
  sql.push(`DELETE FROM video_recommendations WHERE video_id LIKE ${seedLike} OR recommended_video_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM cms_featured_videos WHERE video_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM cms_rankings WHERE entity_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM video_play_events WHERE id LIKE ${seedLike} OR video_id LIKE ${seedLike} OR user_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM coin_spend_events WHERE id LIKE ${seedLike} OR video_id LIKE ${seedLike} OR user_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM comments WHERE id LIKE ${seedLike} OR content_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM favorite_casts WHERE user_id LIKE ${seedLike} OR cast_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM favorite_videos WHERE user_id LIKE ${seedLike} OR work_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM video_genres WHERE video_id LIKE ${seedLike} OR genre_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM video_casts WHERE video_id LIKE ${seedLike} OR cast_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM video_tags WHERE video_id LIKE ${seedLike} OR tag_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM video_categories WHERE video_id LIKE ${seedLike} OR category_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM work_casts WHERE work_id LIKE ${seedLike} OR cast_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM work_tags WHERE work_id LIKE ${seedLike} OR tag_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM work_categories WHERE work_id LIKE ${seedLike} OR category_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM videos WHERE id LIKE ${seedLike} OR work_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM works WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM cast_staff_profiles WHERE cast_id LIKE ${seedLike} OR user_id LIKE ${seedLike};`)
  sql.push(`DELETE FROM casts WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM tags WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM categories WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM genres WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM cast_categories WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM inquiries WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM notices WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM cast_profile_requests WHERE id LIKE ${seedLike};`)
  sql.push(`DELETE FROM users WHERE id LIKE ${seedLike} OR email LIKE ${q('seed-user-%@oshidra.local')};`)
  sql.push(`DELETE FROM cms_admins WHERE id LIKE ${seedLike} OR email = ${q('seed-admin@oshidra.local')};`)

  // app_settings: keep keys stable (overwrite)
  sql.push('-- Settings')
  sql.push(
    [
      'INSERT INTO app_settings (key, value, updated_at) VALUES',
      `  (${q('maintenance_mode')}, ${q('0')}, ${q(now)}),`,
      `  (${q('maintenance_message')}, ${q('')}, ${q(now)})`,
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;',
    ].join('\n')
  )

  // CMS admin
  const adminId = id('admin', 1)
  const admin = await hashPasswordForStorageDeterministic(password, `${seed}:${adminId}`)
  sql.push('-- cms_admins')
  sql.push(
    insertOnConflictKey(
      'cms_admins',
      ['id', 'email', 'name', 'role', 'password_hash', 'password_salt', 'disabled', 'created_at', 'updated_at'],
      [adminId, 'seed-admin@oshidra.local', 'Seed Admin', 'Admin', admin.hashB64, admin.saltB64, 0, now, now],
      'email',
      ['id', 'email', 'name', 'role', 'password_hash', 'password_salt', 'disabled', 'updated_at']
    )
  )

  // Users
  sql.push('-- users')
  const users = []
  for (let i = 1; i <= 30; i++) {
    const userId = id('user', i)
    const email = `seed-user-${pad3(i)}@oshidra.local`
    const p = await hashPasswordForStorageDeterministic(password, `${seed}:${userId}`)
    users.push({ id: userId, email })
    sql.push(
      insertOnConflictKey(
        'users',
        ['id', 'email', 'email_verified', 'phone', 'phone_verified', 'sms_auth_skip', 'password_hash', 'password_salt', 'created_at', 'updated_at'],
        [userId, email, 1, null, 0, 1, p.hashB64, p.saltB64, now, now],
        'email',
        ['id', 'email', 'email_verified', 'password_hash', 'password_salt', 'updated_at']
      )
    )
  }

  // Categories
  const categoryNames = [
    'インタビュー',
    '舞台裏',
    'ダンス',
    'トーク',
    'バラエティ',
    'ASMR',
    '新人',
    '人気',
  ]
  const categories = categoryNames.map((name, idx) => ({ id: id('cat', idx + 1), name }))
  sql.push('-- categories')
  for (const c of categories) {
    sql.push(
      insertOnConflictKey(
        'categories',
        ['id', 'name', 'enabled', 'created_at', 'updated_at', 'parent_id'],
        [c.id, c.name, 1, now, now, null],
        'name',
        ['id', 'name', 'enabled', 'updated_at', 'parent_id']
      )
    )
  }
  // Add a simple hierarchy: 人気 -> 新人
  sql.push(`UPDATE categories SET parent_id = ${q(id('cat', 8))} WHERE id = ${q(id('cat', 7))};`)

  // Tags
  const tagNames = [
    '初出演',
    'オフショット',
    'コメディ',
    '神回',
    '毎週更新',
    '限定公開',
    'スペシャル',
    '未公開',
    '練習',
    '本番',
    'ショート',
    'ロング',
    '企画',
    '挑戦',
    '対談',
    'Q&A',
    '告知',
    'コラボ',
    'おすすめ',
    '初心者向け',
    '上級者向け',
    '癒し',
    'テンション高め',
    'しっとり',
    '爆笑',
    '感動',
    'ランキング入り',
    '話題',
    '検証',
    'ルーティン',
  ]
  const tags = tagNames.map((name, idx) => ({ id: id('tag', idx + 1), name }))
  sql.push('-- tags')
  for (const t of tags) {
    const cat = rand() < 0.7 ? pick(rand, categories).id : ''
    sql.push(
      insertOnConflictKey(
        'tags',
        ['id', 'name', 'category_id', 'created_at', 'updated_at'],
        [t.id, t.name, cat, now, now],
        'name',
        ['id', 'name', 'category_id', 'updated_at']
      )
    )
  }

  // Genres
  const genreNames = ['コメディ', 'ドラマ', 'ドキュメンタリー', '音楽', 'バラエティ', '学び', '癒し', '実験']
  const genres = genreNames.map((name, idx) => ({ id: id('genre', idx + 1), name }))
  sql.push('-- genres')
  for (const g of genres) {
    sql.push(
      insertOnConflictKey(
        'genres',
        ['id', 'name', 'enabled', 'created_at', 'updated_at'],
        [g.id, g.name, 1, now, now],
        'name',
        ['id', 'name', 'enabled', 'updated_at']
      )
    )
  }

  // Cast categories
  const castCategoryNames = ['キャスト', 'スタッフ', 'ゲスト']
  const castCategories = castCategoryNames.map((name, idx) => ({ id: id('castcat', idx + 1), name }))
  sql.push('-- cast_categories')
  for (const c of castCategories) {
    sql.push(
      insertOnConflictKey(
        'cast_categories',
        ['id', 'name', 'enabled', 'created_at', 'updated_at'],
        [c.id, c.name, 1, now, now],
        'name',
        ['id', 'name', 'enabled', 'updated_at']
      )
    )
  }

  // Casts
  const familyNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤']
  const givenNames = ['葵', '結衣', '咲', '凛', '遥', '美咲', '陽菜', '楓', '玲奈', '杏']
  
  // manifest.json から cast faces を読み込む
  const castFaceImageIds = (manifest.files?.castFaces || []).map(f => f.id)
  
  // SNS URL データを読み込む（manifest.files.sns）
  const snsUrlData = manifest.files?.sns || {}
  
  const casts = []
  sql.push('-- casts')
  for (let i = 1; i <= 24; i++) {
    const castId = id('cast', i)
    const name = `${pick(rand, familyNames)} ${pick(rand, givenNames)}`
    const categoryId = pick(rand, castCategories).id

    // Populate cast roles so CMS rankings (actors/directors/writers) work.
    // API ranking job filters by `casts.role LIKE '%出演%'|'%監督%'|'%脚本%'`.
    let role = ''
    if (i <= 10) role = i <= 3 ? '主演/出演' : '出演'
    else if (i <= 17) role = '監督'
    else role = '脚本'
    
    // キャスト画像 ID：最初の数個は manifest から、残りはデフォルト
    let castFaceImageId = null
    if (i <= castFaceImageIds.length) {
      castFaceImageId = castFaceImageIds[i - 1]
    }
    
    const defaultUrl = `${assetBaseUrl}/casts/${castId}.${assetExt}`
    const thumbnailUrl = castFaceImageId ? getAssetUrl(uploaderUrls, castFaceImageId, defaultUrl) : defaultUrl
    
    casts.push({ id: castId, name, role })
    sql.push(
      insertOnConflictId(
        'casts',
        ['id', 'name', 'role', 'thumbnail_url', 'created_at', 'updated_at', 'category_id'],
        [castId, name, '', thumbnailUrl, now, now, categoryId]
      )
    )
  }

  // Reflect role updates for existing rows (seed reruns) as well.
  for (const c of casts) {
    sql.push(`UPDATE casts SET role = ${q(c.role)} WHERE id = ${q(c.id)};`)
  }

  // Cast/staff profiles (10)
  // manifest.json から cast profiles を読み込む (uploadedUrls のキーは `${castId}-${index}`)
  const castProfilesByCastId = (manifest.files?.castProfiles || []).reduce((acc, f) => {
    const castId = f?.id
    if (!castId) return acc
    const key = getUploadKey('castProfiles', f)
    if (!key) return acc
    if (!acc[castId]) acc[castId] = []
    acc[castId].push({ index: Number(f?.index) || 0, key })
    return acc
  }, {})
  
  sql.push('-- cast_staff_profiles')
  for (let i = 1; i <= 10; i++) {
    const castId = id('cast', i)
    const userId = id('user', i)
    
    // プロフィール画像: manifest から、なければデフォルト
    const castProfiles = castProfilesByCastId[castId] || []
    const profileImages = []
    for (let j = 1; j <= 2; j++) {
      const entry = castProfiles.find((x) => x.index === j) || null
      const uploadKey = entry?.key || null
      const defaultUrl = `${assetBaseUrl}/cast-profiles/${castId}-${j}.${assetExt}`
      const url = uploadKey ? getAssetUrl(uploaderUrls, uploadKey, defaultUrl) : defaultUrl
      profileImages.push(url)
    }
    
    const sns = snsUrlData[castId] || [
      { type: 'x', url: `https://x.com/${castId}` },
      { type: 'instagram', url: `https://instagram.com/${castId}` },
    ]
    sql.push(
      insertOnConflictKey(
        'cast_staff_profiles',
        [
          'cast_id',
          'user_id',
          'appearances',
          'video_url',
          'created_at',
          'updated_at',
          'name_kana',
          'name_en',
          'profile_images_json',
          'sns_json',
          'face_image_url',
          'private_pdf_url',
          'hobbies',
          'special_skills',
          'bio',
          'career',
        ],
        [
          castId,
          userId,
          '舞台/配信/イベント',
          `https://example.com/video/${castId}`,
          now,
          now,
          'シード',
          'Seed',
          JSON.stringify(profileImages),
          JSON.stringify(sns),
          getAssetUrl(uploaderUrls, castFaceImageIds[castId]?.[0] || castId, `${assetBaseUrl}/cast-faces/${castId}.${assetExt}`),
          '',
          '映画鑑賞、散歩',
          'ダンス、MC',
          'ダミーの自己紹介文です。ローカル動作確認用。',
          '2023〜: 活動開始 / 2025〜: 主要出演',
        ],
        'cast_id',
        ['user_id', 'appearances', 'video_url', 'updated_at', 'profile_images_json', 'sns_json', 'face_image_url', 'hobbies', 'special_skills', 'bio', 'career']
      )
    )
  }

  // Works
  sql.push('-- works')
  // manifest.json から work images を読み込む
  const workImageIds = (manifest.files?.works || []).map(f => f.id)
  
  const works = []
  const workTitlePrefixes = ['推しの休日', '推しの挑戦', '推しの舞台裏', '推しの対談', '推しの検証']
  for (let i = 1; i <= 20; i++) {
    const workId = id('work', i)
    const title = `${pick(rand, workTitlePrefixes)} ${i}`
    const published = rand() < 0.85 ? 1 : 0
    
    // 作品画像: manifest から、なければデフォルト
    let workImageId = null
    if (i <= workImageIds.length) {
      workImageId = workImageIds[i - 1]
    }
    const defaultUrl = `${assetBaseUrl}/works/${workId}.${assetExt}`
    const thumbnailUrl = workImageId ? getAssetUrl(uploaderUrls, workImageId, defaultUrl) : defaultUrl
    
    works.push({ id: workId, title, published })
    sql.push(
      insertOnConflictId(
        'works',
        ['id', 'title', 'description', 'thumbnail_url', 'published', 'created_at', 'updated_at'],
        [workId, title, 'ローカル動作確認用のダミー作品です。', thumbnailUrl, published, now, now]
      )
    )

    // Work relations
    const wc = pickN(rand, categories, 2)
    wc.forEach((c, idx) => {
      sql.push(
        insertOnConflictKey(
          'work_categories',
          ['work_id', 'category_id', 'sort_order', 'created_at'],
          [workId, c.id, idx, now],
          'work_id, category_id',
          ['sort_order']
        )
      )
    })

    const wt = pickN(rand, tags, 3)
    wt.forEach((t) => {
      sql.push(
        insertOnConflictKey(
          'work_tags',
          ['work_id', 'tag_id', 'created_at'],
          [workId, t.id, now],
          'work_id, tag_id',
          []
        )
      )
    })

    const wcasts = pickN(rand, casts, 2)
    wcasts.forEach((c, idx) => {
      sql.push(
        insertOnConflictKey(
          'work_casts',
          ['work_id', 'cast_id', 'role_name', 'sort_order', 'created_at'],
          [workId, c.id, idx === 0 ? '主演' : '出演', idx, now],
          'work_id, cast_id',
          ['role_name', 'sort_order']
        )
      )
    })
  }

  // Videos
  sql.push('-- videos')
  // manifest.json から video images を読み込む
  const videoImageIds = (manifest.files?.videos || []).map(f => f.id)
  
  const videos = []
  const videoTitleById = new Map()
  const videoCastIdsByVideoId = new Map()

  // Deterministic always-present staff per video (ensures role-based rankings have rows).
  const actorMainCastId = id('cast', 1)
  const directorCastId = id('cast', 11)
  const writerCastId = id('cast', 18)
  const videoTitlePrefixes = ['第', '特別編', '番外編', '後編', '前編']
  let videoIndex = 1
  for (const work of works) {
    const perWork = 3
    for (let j = 1; j <= perWork; j++) {
      const videoId = id('video', videoIndex++)
      const episodeNo = j
      const title = `${pick(rand, videoTitlePrefixes)}${episodeNo}話 ${work.title}`
      const published = work.published ? (rand() < 0.9 ? 1 : 0) : 0
      
      // 動画画像: manifest から、なければデフォルト
      let videoImageId = null
      if (videoIndex - 1 <= videoImageIds.length) {
        videoImageId = videoImageIds[videoIndex - 2]  // 0-indexed
      }
      const defaultUrl = `${assetBaseUrl}/videos/${videoId}.${assetExt}`
      const thumbnailUrl = videoImageId ? getAssetUrl(uploaderUrls, videoImageId, defaultUrl) : defaultUrl
      
      const createdAt = isoDaysAgo(Math.floor(rand() * 20))
      const updatedAt = createdAt
      videos.push({ id: videoId, workId: work.id, title })
      videoTitleById.set(videoId, title)
      videoCastIdsByVideoId.set(videoId, new Set())

      sql.push(
        insertOnConflictId(
          'videos',
          [
            'id',
            'work_id',
            'title',
            'description',
            'stream_video_id',
            'thumbnail_url',
            'published',
            'scheduled_at',
            'created_at',
            'updated_at',
            'episode_no',
            'stream_video_id_clean',
            'stream_video_id_subtitled',
            'rating_avg',
            'review_count',
            'scheduled_status',
            'scheduled_cancelled_at',
            'deleted',
          ],
          [
            videoId,
            work.id,
            title,
            'ローカル動作確認用のダミー動画です。',
            '',
            thumbnailUrl,
            published,
            null,
            createdAt,
            updatedAt,
            episodeNo,
            '',
            '',
            Number((rand() * 4.5 + 0.5).toFixed(2)),
            Math.floor(rand() * 120),
            'scheduled',
            null,
            0,
          ]
        )
      )

      // Video relations
      const vc = pickN(rand, categories, 2)
      vc.forEach((c, idx) => {
        sql.push(
          insertOnConflictKey(
            'video_categories',
            ['video_id', 'category_id', 'sort_order', 'created_at'],
            [videoId, c.id, idx, now],
            'video_id, category_id',
            ['sort_order']
          )
        )
      })

      const vt = pickN(rand, tags, 4)
      vt.forEach((t) => {
        sql.push(
          insertOnConflictKey('video_tags', ['video_id', 'tag_id', 'created_at'], [videoId, t.id, now], 'video_id, tag_id', [])
        )
      })

      const vcasts = pickN(rand, casts, 3)
      vcasts.forEach((c, idx) => {
        videoCastIdsByVideoId.get(videoId)?.add(c.id)
        sql.push(
          insertOnConflictKey(
            'video_casts',
            ['video_id', 'cast_id', 'role_name', 'sort_order', 'created_at'],
            [videoId, c.id, idx === 0 ? 'メイン' : '出演', idx, now],
            'video_id, cast_id',
            ['role_name', 'sort_order']
          )
        )
      })

      // Ensure key roles are present for every video.
      videoCastIdsByVideoId.get(videoId)?.add(actorMainCastId)
      videoCastIdsByVideoId.get(videoId)?.add(directorCastId)
      videoCastIdsByVideoId.get(videoId)?.add(writerCastId)
      sql.push(
        insertOnConflictKey(
          'video_casts',
          ['video_id', 'cast_id', 'role_name', 'sort_order', 'created_at'],
          [videoId, actorMainCastId, '主演', 99, now],
          'video_id, cast_id',
          ['role_name', 'sort_order']
        )
      )
      sql.push(
        insertOnConflictKey(
          'video_casts',
          ['video_id', 'cast_id', 'role_name', 'sort_order', 'created_at'],
          [videoId, directorCastId, '監督', 100, now],
          'video_id, cast_id',
          ['role_name', 'sort_order']
        )
      )
      sql.push(
        insertOnConflictKey(
          'video_casts',
          ['video_id', 'cast_id', 'role_name', 'sort_order', 'created_at'],
          [videoId, writerCastId, '脚本', 101, now],
          'video_id, cast_id',
          ['role_name', 'sort_order']
        )
      )

      const vg = pickN(rand, genres, 2)
      vg.forEach((g) => {
        sql.push(
          insertOnConflictKey('video_genres', ['video_id', 'genre_id', 'created_at'], [videoId, g.id, now], 'video_id, genre_id', [])
        )
      })
    }
  }

  // Recommendations
  sql.push('-- video_recommendations')
  for (let i = 0; i < Math.min(20, videos.length); i++) {
    const v = videos[i]
    const recs = pickN(rand, videos.filter((x) => x.id !== v.id), 3)
    recs.forEach((r, idx) => {
      sql.push(
        insertOnConflictKey(
          'video_recommendations',
          ['video_id', 'recommended_video_id', 'sort_order', 'created_at'],
          [v.id, r.id, idx, now],
          'video_id, recommended_video_id',
          ['sort_order']
        )
      )
    })
  }

  // Featured slots
  sql.push('-- cms_featured_videos')
  const slots = ['pickup', 'new', 'recommend']
  slots.forEach((slot) => {
    const picks = pickN(rand, videos, 5)
    picks.forEach((v, idx) => {
      sql.push(
        insertOnConflictKey(
          'cms_featured_videos',
          ['slot', 'video_id', 'sort_order', 'created_at'],
          [slot, v.id, idx, now],
          'slot, video_id',
          ['sort_order']
        )
      )
    })
  })

  // Comments
  sql.push('-- comments')
  const commentBodies = [
    '最高でした！',
    '次回も楽しみです',
    '演出が良い',
    'ここ好き',
    '神回',
    '癒されました',
    '編集が丁寧',
    'また見ます',
  ]
  for (let i = 1; i <= 200; i++) {
    const commentId = id('comment', i)
    const video = pick(rand, videos)
    const status = rand() < 0.7 ? 'approved' : 'pending'
    const createdAt = isoDaysAgo(Math.floor(rand() * 14))
    const approvedAt = status === 'approved' ? createdAt : null
    sql.push(
      insertOnConflictId(
        'comments',
        // NOTE: In API, `content_id` is a work id, and `episode_id` is a video id.
        ['id', 'content_id', 'episode_id', 'author', 'body', 'status', 'created_at', 'approved_at'],
        [commentId, video.workId, video.id, `User${pad3(1 + Math.floor(rand() * 30))}`, pick(rand, commentBodies), status, createdAt, approvedAt]
      )
    )
  }

  // Favorites
  sql.push('-- favorite_casts / favorite_videos')
  for (let i = 1; i <= 30; i++) {
    const userId = id('user', i)
    const favCasts = pickN(rand, casts, Math.floor(rand() * 6))
    favCasts.forEach((c) => {
      sql.push(
        insertOnConflictKey('favorite_casts', ['user_id', 'cast_id', 'created_at'], [userId, c.id, now], 'user_id, cast_id', [])
      )
    })

    const favWorks = pickN(rand, works, Math.floor(rand() * 6))
    favWorks.forEach((w) => {
      sql.push(
        insertOnConflictKey('favorite_videos', ['user_id', 'work_id', 'created_at'], [userId, w.id, now], 'user_id, work_id', [])
      )
    })
  }

  // Inquiries
  sql.push('-- inquiries')
  const inquirySubjects = ['ログインできない', '決済について', '動画が再生できない', '要望', 'その他']
  for (let i = 1; i <= 12; i++) {
    const inquiryId = id('inq', i)
    const status = rand() < 0.75 ? 'open' : 'closed'
    const createdAt = isoDaysAgo(Math.floor(rand() * 30))
    const updatedAt = createdAt
    sql.push(
      insertOnConflictId(
        'inquiries',
        ['id', 'subject', 'body', 'status', 'created_at', 'updated_at'],
        [inquiryId, pick(rand, inquirySubjects), 'お問い合わせのダミー本文です。', status, createdAt, updatedAt]
      )
    )
  }

  // Notices
  sql.push('-- notices')
  for (let i = 1; i <= 8; i++) {
    const noticeId = id('notice', i)
    const status = rand() < 0.5 ? 'draft' : 'sent'
    const createdAt = isoDaysAgo(40 - i)
    const updatedAt = createdAt
    const sentAt = status === 'sent' ? createdAt : ''
    sql.push(
      insertOnConflictId(
        'notices',
        ['id', 'subject', 'body', 'sent_at', 'status', 'push', 'created_at', 'updated_at'],
        [noticeId, `お知らせ ${i}`, 'お知らせの本文（ダミー）です。', sentAt, status, rand() < 0.3 ? 1 : 0, createdAt, updatedAt]
      )
    )
  }

  // Events (for rankings)
  sql.push('-- video_play_events / coin_spend_events')

  // Track yesterday-only metrics to materialize cms_rankings immediately.
  const playCountByVideoId = new Map()
  const coinSumByVideoId = new Map()
  const playCountByActorCastId = new Map()
  const playCountByDirectorCastId = new Map()
  const playCountByWriterCastId = new Map()

  function inc(map, key, delta = 1) {
    map.set(key, (Number(map.get(key) ?? 0) || 0) + delta)
  }
  for (let i = 1; i <= 1000; i++) {
    const evId = id('play', i)
    const v = pick(rand, videos)
    const u = rand() < 0.8 ? pick(rand, users).id : null
    const createdAt = isoDaysAgo(Math.floor(rand() * 7))
    if (createdAt.slice(0, 10) === yesterdayYmd) {
      inc(playCountByVideoId, v.id, 1)
      const castIds = videoCastIdsByVideoId.get(v.id) ?? new Set()
      for (const castId of castIds) {
        const role = String((casts.find((x) => x.id === castId)?.role ?? '') || '')
        if (role.includes('出演')) inc(playCountByActorCastId, castId, 1)
        if (role.includes('監督')) inc(playCountByDirectorCastId, castId, 1)
        if (role.includes('脚本')) inc(playCountByWriterCastId, castId, 1)
      }
    }
    sql.push(insertOnConflictId('video_play_events', ['id', 'video_id', 'user_id', 'created_at'], [evId, v.id, u, createdAt]))
  }
  for (let i = 1; i <= 200; i++) {
    const evId = id('coin', i)
    const v = rand() < 0.9 ? pick(rand, videos).id : null
    const u = rand() < 0.9 ? pick(rand, users).id : null
    const amount = 10 + Math.floor(rand() * 90)
    const createdAt = isoDaysAgo(Math.floor(rand() * 7))
    if (v && createdAt.slice(0, 10) === yesterdayYmd) {
      inc(coinSumByVideoId, v, amount)
    }
    sql.push(
      insertOnConflictId(
        'coin_spend_events',
        ['id', 'video_id', 'user_id', 'amount', 'reason', 'created_at'],
        [evId, v, u, amount, 'seed', createdAt]
      )
    )
  }

  // cms_rankings (materialized for immediate UI use)
  // Matches the API daily job types: videos/coins/actors/directors/writers.
  sql.push('-- cms_rankings')

  function pushRankingRows(type, items) {
    let rank = 1
    for (const it of items.slice(0, 20)) {
      sql.push(
        [
          'INSERT INTO cms_rankings (type, as_of, rank, entity_id, label, value) VALUES',
          `  (${q(type)}, ${q(rankingsAsOf)}, ${rank}, ${q(String(it.entityId ?? ''))}, ${q(String(it.label ?? ''))}, ${Math.trunc(Number(it.value ?? 0))})`,
          'ON CONFLICT(type, as_of, rank) DO UPDATE SET entity_id = excluded.entity_id, label = excluded.label, value = excluded.value;',
        ].join('\n')
      )
      rank++
    }
  }

  const byDescValue = (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)

  const videosByPlays = Array.from(playCountByVideoId.entries())
    .map(([videoId, n]) => ({ entityId: videoId, label: String(videoTitleById.get(videoId) ?? videoId), value: n }))
    .sort(byDescValue)
  if (videosByPlays.length === 0) {
    // Fallback (should be rare): deterministic top list
    pushRankingRows(
      'videos',
      pickN(rand, videos, 10).map((v, idx) => ({ entityId: v.id, label: v.title, value: 100 - idx }))
    )
  } else {
    pushRankingRows('videos', videosByPlays)
  }

  const videosByCoins = Array.from(coinSumByVideoId.entries())
    .map(([videoId, n]) => ({ entityId: videoId, label: String(videoTitleById.get(videoId) ?? videoId), value: n }))
    .sort(byDescValue)
  pushRankingRows('coins', videosByCoins)

  const castNameById = new Map(casts.map((c) => [c.id, c.name]))
  pushRankingRows(
    'actors',
    Array.from(playCountByActorCastId.entries())
      .map(([castId, n]) => ({ entityId: castId, label: String(castNameById.get(castId) ?? castId), value: n }))
      .sort(byDescValue)
  )
  pushRankingRows(
    'directors',
    Array.from(playCountByDirectorCastId.entries())
      .map(([castId, n]) => ({ entityId: castId, label: String(castNameById.get(castId) ?? castId), value: n }))
      .sort(byDescValue)
  )
  pushRankingRows(
    'writers',
    Array.from(playCountByWriterCastId.entries())
      .map(([castId, n]) => ({ entityId: castId, label: String(castNameById.get(castId) ?? castId), value: n }))
      .sort(byDescValue)
  )

  sql.push('-- Seed complete.')

  process.stdout.write(sql.join('\n') + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
