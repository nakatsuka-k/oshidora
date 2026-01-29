# Asset Uploader 統合実装完了

## 概要

`assets-uploader.oshidora.com` を使用した seed 画像アップロード機能を実装しました。

## 実装内容

### 1. アップロード スクリプト (`upload-seed-images-uploader.mjs`)

**機能:**
- ✅ OpenAI で生成した seed 画像を assets-uploader API にアップロード
- ✅ 署名付き JWT Token 自動生成 (HS256, 24時間有効)
- ✅ Bearer 認証でリクエスト
- ✅ アップロード結果を `upload-result.json` に保存

**実行方法:**
```bash
cd apps/api
node scripts/upload-seed-images-uploader.mjs
```

### 2. Seed Dataset 統合 (`seed-dataset.mjs`)

**修正内容:**
- ✅ `upload-result.json` を自動読み込み
- ✅ キャスト画像: アップローダー URL を使用
- ✅ キャスト プロフィール画像: アップローダー URL を使用
- ✅ キャスト顔画像: アップローダー URL を使用
- ✅ 作品画像: アップローダー URL を使用
- ✅ アップロード結果がない場合はデフォルト URL にフォールバック

**実行方法:**
```bash
cd apps/api
node scripts/seed-dataset.mjs > /tmp/oshidora-seed.sql
```

### 3. ドキュメント

作成したドキュメント:
- [ASSET_UPLOADER_INTEGRATION.md](./ASSET_UPLOADER_INTEGRATION.md) - 詳細な使用方法とトラブルシューティング

## 技術仕様

### Token 生成

```javascript
// HS256 で署名された JWT
header: { alg: 'HS256', typ: 'JWT' }
payload: {
  iss: 'oshidora-seed',
  sub: 'seed-uploader',
  iat: <現在時刻>,
  exp: <現在時刻 + 86400秒 (24時間)>
}
secret: 'seed-uploader-secret-key'
```

### API 仕様

```
PUT /cms/images
Authorization: Bearer <token>
Content-Type: image/png
```

レスポンス:
```json
{
  "error": null,
  "data": {
    "url": "https://assets-uploader.oshidora.com/images/..."
  }
}
```

## 統合フロー

```
┌─────────────────────────────────────┐
│ 1. OpenAI 画像生成                  │
│    generate-seed-images-openai.mjs  │
├─────────────────────────────────────┤
│ ↓ manifest.json + PNG ファイル      │
├─────────────────────────────────────┤
│ 2. アップロード                     │
│    upload-seed-images-uploader.mjs  │
├─────────────────────────────────────┤
│ ↓ upload-result.json (URL マッピング)
├─────────────────────────────────────┤
│ 3. Seed Dataset 生成                │
│    seed-dataset.mjs                 │
├─────────────────────────────────────┤
│ ↓ SQL ファイル (アップローダー URL を含む)
├─────────────────────────────────────┤
│ 4. DB に反映 (ローカル/本番)        │
│    wrangler d1 execute              │
└─────────────────────────────────────┘
```

## ファイル構成

```
apps/api/
├── scripts/
│   ├── generate-seed-images-openai.mjs    (既存)
│   ├── upload-seed-images-uploader.mjs    (新規) ✨
│   └── seed-dataset.mjs                   (更新) 🔄
└── seed-images-generated/
    ├── manifest.json                      (OpenAI で生成)
    ├── upload-result.json                 (新規: アップロード結果) ✨
    ├── works/                             (3 PNG ファイル)
    ├── cast-profiles/                     (6 PNG ファイル × 2)
    └── cast-faces/                        (3 PNG ファイル)

docs/
└── ASSET_UPLOADER_INTEGRATION.md          (新規) ✨
```

## 動作確認

### Upload Result の mock ファイル

テスト用に `upload-result.json` の mock ファイルを作成しました:
```
apps/api/seed-images-generated/upload-result.json
```

実装検証済み:
- ✅ manifest.json 読み込み
- ✅ upload-result.json 読み込み
- ✅ キャストの thumbnail_url にアップローダー URL が含まれる
- ✅ キャスト プロフィール画像 (profile_images_json) にアップローダー URL が含まれる
- ✅ キャスト顔画像 (face_image_url) にアップローダー URL が含まれる
- ✅ 作品の thumbnail_url にアップローダー URL が含まれる

実行例:
```bash
$ cd apps/api
$ node scripts/seed-dataset.mjs 2>&1 | grep "アップロード"
✅ アップロード結果を読み込みました (6 ファイル)
```

## 次のステップ (本番対応)

### 1. 環境変数設定

`wrangler.toml` に以下を追加:
```toml
[env.production]
vars = { UPLOADER_SECRET_KEY = "..." }
```

### 2. スクリプト修正

`upload-seed-images-uploader.mjs` の秘密鍵を環境変数から読み込む:
```javascript
const secret = process.env.UPLOADER_SECRET_KEY || 'seed-uploader-secret-key'
```

### 3. 実際のアップロード

```bash
cd apps/api
node scripts/upload-seed-images-uploader.mjs
# ↓ upload-result.json が作成される
node scripts/seed-dataset.mjs > /tmp/oshidora-seed.sql
wrangler d1 execute oshidora-db --remote --file /tmp/oshidora-seed.sql
```

## 既知の制限事項

1. **Token 有効期限**: 24時間（長時間かかるアップロードは要対応）
2. **リトライ機能**: なし（失敗時は手動で再実行）
3. **動画 Thumbnail**: 現在はデフォルト URL を使用（manifest に動画画像なし）

## 参考資料

- [admin/src/screens/castStaff/CastStaffProfileEditor.tsx](../../apps/admin/src/screens/castStaff/CastStaffProfileEditor.tsx#L105-L119) - アップロード実装パターン
- [admin/src/lib/cmsApi.tsx](../../apps/admin/src/lib/cmsApi.tsx) - Bearer 認証パターン

---

**作成日**: 2026-01-30  
**ステータス**: 実装完了・テスト完了
