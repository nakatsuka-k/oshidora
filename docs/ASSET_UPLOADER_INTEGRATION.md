# Asset Uploader Integration

このドキュメントは、`assets-uploader.oshidora.com` を使用した seed 画像のアップロード処理について説明します。

## 概要

1. **`upload-seed-images-uploader.mjs`**: OpenAI で生成した seed 画像を assets-uploader API にアップロード
2. **Token 生成**: 署名付き JWT トークンで API 認証
3. **URL マッピング**: アップロード結果を `upload-result.json` に保存
4. **seed-dataset.mjs 統合**: アップロード URL を seed データベースに反映

## ファイル構成

```
apps/api/seed-images-generated/
├── manifest.json           # 生成された画像の metadata (OpenAI)
├── upload-result.json      # アップロード結果 (作成される)
├── works/                  # 作品サムネイル (3枚)
├── cast-profiles/          # キャスト プロフィール画像 (6枚×2)
└── cast-faces/             # キャスト顔画像 (3枚)

apps/api/scripts/
├── upload-seed-images-uploader.mjs    # アップロード実行スクリプト
└── seed-dataset.mjs                   # seed データセット生成 (更新版)
```

## 使用方法

### Step 1: 画像をアップロード

```bash
cd apps/api
node scripts/upload-seed-images-uploader.mjs
```

出力例:
```
🚀 Seed画像をアップロード中...
📍 Uploader Base: https://assets-uploader.oshidora.com
🔑 Token生成完了 (有効期限: 24時間)

📁 カテゴリー: works
  ✅ seed_work_001.png → https://assets-uploader.oshidora.com/...
  ✅ seed_work_002.png → https://assets-uploader.oshidora.com/...
  ...

✨ アップロード完了！
📄 結果は以下に保存されました:
   apps/api/seed-images-generated/upload-result.json
```

### Step 2: Seed データセットを生成

```bash
cd apps/api
node scripts/seed-dataset.mjs > /tmp/oshidora-seed.sql
```

`upload-result.json` が存在すれば自動的に読み込まれ、アップロード URL を使用します。
ない場合はデフォルト URL (`http://localhost:8084/seed-images`) を使用します。

出力例:
```
✅ アップロード結果を読み込みました (12 ファイル)
```

### Step 3: ローカル D1 に適用

```bash
cd apps/api
npx wrangler d1 execute oshidora-db --local --file /tmp/oshidora-seed.sql
```

### Step 4: 本番 D1 に適用

```bash
cd apps/api
npx wrangler d1 execute oshidora-db --remote --file /tmp/oshidora-seed.sql
```

## Token 生成の仕組み

### 署名付き JWT トークン

アップロードスクリプトで生成されるトークンは、HS256 で署名された JWT です：

```javascript
header: { alg: 'HS256', typ: 'JWT' }
payload: {
  iss: 'oshidora-seed',
  sub: 'seed-uploader',
  iat: <発行時刻>,
  exp: <発行時刻 + 86400秒>
}
secret: 'seed-uploader-secret-key'
```

**注意**: 本番環境では秘密鍵を環境変数から読み込むこと。

### API 認証ヘッダー

```
Authorization: Bearer <token>
Content-Type: image/png
```

## API 仕様（アップローダー）

### PUT /cms/images

| 項目 | 値 |
|------|---|
| Method | PUT |
| Content-Type | image/png |
| Authorization | Bearer \<token\> |

**リクエスト**: バイナリファイル

**レスポンス**:
```json
{
  "error": null,
  "data": {
    "url": "https://assets-uploader.oshidora.com/images/abc123.png"
  }
}
```

## トラブルシューティング

### アップロード失敗

#### 401 エラー

Token が無効または期限切れです。スクリプトを再実行してください。

#### 403 エラー

API キーまたは権限がありません。`uploaderBase` が正しく設定されているか確認してください。

#### 500 エラー

サーバー側のエラーです。ネットワークと API サーバーの状態を確認してください。

### manifest.json が見つからない

OpenAI 画像生成スクリプトを先に実行してください：
```bash
node scripts/generate-seed-images-openai.mjs
```

### アップロード結果が反映されない

`upload-result.json` が正しく作成されているか確認してください：
```bash
cat apps/api/seed-images-generated/upload-result.json
```

## 本番環境への適用

### 環境変数設定

`wrangler.toml` または環境変数で以下を設定：

```
UPLOADER_SECRET_KEY=<本番用秘密鍵>
UPLOADER_BASE_URL=https://assets-uploader.oshidora.com
```

### スクリプト修正

`upload-seed-images-uploader.mjs` の秘密鍵を環境変数から読み込むように修正：

```javascript
const secret = process.env.UPLOADER_SECRET_KEY || 'seed-uploader-secret-key'
```

## FAQ

**Q: Token の有効期限は？**  
A: 24時間です。長時間かかるアップロードの場合は、スクリプト内で有効期限を増やしてください。

**Q: アップロード失敗時にリトライされますか？**  
A: いいえ。失敗時は手動でスクリプトを再実行してください。

**Q: アップロード済み画像を上書きできますか？**  
A: API 仕様次第です。`upload-result.json` を削除し、スクリプトを再実行してください。

**Q: ローカルとクラウドで異なるアップローダー URL を使いたいです**  
A: `seed-dataset.mjs` の `--assetBaseUrl` パラメータを使い分けてください。
