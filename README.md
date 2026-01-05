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

### Mobile (Expo)

```bash
npm --prefix apps/mobile i
npm run dev:mobile
```

起動するとログイン（SMS 2段階認証）の画面フロー（AXCMS-L-001〜003）が表示されます。

APIのURLは `EXPO_PUBLIC_API_BASE_URL` で上書きできます。

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

Web版は `apps/mobile/dist/_worker.js` により、許可IP以外を 403 にします。

- 許可IPは `OSHIDORA_ALLOWED_IPS`（カンマ区切り）で上書きできます

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
