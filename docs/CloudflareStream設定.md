# Cloudflare Stream（非公開配信 / Signed URL + クライアントアップロード）

このリポジトリでは Cloudflare Stream を **非公開配信（Signed URL）** として扱い、
- 再生は **API（Cloudflare Workers）で署名付きURLを発行**
- アップロードは **クライアントから Direct Upload（署名済みアップロードURL）**
という構成で実装しています。

## 目的

- Stream の **APIトークン**・**署名鍵**をクライアント（Expo/ブラウザ）へ露出しない
- 非公開配信（Signed URL）前提で、動画URLの直リンク共有を抑止する
- アップロードはクライアントから直接行い、APIは「アップロードURLを発行するだけ」にする

## 既存実装（エンドポイント）

API（`apps/api`）に以下を実装しています。

### 1) 署名付き再生URL発行（非公開配信）

- `GET /v1/stream/signed-playback/:videoId`
- 返却例（JSON）:
  - `iframeUrl`（署名付き）
  - `hlsUrl`（署名付き）
  - `dashUrl`（署名付き）
  - `expiresAt`（UNIX秒）

モバイル側（`apps/mobile`）の動画詳細（`workDetail`）は、ここで返る `hlsUrl` を再生に使用します。

### 2) クライアントアップロードURL発行（Direct Upload）

- `POST /v1/stream/direct-upload`
- リクエストボディ（任意）:

```json
{
  "maxDurationSeconds": 1800,
  "metaName": "upload",
  "requireSignedURLs": true
}
```

- 返却例（JSON）:
  - `uploadURL`
  - `uid`（= StreamのvideoId として扱える）
  - `expires`

クライアントは受け取った `uploadURL` に対して、Cloudflare の仕様に従ってファイルをアップロードします。
アップロード後に得られる `uid` を、作品詳細で再生したい videoId として扱います。

### 3) デバッグ用（動画情報取得）

- `GET /v1/stream/playback/:videoId`

※これは「Stream管理APIから動画情報を引く」用途で残しています。非公開配信の再生には `signed-playback` を利用してください。

## 必要な環境変数（Secrets/Vars）

### API（Cloudflare Workers）側

**必須（本番/ステージング/ローカルdev共通）**

- `CLOUDFLARE_ACCOUNT_ID`
  - 例: `c6270d2ac0aefb2ca6ce6831cbc9ca30`
  - `apps/api/wrangler.toml` の `[vars]` に設定済み（非secret）

- `CLOUDFLARE_STREAM_API_TOKEN`（secret）
  - Stream 管理APIを叩くために必要（direct upload URL発行など）
  - **クライアントへ絶対に露出しない**

- `CLOUDFLARE_STREAM_SIGNING_KEY_ID`（secret扱い推奨）
- `CLOUDFLARE_STREAM_SIGNING_KEY_JWK`（secret）
  - Signed URL 用の **RSA秘密鍵（private JWK）**
  - Cloudflare の `POST /stream/keys` または Dashboard で作成した Signing Key の `jwk` を使用します

#### ローカル

`apps/api/.dev.vars.example` を `.dev.vars` にコピーして設定します（`.dev.vars` は gitignore）。

#### Cloudflare（デプロイ先）

Wrangler Secrets として登録します。

```bash
cd apps/api
npx wrangler secret put CLOUDFLARE_STREAM_API_TOKEN
npx wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_ID
npx wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_JWK
```

### Signing Key（kid / secret）の作成（1回だけ）

Cloudflare Stream の Signed URL 再生には、Signing Key（`kid` / `secret`）が必要です。

このリポジトリには **作成用スクリプト** を用意しています（管理APIトークンを使って Cloudflare の `POST /stream/keys` を呼びます）。

```bash
cd apps/api

# 例: 環境変数で渡す（値は自分の端末の環境変数/パスワード管理で扱ってください）
CLOUDFLARE_ACCOUNT_ID=... \
CLOUDFLARE_STREAM_API_TOKEN=... \
npm run stream:create-signing-key
```

出力された `keyId` / `keyJwk` を、以下の secret として登録してください。

- `CLOUDFLARE_STREAM_SIGNING_KEY_ID`
- `CLOUDFLARE_STREAM_SIGNING_KEY_JWK`

### Mobile（Expo）側

- `EXPO_PUBLIC_CLOUDFLARE_STREAM_SAMPLE_VIDEO_ID`
  - 例: `75f3ddaf69ff44c43746c9492c3c4df5`
  - これは **公開されても問題ない** videoId のみを置きます

※ トークンや署名鍵は `EXPO_PUBLIC_*` には入れません。

## 簡易動作確認（例）

### 署名付き再生URL取得

```bash
curl "$API_BASE_URL/v1/stream/signed-playback/75f3ddaf69ff44c43746c9492c3c4df5"
```

返った `hlsUrl` を `expo-av`（`Video`）で再生します。

### Direct Upload URL 発行

```bash
curl -X POST "$API_BASE_URL/v1/stream/direct-upload" \
  -H "Content-Type: application/json" \
  -d '{"requireSignedURLs":true,"metaName":"sample"}'
```

返った `uploadURL` に対してクライアントからアップロードし、返ってくる `uid` を videoId として保存します。

## セキュリティメモ

- `CLOUDFLARE_STREAM_API_TOKEN` と署名鍵は **API（Workers）側だけ**に置く
- クライアントへ返すのは「短い有効期限付きの署名済み再生URL」のみ
- 署名トークンの有効期限は短め推奨（実装は10分）

