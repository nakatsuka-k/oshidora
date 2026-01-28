# oshidora (推しドラ)

Cloudflare Workers (Hono) のAPIと、React Native(Expo) のフロントを同一リポジトリで管理する想定の雛形です。

## 構成

- `apps/api`: Cloudflare Workers + Hono + D1
- `apps/mobile`: Expo (React Native + Web)

## 事前準備

- Node.js / npm
- Cloudflareアカウント（本番デプロイ時）
- Wrangler: `npm --prefix apps/api i`

Cloudflareへログイン（初回のみ。ブラウザが開きます）:

```bash
cd apps/api
npx wrangler login
```

## ローカル起動

### API

```bash
npm --prefix apps/api i
npm run db:migrate:local
npm run dev:api
```

`http://127.0.0.1:8787/health` が `ok` を返せば起動しています。

#### Cloudflare Stream（サンプル再生）

API は Cloudflare Stream の管理APIを叩くため、以下の環境変数が必要です（トークン/署名鍵は **必ずサーバ側のみに保持**）。

- `CLOUDFLARE_ACCOUNT_ID`（非secret。`apps/api/wrangler.toml` に設定済み）
- `CLOUDFLARE_STREAM_API_TOKEN`（secret）
- `CLOUDFLARE_STREAM_SIGNING_KEY_ID`（secret扱い推奨）
- `CLOUDFLARE_STREAM_SIGNING_KEY_JWK`（secret。Cloudflareが返すRSA秘密鍵JWK）

ローカル開発では [apps/api/.dev.vars.example](apps/api/.dev.vars.example) を `.dev.vars` にコピーして、トークンを埋めてください（`.dev.vars` はgitignoreされています）。

Cloudflare にデプロイする場合は:

```bash
cd apps/api
npx wrangler secret put CLOUDFLARE_STREAM_API_TOKEN
npx wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_ID
npx wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_JWK
```

#### R2（プロフィール画像アップロード）

Web（localhost:8081）から R2 の S3 API へ直接 `PUT` すると CORS の preflight(OPTIONS) でブロックされるため、
本リポジトリでは **API 経由で R2 へアップロード**します。

- アップロードAPI: `PUT /v1/r2/assets/:key`
- 成功時レスポンス: `{ publicUrl: "https://<your-public>.r2.dev/<key>" }`

必要な設定:

- `apps/api/wrangler.toml`（非secret）
	- `R2_BUCKET`（例: `assets`）
	- `R2_PUBLIC_BASE_URL`（例: `https://<pub-...>.r2.dev`）
- Workers secrets（secret）
	- `R2_ACCESS_KEY_ID`
	- `R2_SECRET_ACCESS_KEY`

設定コマンド（値は貼り付けず、対話入力してください。ログに残るのを防ぐため）:

```bash
cd apps/api
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

ローカル開発では `.dev.vars.example` を `.dev.vars` にコピーして使えます（`.dev.vars` は gitignore 済み）。

#### Stripe（サブスク）

サブスク加入/解約は Stripe Checkout / Customer Portal を使います。

- Checkout開始: `POST /api/stripe/checkout/subscription`（要Bearer認証）
- 管理/解約: `POST /api/stripe/portal`（要Bearer認証）
- Webhook: `POST /api/stripe/webhook`（Stripeからの署名必須）
- 状態取得: `GET /v1/me`（`isSubscribed` を返す）

必要な設定（ローカルは `apps/api/.dev.vars.example` を参照）:

- Secrets
	- `STRIPE_SECRET_KEY`
	- `STRIPE_WEBHOOK_SECRET`
- Non-secrets
	- `STRIPE_SUBSCRIPTION_PRICE_ID`
	- `STRIPE_CHECKOUT_SUCCESS_URL`
	- `STRIPE_CHECKOUT_CANCEL_URL`
	- `STRIPE_PORTAL_RETURN_URL`

### Mobile (Expo)

```bash
npm --prefix apps/mobile i
npm run dev:mobile
```

起動するとログイン（SMS 2段階認証）の画面フロー（AXCMS-L-001〜003）が表示されます。

APIのURLは `EXPO_PUBLIC_API_BASE_URL` で上書きできます。

Cloudflare Stream の再生/サムネは API から取得した実データに基づき表示します。

作品詳細画面の再生は API の `GET /v1/stream/signed-playback/:videoId` が返す署名付き HLS を使います（非公開配信 / Signed URL）。

- Web: デフォルト `http://localhost:8787`
- Androidエミュレータ: デフォルト `http://10.0.2.2:8787`
- iOSシミュレータ: デフォルト `http://127.0.0.1:8787`
- 実機: PCのLAN IPにするのが一般的（例: `http://192.168.x.x:8787`）

