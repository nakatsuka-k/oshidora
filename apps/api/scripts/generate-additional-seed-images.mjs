#!/usr/bin/env node

/**
 * 追加 Seed 画像生成スクリプト
 * - 動画サムネイル画像（60枚、16:9）
 * - キャスト プロフィール背景画像（10枚、16:9）
 * - SNS URL 情報（JSON）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../seed-images-generated')

// OpenAI 設定
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = 'dall-e-3'

if (!OPENAI_API_KEY) {
  console.error('❌ エラー: OPENAI_API_KEY 環境変数が設定されていません')
  process.exit(1)
}

// HTTPS リクエスト（画像ダウンロード用）
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// OpenAI API 呼び出し
async function callOpenAI(prompt, size) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      prompt,
      n: 1,
      size,
      quality: 'standard',
      style: 'vivid',
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API エラー: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()
  return data.data[0].url
}

// 画像を保存
async function saveImage(url, filePath) {
  const buffer = await httpsGet(url)
  fs.writeFileSync(filePath, buffer)
  console.log(`✅ 保存: ${path.relative(outDir, filePath)}`)
}

// 既存 manifest.json を読み込む
function loadManifest() {
  const manifestPath = path.resolve(outDir, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  }
  return { generatedAt: new Date().toISOString(), outDir, files: {} }
}

async function main() {
  console.log('🎨 追加 Seed 画像生成開始...\n')

  const only = String(process.env.ONLY || '').trim()
  const onlySet = new Set(
    only
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  const shouldRun = (key) => (onlySet.size ? onlySet.has(key) : true)

  const manifest = loadManifest()
  manifest.generatedAt = new Date().toISOString()

  // 動画サムネイル画像（60枚、16:9）
  if (shouldRun('videos')) console.log('📹 動画サムネイル画像生成中...')
  const videosDir = path.resolve(outDir, 'videos')
  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true })

  if (shouldRun('videos')) {
    const count = Math.max(1, Math.min(60, Number(process.env.SEED_VIDEO_THUMB_COUNT || 60)))
    manifest.files.videos = []

    // Japanese drama style video thumbnails (16:9)
    // Requirement: generate a random Japanese drama title, use it in the prompt as story context,
    // but NEVER render any text on the image (leave negative space for title layout).
    const characters = [
      'young man',
      'young woman',
      'middle-aged man',
      'middle-aged woman',
      'couple',
      'group of friends',
    ]
    const emotions = [
      'serious and torn',
      'crying passionately',
      'angry and determined',
      'conflicted and lost',
      'smiling sadly with regret',
      'shocked and betrayed',
      'desperate and hopeful',
      'introspective and haunted',
    ]
    const scenes = [
      'in a dimly lit apartment late at night',
      'in a hospital corridor',
      'in heavy rain on an empty street',
      'on a rooftop at dawn',
      'in an office building at sunset',
      'on a train platform alone',
      'in a car in nighttime traffic',
      'in an abandoned warehouse',
      'in a traditional Japanese room',
      'in a modern cafe at closing time',
    ]
    const gazes = [
      'looking directly at camera with intensity',
      'looking away mysteriously',
      'staring downwards in turmoil',
      'looking off-screen at something painful',
      'eyes glistening with tears',
    ]

    const mulberry32 = (seed) => {
      let t = seed >>> 0
      return () => {
        t += 0x6d2b79f5
        let r = Math.imul(t ^ (t >>> 15), 1 | t)
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296
      }
    }

    const pick = (rng, list) => list[Math.floor(rng() * list.length)]

    const generateJapaneseDramaTitle = (rng) => {
      // Keep it natural and drama-ish; avoid brand names.
      const nounsA = [
        '雨',
        '夜',
        '嘘',
        '秘密',
        '約束',
        '罪',
        '記憶',
        '告白',
        '選択',
        '運命',
        '別れ',
        '再会',
        '沈黙',
        '真実',
        '影',
        '光',
        '月',
        '海',
        '東京',
        '夏',
      ]
      const nounsB = ['キス', '電話', '手紙', '涙', '指輪', '鍵', '契約', '境界線', '扉', '証拠', '心']
      const adjectives = ['禁断の', '最後の', '真夜中の', '消えない', '叶わない', '壊れた', '秘密の', '静かな']
      const endings = ['の約束', 'の真実', 'の行方', 'の代償', 'の物語', 'の選択']

      const patterns = [
        () => `${pick(rng, nounsA)}と${pick(rng, nounsB)}`,
        () => `${pick(rng, nounsA)}の${pick(rng, nounsB)}`,
        () => `${pick(rng, adjectives)}${pick(rng, nounsA)}`,
        () => `${pick(rng, adjectives)}${pick(rng, nounsB)}`,
        () => `${pick(rng, nounsA)}${pick(rng, endings)}`,
      ]

      for (let attempt = 0; attempt < 5; attempt++) {
        const title = pick(rng, patterns)()
        if (!title.includes('のの') && !title.includes('とと')) return title
      }
      return `${pick(rng, nounsA)}の${pick(rng, nounsB)}`
    }

    for (let i = 1; i <= count; i++) {
      try {
        const videoId = `seed_video_${String(i).padStart(3, '0')}`
        const character = characters[i % characters.length]
        const emotion = emotions[(i * 3) % emotions.length]
        const scene = scenes[(i * 5) % scenes.length]
        const gaze = gazes[(i * 7) % gazes.length]
        const rng = mulberry32((Number(process.env.TITLE_SEED || 0) + i) * 2654435761)
        const jpTitle = generateJapaneseDramaTitle(rng)
        const episodeNum = String(((i - 1) % 12) + 1).padStart(2, '0')

        const prompt = [
          'Japanese drama style, Netflix Japan-tier production,',
          'cinematic key art, professional film still quality,',
          'Japanese actors, authentic appearance,',
          'dark moody color grading, deep shadows, strong contrast,',
          'emotional intensity, dramatic atmosphere,',
          'high-end cinematography, shallow depth of field,',
          'high production value aesthetic,',
          'realistic lighting, intimate yet cinematic,',
          `${character} ${scene}, ${emotion}, ${gaze}.`,
          `Story context (do not render as text): Japanese episode title is 「${jpTitle}」, episode is EP.${episodeNum}.`,
          'Leave clean negative space / safe area at the top and bottom for where a title could be placed later.',
          'Do NOT render any text, typography, subtitles, captions, letters, numbers, logos, or watermarks.',
          `16:9 widescreen composition. Video ID: ${videoId}`,
        ].join(' ')

        console.log(`  ⏳ ${i}/${count}: ${videoId} 生成中...`)
        const url = await callOpenAI(prompt, '1792x1024')

        const filePath = path.resolve(videosDir, `${videoId}.png`)
        await saveImage(url, filePath)

        manifest.files.videos.push({
          id: videoId,
          localFile: `seed-images-generated/videos/${videoId}.png`,
          r2Path: `seed-images/videos/${videoId}.png`,
        })
      } catch (err) {
        console.error(`  ❌ ${i}/${count} 失敗: ${err.message}`)
      }
    }
  }

  // キャスト プロフィール背景画像（10枚、16:9、華やかな背景）
  if (shouldRun('castProfileBg')) console.log('\n🌸 キャスト プロフィール背景画像生成中...')
  const castBgDir = path.resolve(outDir, 'cast-profile-bg')
  if (!fs.existsSync(castBgDir)) fs.mkdirSync(castBgDir, { recursive: true })

  if (shouldRun('castProfileBg')) manifest.files.castProfileBg = []
  const bgPrompts = [
    '豪華な花が咲く春の庭園、明るくエレガントな背景',
    'キラキラした星空と夜景の背景、ロマンチック、高級感',
    'トロピカルなビーチの夕焼け、温かみのある色彩',
    'モダンなシティスケープ、洗練された背景',
    'さくらが舞う京都の古い通り、日本情緒漂う背景',
    '淡いパステルカラーのグラデーション背景、優雅',
    'グラマラスなシャンパンゴールドと白のテクスチャ背景',
    '森の中の光のしぶき、神秘的でエレガント',
    'ミッドナイトブルーとシルバーの豪華な背景',
    '桜とプリズム光の組み合わせ、ファンタジック',
  ]

  if (shouldRun('castProfileBg')) {
    for (let i = 1; i <= 10; i++) {
      try {
        const castId = `seed_cast_${String(i).padStart(3, '0')}`
        const prompt = `${bgPrompts[i - 1]}。キャスト ID: ${castId}`

        console.log(`  ⏳ ${i}/10: ${castId} 背景生成中...`)
        const url = await callOpenAI(prompt, '1792x1024')

        const filePath = path.resolve(castBgDir, `${castId}-bg.png`)
        await saveImage(url, filePath)

        manifest.files.castProfileBg.push({
          id: castId,
          localFile: `seed-images-generated/cast-profile-bg/${castId}-bg.png`,
          r2Path: `seed-images/cast-profile-bg/${castId}-bg.png`,
        })
      } catch (err) {
        console.error(`  ❌ ${i}/10 失敗: ${err.message}`)
      }
    }
  }

  // SNS URL 情報を生成
  if (shouldRun('sns')) console.log('\n🔗 SNS URL 情報生成中...')
  const snsData = {}
  const xHandles = ['milkyway_idol', 'sakura_stars', 'luna_project', 'cosmic_beats', 'dream_girls',
    'stellar_voice', 'melody_plus', 'star_light_jp', 'aurora_ent', 'phoenix_music']
  const instagramIds = ['milkyway.idol', 'sakura_stars_official', 'luna_project_official', 
    'cosmic_beats_jp', 'dream_girls_official', 'stellar_voice_jp', 'melody_plus_official',
    'star_light_official', 'aurora_entertainment', 'phoenix_music_official']
  const tiktokIds = ['milkyway_idol', 'sakura.stars', 'luna_project_', 'cosmic.beats', 
    'dream.girls', 'stellar.voice', 'melody_plus_', 'star_light_jp', 'aurora_ent_', 'phoenix.music']

  if (shouldRun('sns')) {
    for (let i = 1; i <= 10; i++) {
      const castId = `seed_cast_${String(i).padStart(3, '0')}`
      snsData[castId] = [
        { type: 'x', url: `https://x.com/${xHandles[i - 1]}` },
        { type: 'instagram', url: `https://instagram.com/${instagramIds[i - 1]}` },
        { type: 'tiktok', url: `https://tiktok.com/@${tiktokIds[i - 1]}` },
      ]
      console.log(`✅ ${castId}: X, Instagram, TikTok`)
    }
  }

  // Regenerate cast profiles with human-centric drama style (9:16)
  if (shouldRun('castProfiles')) {
    console.log('\n👤 キャスト 9:16 プロフィール画像生成中（日本ドラマスタイル）...')
    const castProfilesDir = path.resolve(outDir, 'cast-profiles')
    if (!fs.existsSync(castProfilesDir)) fs.mkdirSync(castProfilesDir, { recursive: true })

    const castCount = Number(process.env.SEED_CAST_COUNT || 10)
    const profileImageCount = Number(process.env.SEED_CAST_PROFILE_IMAGE_COUNT || 10)
    const skipExisting = String(process.env.SKIP_EXISTING ?? '1') !== '0'
    manifest.files.castProfiles = []

    const castTypes = [
      'stylish adult woman',
      'stylish adult man',
      'elegant adult woman',
      'charming adult man',
    ]
    const moods = [
      'confident, powerful presence',
      'thoughtful, introspective',
      'gentle, approachable warmth',
      'mysterious, captivating allure',
      'dramatic, intense gaze',
    ]
    const backdrops = [
      'in a bright modern room interior, soft natural window light',
      'in a minimal studio with clean white background',
      'in a cozy living room, warm ambient glow',
      'in a stylish apartment hallway, soft cinematic lighting',
      'in a simple room interior, neutral tones, gentle lighting',
    ]

    const poses = [
      'standing full body, relaxed natural pose',
      'standing three-quarter body, calm confident posture',
      'standing full body, subtle movement, candid feel',
      'standing three-quarter body, hands naturally placed',
    ]

    for (let i = 1; i <= castCount; i++) {
      for (let j = 1; j <= profileImageCount; j++) {
        try {
          const castId = `seed_cast_${String(i).padStart(3, '0')}`
          const fileName = `${castId}-${j}`
          const castType = castTypes[(i + j) % castTypes.length]
          const mood = moods[(i * 3 + j) % moods.length]
          const backdrop = backdrops[(i * 2) % backdrops.length]
          const pose = poses[(i + j * 2) % poses.length]

          const filePath = path.resolve(castProfilesDir, `${fileName}.png`)
          if (skipExisting && fs.existsSync(filePath)) {
            console.log(`  ⏭️  skip existing: ${fileName}`)
            manifest.files.castProfiles.push({
              id: castId,
              index: j,
              localFile: `seed-images-generated/cast-profiles/${fileName}.png`,
              r2Path: `seed-images/cast-profiles/${fileName}.png`,
            })
            continue
          }

          const prompt = [
            'Japanese drama style, photorealistic full-body portrait of a fictional Japanese person (NOT a real celebrity, no resemblance),',
            'professional talent photo, 9:16 vertical composition, full body or three-quarter body visible,',
            'cinema-quality film still aesthetic, premium production value,',
            'realistic, natural facial features and proportions, authentic appearance,',
            'adult person, fully clothed, modest wardrobe, non-sexual,',
            `${castType}, ${mood}, ${pose},`,
            `${backdrop}.`,
            'Keep the subject centered with enough headroom and foot room, natural perspective.',
            'Do NOT render any text, letters, numbers, logos, watermarks, subtitles, or UI.',
            'No illustration, no anime, no cartoon, no 3D render, no painting.',
            `Portrait ID: ${fileName}`,
          ].join(' ')

          console.log(`  ⏳ ${i}-${j}/${castCount}-${profileImageCount}: ${fileName} 生成中...`)
          const url = await callOpenAI(prompt, '1024x1792')
          await saveImage(url, filePath)

          manifest.files.castProfiles.push({
            id: castId,
            index: j,
            localFile: `seed-images-generated/cast-profiles/${fileName}.png`,
            r2Path: `seed-images/cast-profiles/${fileName}.png`,
          })
        } catch (err) {
          console.error(`  ❌ ${i}-${j} 失敗: ${err.message}`)
        }
      }
    }
  }

  // Regenerate cast faces with human-centric drama style (1:1)
  if (shouldRun('castFaces')) {
    console.log('\n😊 キャスト 1:1 顔画像生成中（日本ドラマスタイル）...')
    const castFacesDir = path.resolve(outDir, 'cast-faces')
    if (!fs.existsSync(castFacesDir)) fs.mkdirSync(castFacesDir, { recursive: true })

    const castCount = Number(process.env.SEED_CAST_COUNT || 10)
    manifest.files.castFaces = []

    const castFaceTypes = [
      'beautiful young woman',
      'handsome young man',
      'elegant middle-aged woman',
      'charming middle-aged man',
    ]

    const wardrobe = [
      'simple dark suit, clean neckline',
      'casual smart jacket, minimal accessories',
      'neutral knit, understated style',
      'classic blouse/shirt, timeless styling',
    ]

    const faceExpressions = [
      'confident and powerful, direct eye contact',
      'gentle and warm, natural smile',
      'thoughtful and introspective, subtle expression',
      'mysterious and alluring, captivating gaze',
      'dramatic and emotional, compelling presence',
    ]

    for (let i = 1; i <= castCount; i++) {
      try {
        const castId = `seed_cast_${String(i).padStart(3, '0')}`

        const castType = castFaceTypes[(i - 1) % castFaceTypes.length]
        const outfit = wardrobe[(i * 2) % wardrobe.length]
        const expression = faceExpressions[(i - 1) % faceExpressions.length]

        const prompt = [
          'Japanese drama style, photorealistic premium headshot of a fictional Japanese person (NOT a real celebrity, no resemblance),',
          'professional talent headshot, close-up face portrait only, 1:1 square composition,',
          'high-end talent agency quality,',
          'single person, front-facing, centered, head and upper shoulders only,',
          'realistic, natural facial features, authentic appearance,',
          'cinematic color grading, warm studio lighting,',
          'professional photography, shallow depth of field,',
          'studio headshot, premium production value,',
          'razor-sharp focus on eyes, beautiful natural skin,',
          `${castType}, ${expression}, ${outfit}.`,
          'Soft blurred neutral background or subtle bokeh.',
          'Do NOT render any text, letters, numbers, logos, watermarks, subtitles, or UI.',
          'No illustration, no anime, no cartoon, no 3D render, no painting.',
          `Cast ID: ${castId}`,
        ].join(' ')

        console.log(`  ⏳ ${i}/${castCount}: ${castId} 生成中...`)
        const url = await callOpenAI(prompt, '1024x1024')

        const filePath = path.resolve(castFacesDir, `${castId}.png`)
        await saveImage(url, filePath)

        manifest.files.castFaces.push({
          id: castId,
          localFile: `seed-images-generated/cast-faces/${castId}.png`,
          r2Path: `seed-images/cast-faces/${castId}.png`,
        })
      } catch (err) {
        console.error(`  ❌ ${i}/${castCount} 失敗: ${err.message}`)
      }
    }
  }

  // manifest.json に SNS データを追加
  if (shouldRun('sns')) manifest.files.sns = snsData

  // manifest.json を保存
  const manifestPath = path.resolve(outDir, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`\n✨ 完了！`)
  console.log(`📊 生成結果:`)
  console.log(`   - 動画サムネイル: ${manifest.files.videos?.length || 0} 枚`)
  console.log(`   - キャスト背景: ${manifest.files.castProfileBg?.length || 0} 枚`)
  console.log(`   - SNS URL: ${Object.keys(snsData).length} 件`)
  console.log(`\n📁 manifest.json を更新しました: ${manifestPath}`)
}

main().catch(err => {
  console.error('❌ エラー:', err.message)
  process.exit(1)
})
