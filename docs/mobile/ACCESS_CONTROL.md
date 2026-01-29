# Mobile: Access Control (Anonymous vs Login)

更新日: 2026-01-30

このアプリは `apps/mobile/App.tsx` の `screen` 状態で画面遷移を管理しています。
画面レベルのアクセス制御は `apps/mobile/utils/screenAccess.ts` に集約し、
**匿名で login-required 画面に遷移（アプリ内リンク/URL直アクセス）した場合はログイン画面へリダイレクト**します。

## Cast detail（キャスト詳細）

- 画面: `profile`
- URL: `/profile` および `/profile/:castId?title=...`
- 匿名閲覧: **可能**
- 注意: 画面内の一部アクション（コメント投稿/コイン付与/お気に入り等）は別途ログインやサブスクが必要です。

## 作品詳細（WorkDetail）

- 画面: `workDetail`
- URL: `/work?workId=...`
- 匿名閲覧: **可能**
- 注意: コメント投稿（コメント画面/インライン投稿）は **ログイン必須**

## 匿名閲覧できない（ログイン必須）

一覧は `LOGIN_REQUIRED_SCREENS` を参照してください。
代表的なURL（Web）は `apps/mobile/utils/webRoutes.ts` の `screenToWebPath` で定義されています。

- 認証（ログイン後フロー）: `/email-verify`, `/email-change`, `/email-change/verify`, `/phone-change`, `/sms-2fa`
- 視聴・課金（サブスク）: `/subscription`, `/play`
- コイン/決済: `/coin-purchase`, `/coin-grant`, `/coin-grant-complete`, `/coin-exchange`, `/coin-exchange/paypay`, `/coin-exchange/complete`
- マイページ配下: `/mypage`, `/profile-edit`, `/cast-profile-register`, `/favorites` ...
- キャスト検索系（既存仕様）: `/cast`, `/cast-ranking`, `/cast-result`

