# 開発用データセット計画（seed dataset）

このリポジトリのローカルD1（`oshidora-db`）に「キャスト/タグ/動画/ユーザー/コメント/お気に入り/ランキング等」を一通り入れるための seed 設計と作成手順です。

> 注意: **本番（`--remote`）には絶対に流さないでください。**

## ゴール
- 管理画面（CMS/Admin）とアプリ（Mobile/Web）が、一覧・詳細・検索・お気に入り・ランキング等を一通り動作確認できる状態。
- すべてのレコードは `seed_` プレフィックスIDで作成し、何度でも作り直せる（seed行を削除→再投入）。
- 画像（サムネ/キャスト画像）は **16:9** を基本に、
  - まずはローカルで生成したSVGを配置（確実に動く）
  - 必要なら OpenAI 画像生成でPNG化（任意・コスト発生）

## 生成するデータ（内訳）
※最小限の「必須列 + よく使う列」を埋めます。その他はDBのDEFAULTに任せます。

### 認証/アカウント
- `cms_admins`: 1件
  - email: `seed-admin@oshidra.local`
  - password: `Passw0rd!`（固定）
- `users`: 30件
  - email: `seed-user-001@oshidra.local` 〜
  - password: `Passw0rd!`（固定）

### マスタ/分類
- `categories`: 8件（親子 `parent_id` を一部設定）
- `tags`: 30件（`category_id` を一部設定）
- `genres`: 8件
- `cast_categories`: 3件

### キャスト/スタッフ
- `casts`: 24件（`category_id` を設定、`thumbnail_url` を16:9で付与）
- `cast_staff_profiles`: 10件（`casts`の一部を`users`に紐付け）
  - `profile_images_json`: 16:9画像URLを複数
  - `face_image_url`: 16:9（要件に合わせる）
  - `sns_json`: ダミーSNSリンク

### 作品/動画
- `works`: 20件（`thumbnail_url` あり、公開/非公開を混在）
- `videos`: 60件（`work_id` に紐付け、`episode_no` などを設定）
  - `thumbnail_url`: 16:9
  - `published`: 混在
  - `deleted`: すべて0（ソフトデリート未使用状態で開始）
- リレーション
  - `work_categories`, `work_tags`, `work_casts`
  - `video_categories`, `video_tags`, `video_casts`, `video_genres`
  - `video_recommendations`: 一部（関連動画）
  - `cms_featured_videos`: `pickup/new/recommend` 等のslotで少数

### コメント/お気に入り
- `comments`: 200件（`content_id` は `videos.id` を使用、`pending/approved` 混在）
- `favorite_casts`: 各ユーザー0〜5件
- `favorite_videos`: 各ユーザー0〜5件（work単位）

### ランキング/イベント
- `video_play_events`: 1000件（直近7日分に分散）
- `coin_spend_events`: 200件（直近7日分に分散、amountは少額）
- `cms_rankings`: 3タイプ×上位10件（例: `plays_today`, `coins_today`, `favorites`）

### その他（動作確認用）
- `inquiries`: 12件（open/closed混在）
- `app_settings`:
  - `maintenance_mode = 0`
  - `maintenance_message = ''`

## 画像（サムネ/プロフィール）
- 生成先（推奨）: `apps/admin/public/seed-images/`
- URL例（ローカル）: `http://localhost:8082/seed-images/...`
- まずはSVGを生成（確実に表示できる）。必要なら OpenAI 画像生成でPNG化。

## 実行手順（ローカルD1）
1) マイグレーション
- `cd apps/api`
- `npm run db:migrate:local`

2) 画像生成（任意）
- SVG（デフォルト）: `node ./scripts/generate-seed-images.mjs --out ../admin/public/seed-images`
- PNG: `node ./scripts/generate-seed-images.mjs --out ../admin/public/seed-images --format png`

3) SQL生成 → D1に投入
- SVGの場合: `node ./scripts/seed-dataset.mjs --assetBaseUrl http://localhost:8082/seed-images --assetExt svg > /tmp/oshidora-seed-dataset.sql`
- PNGの場合: `node ./scripts/seed-dataset.mjs --assetBaseUrl http://localhost:8082/seed-images --assetExt png > /tmp/oshidora-seed-dataset.sql`
- `npx -y wrangler d1 execute oshidora-db --local --file /tmp/oshidora-seed-dataset.sql`

4) 起動して確認
- API: `cd apps/api && npm run dev`
- Admin: `cd apps/admin && npm run dev`（または既存のstartスクリプト）

## OpenAI画像生成を使う場合（任意）
- 画像生成はコストがかかります。**環境変数 `OPENAI_API_KEY` をローカル環境でのみ設定**して実行してください。
- このリポジトリ内の `.env*.local` はgitignoreされていますが、チャットやIssue等にキーを貼らない運用を推奨します。

---

実装: [apps/api/scripts/seed-dataset.mjs](apps/api/scripts/seed-dataset.mjs) と [apps/api/scripts/generate-seed-images.mjs](apps/api/scripts/generate-seed-images.mjs)