例:

```bash
cd apps/mobile
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787 npm start
```

※ `apps/mobile` はこの後 `create-expo-app` で生成します。

## D1 (テーブル作成)

ローカル:

```bash
npm run db:migrate:local
```

※ Cloudflareアカウント未作成の間は、ローカルD1のみでOKです（`database_id` はダミー値のままでも動きます）。

本番(Cloudflare上):

```bash
# 初回だけDB作成
cd apps/api
npx wrangler d1 create oshidora-db

# wrangler.toml の database_id を作成結果で埋める

# マイグレーション適用
npx wrangler d1 migrations apply oshidora-db --remote
```

## デプロイ (API)

```bash
npm run deploy:api
```

## デプロイ (Web / Expo)

Web版は Cloudflare Pages に静的サイトとしてデプロイできます（アプリ版は別）。

### 1) ビルド（ローカル確認）

```bash
# リポジトリルートでOK
npm ci
npm run build:web
```

出力は `apps/mobile/dist`（Expoのexport出力）です。

### 2) Cloudflare Pages（GitHub連携）

Cloudflare Dashboard → Pages → Create a project → GitHub リポジトリを選択。

- **Build command**: `npm ci && npm run build:web`
- **Build output directory**: `apps/mobile/dist`

APIのURLを本番に向ける場合は、Pagesの Environment variables に `EXPO_PUBLIC_API_BASE_URL` を設定してください。

例:

`EXPO_PUBLIC_API_BASE_URL=https://<your-worker-subdomain>.workers.dev`

### 3) GitHub Actions（Pagesへ自動デプロイ）

このリポジトリには push(main) で Pages へデプロイするワークフローを用意しています。

- ワークフロー: `.github/workflows/deploy-pages.yml`
- 必要な GitHub Secrets:
	- `CLOUDFLARE_API_TOKEN`
	- `CLOUDFLARE_ACCOUNT_ID`

Web版は `apps/mobile/dist/_worker.js` を使って Cloudflare Pages へデプロイします。

## 管理画面 (admin.oshidra.com)

管理画面（CMS）は Expo（React Native Web）で実装し、`expo export` の静的出力を [apps/admin/dist](apps/admin/dist) に生成します。

### Cloudflare Pages（別プロジェクト推奨）

- Pages project name: `oshidora-admin`（例）
- Build command: `npm ci && npm run build:admin`
- Build output directory: `apps/admin/dist`

DNS:

- `admin.oshidra.com` → Cloudflare Pages のカスタムドメインとして `oshidora-admin` に割り当て

ローカルでファイル確認だけする場合は、静的ホスティング（任意）でOKです。

CLIデプロイ例（wrangler利用）:

```bash
npm ci
npm run build:admin
npm run deploy:admin
```

## D1 (本番DB作成・適用)

本番D1を作成して `apps/api/wrangler.toml` の `database_id` を埋めます。

```bash
cd apps/api
npx wrangler d1 create oshidora-db
```

作成結果の `database_id` を [apps/api/wrangler.toml](apps/api/wrangler.toml) に反映後:

```bash
npm run db:migrate:remote
```
