# Test User Accounts

**共通パスワード**: `Passw0rd!`

メール認証: ✅ 済み (email_verified = 1)
SMS認証: ⏭️ スキップ (sms_auth_skip = 1, phone_verified = 0)

## Admin管理画面用アカウント

| No. | ID | Email | Password | Role | ログイン状態 |
|-----|----|----|------|------|------|
| Admin | seed_admin_001 | seed-admin@oshidra.local | Passw0rd! | Admin | ✅ 確認済み |
| 1 | seed_user_001 | seed-user-001@oshidra.local | Passw0rd! | User | ✅ 利用可能 |
| 2 | seed_user_002 | seed-user-002@oshidra.local | Passw0rd! | User | ✅ 利用可能 |
| 3 | seed_user_003 | seed-user-003@oshidra.local | Passw0rd! | User | ✅ 利用可能 |

## モバイルアプリ用アカウント

| No. | ID | Email | Password | 状態 |
|-----|----|----|------|------|
| 4 | seed_user_004 | seed-user-004@oshidra.local | Passw0rd! | ✅ 確認済み |
| 5 | seed_user_005 | seed-user-005@oshidra.local | Passw0rd! | ✅ 確認済み |
| 6 | seed_user_006 | seed-user-006@oshidra.local | Passw0rd! | ✅ 確認済み |
| 7 | seed_user_007 | seed-user-007@oshidra.local | Passw0rd! | ✅ 確認済み |
| 8 | seed_user_008 | seed-user-008@oshidra.local | Passw0rd! | ✅ 確認済み |
| 9 | seed_user_009 | seed-user-009@oshidra.local | Passw0rd! | ✅ 確認済み |
| 10 | seed_user_010 | seed-user-010@oshidra.local | Passw0rd! | ✅ 確認済み |

## 動作確認結果

### 管理画面 (Admin)
- ✅ `seed-admin@oshidra.local` でログイン可能（JWT token取得確認）
- ✅ `/cms/auth/login` エンドポイント動作確認

### モバイルアプリ
- ✅ `seed-user-004@oshidra.local` でログイン可能（JWT token取得確認）
- ✅ `/v1/auth/login/start` エンドポイント動作確認
- ✅ `stage: "full"` （SMS認証スキップ有効）
- ✅ `phoneRequired: false` （電話認証不要）

## API テストコマンド

### Admin ログイン
```bash
curl -X POST https://api.oshidra.com/cms/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "seed-admin@oshidra.local",
    "password": "Passw0rd!"
  }' | jq '.'
```

**レスポンス例**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Mobile App ログイン
```bash
curl -X POST https://api.oshidra.com/v1/auth/login/start \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "seed-user-004@oshidra.local",
    "password": "Passw0rd!"
  }' | jq '.'
```

**レスポンス例**:
```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "stage": "full",
  "phoneMasked": null,
  "phoneRequired": false
}
```

## 本番環境への投入

```bash
# ローカルD1へ投入
cd apps/api
node ./scripts/seed-dataset.mjs --assetExt png --assetBaseUrl 'http://localhost:8082/seed-images' > /tmp/local-seed.sql
wrangler d1 execute oshidora-db --local --file /tmp/local-seed.sql

# 本番D1へ投入
node ./scripts/seed-dataset.mjs --assetExt png --assetBaseUrl 'https://pub-a2d549876dd24a08aebc65d95ed4ff91.r2.dev/seed-images' > /tmp/prod-seed.sql
npx wrangler d1 execute oshidora-db --remote --file /tmp/prod-seed.sql
```

## アカウント情報

- **全ユーザー数**: 30個（seed_user_001～seed_user_030）
- **メール認証**: ✅ 完了済み（`email_verified = 1`）
- **SMS認証**: ⏭️ スキップ（`sms_auth_skip = 1`）
- **パスワードハッシュ**: PBKDF2（SHA-256, 100,000回反復）

## 注意事項

- テストアカウントのパスワードは全て同じ: `Passw0rd!`
- Seed admin: `seed_admin_001` （Admin ロール用）
- Regular users: `seed_user_001` ～ `seed_user_030` （App用）

