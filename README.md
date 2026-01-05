# oshidora (推しドラ)

Cloudflare Workers (Hono) のAPIと、React Native(Expo) のフロントを同一リポジトリで管理する想定の雛形です。

## 構成

- `apps/api`: Cloudflare Workers + Hono + D1
- `apps/mobile`: Expo (React Native + Web)

## 事前準備

- Node.js / npm
- Cloudflareアカウント（本番デプロイ時）
- Wrangler: `npm --prefix apps/api i`

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
