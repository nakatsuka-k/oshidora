# Seed データ投入手順（資産アップローダー版）

## 前提条件

- ✅ OpenAI 画像生成完了: `apps/api/seed-images-generated/` に PNG ファイルとmanifest.json
- ✅ テストユーザー作成完了: `apps/api/test-user.md` に 10 個のテストユーザー
- ✅ アセットアップローダー URL 確認: `https://assets-uploader.oshidora.com`

## 実行手順

### ステップ 1: 画像をアップロード

```bash
cd apps/api
node scripts/upload-seed-images-uploader.mjs
```

**出力例:**
```
🚀 Seed画像をアップロード中...
📍 Uploader Base: https://assets-uploader.oshidora.com
🔑 Token生成完了 (有効期限: 24時間)

📁 カテゴリー: works
  ✅ seed_work_001.png → https://assets-uploader.oshidora.com/images/work-...
  ✅ seed_work_002.png → https://assets-uploader.oshidora.com/images/work-...
  ...

✨ アップロード完了！
📄 結果は以下に保存されました:
   apps/api/seed-images-generated/upload-result.json
```

**確認:**
```bash
cat apps/api/seed-images-generated/upload-result.json | jq '.uploadedUrls | keys'
```

### ステップ 2: SQL ファイル生成

```bash
cd apps/api
node scripts/seed-dataset.mjs > /tmp/oshidora-seed.sql
```

**確認:**
```bash
# アップロード結果が読み込まれたか確認
head -3 /tmp/oshidora-seed.sql

# アップローダー URL が含まれているか確認
grep "assets-uploader" /tmp/oshidora-seed.sql | head -3
```

### ステップ 3a: ローカル D1 に投入

```bash
cd apps/api
npx wrangler d1 execute oshidora-db --local --file /tmp/oshidora-seed.sql
```

**確認:**
```bash
# D1 CLI で確認
npx wrangler d1 execute oshidora-db --local --command "SELECT count(*) as cast_count FROM casts WHERE id LIKE 'seed_%'"

# 結果例:
# ┌───────────┐
# │ cast_count│
# ├───────────┤
# │ 24        │
# └───────────┘

# キャストの URL を確認
npx wrangler d1 execute oshidora-db --local --command "SELECT id, thumbnail_url FROM casts WHERE id LIKE 'seed_cast_%' LIMIT 3"

# 結果例:
# ┌──────────────┬──────────────────────────────────────────────────────┐
# │ id           │ thumbnail_url                                        │
# ├──────────────┼──────────────────────────────────────────────────────┤
# │ seed_cast_001│ https://assets-uploader.oshidora.com/images/cast-... │
# │ seed_cast_002│ https://assets-uploader.oshidora.com/images/cast-... │
# │ seed_cast_003│ https://assets-uploader.oshidora.com/images/cast-... │
# └──────────────┴──────────────────────────────────────────────────────┘
```

### ステップ 3b: 本番 D1 に投入

```bash
cd apps/api
npx wrangler d1 execute oshidora-db --remote --file /tmp/oshidora-seed.sql
```

**確認:**
```bash
npx wrangler d1 execute oshidora-db --remote --command "SELECT count(*) as total_records FROM (SELECT id FROM casts WHERE id LIKE 'seed_%' UNION ALL SELECT id FROM works WHERE id LIKE 'seed_%')"
```

## トラブルシューティング

### エラー: "manifest.json が見つかりません"

**原因**: OpenAI 画像生成が完了していない

**対応**:
```bash
cd apps/api
node scripts/generate-seed-images-openai.mjs
```

### エラー: "Upload API が 401 エラーを返した"

**原因**: Token が無効または期限切れ

**対応**:
```bash
# スクリプトを再実行
node scripts/upload-seed-images-uploader.mjs
```

### エラー: "Upload API が 403 エラーを返した"

**原因**: アップローダーベース URL が間違っている

**確認**:
```bash
# upload-seed-images-uploader.mjs のコード内を確認
grep -n "uploaderBase =" apps/api/scripts/upload-seed-images-uploader.mjs
```

**期待値**:
```
const uploaderBase = 'https://assets-uploader.oshidora.com'
```

### エラー: "SQL 構文エラー"

**原因**: seed-dataset.mjs の実行に失敗した

**対応**:
```bash
# 詳細なエラーを確認
node scripts/seed-dataset.mjs 2>&1 | head -100
```

## 検証チェックリスト

データ投入後の検証:

- [ ] ローカル D1:
  - キャスト数: 24
  - 作品数: 20
  - 動画数: 60
  - ユーザー数: 11 (admin + 10 test users)
  - キャスト画像は `https://assets-uploader.oshidora.com` で始まる

- [ ] 本番 D1: 同じ確認

- [ ] Admin パネル (`http://localhost:8081` or `https://admin.oshidra.com`):
  - ログイン: seed-admin@oshidra.local / Passw0rd!
  - キャストのサムネイル画像が表示される
  - 作品のサムネイル画像が表示される

- [ ] モバイルアプリ (`http://localhost:8000` or App Store):
  - ログイン: seed-user-001@oshidra.local / Passw0rd!
  - ホーム画面に作品とキャストが表示される
  - 画像が正しく読み込まれる

## 参考資料

- [Test Users Documentation](./test-user.md)
- [Asset Uploader Integration](./ASSET_UPLOADER_INTEGRATION.md)
- [Asset Uploader Implementation](./ASSET_UPLOADER_IMPLEMENTATION.md)

---

**最終更新**: 2026-01-30  
**ステータス**: 検証完了
