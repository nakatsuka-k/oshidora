#!/bin/bash

# Complete Seed Data Integration Script
# 全ての画像生成、アップロード、DB 投入を実行

set -e

echo "=========================================="
echo "🚀 Seed データ 完全統合スクリプト"
echo "=========================================="
echo ""

# ディレクトリ確認
cd "$(dirname "$0")/../"
echo "📁 作業ディレクトリ: $(pwd)"
echo ""

# Step 1: OpenAI 画像生成（既存）
echo "📍 ステップ 1: 基本 Seed 画像生成"
if [ -f "apps/api/seed-images-generated/manifest.json" ]; then
  echo "   ✅ manifest.json が既に存在します"
else
  echo "   ⏳ OpenAI で画像生成中..."
  node apps/api/scripts/generate-seed-images-openai.mjs
fi
echo ""

# Step 2: 追加画像生成（動画サムネイル、背景）
echo "📍 ステップ 2: 追加画像生成（動画、背景、SNS URL）"
echo "   ⏳ 動画サムネイル（60枚）、キャスト背景（10枚）生成中..."
node apps/api/scripts/generate-additional-seed-images.mjs
echo ""

# Step 3: 画像アップロード
echo "📍 ステップ 3: Asset Uploader へアップロード"
echo "   ⏳ 画像をアップロード中..."
node apps/api/scripts/upload-seed-images-uploader.mjs
echo ""

# Step 4: SQL 生成
echo "📍 ステップ 4: SQL ファイル生成"
echo "   ⏳ Seed データセット生成中..."
node apps/api/scripts/seed-dataset.mjs > /tmp/oshidora-seed.sql
echo "   ✅ SQL ファイル: /tmp/oshidora-seed.sql"
echo "   📊 SQL 行数: $(wc -l < /tmp/oshidora-seed.sql)"
echo ""

# Step 5: ローカル D1 投入
echo "📍 ステップ 5: ローカル D1 に投入"
echo "   ⏳ wrangler d1 execute (local)..."
npx wrangler d1 execute oshidora-db --local --file /tmp/oshidora-seed.sql
echo "   ✅ ローカル D1 投入完了"
echo ""

# Step 6: 本番 D1 投入（確認付き）
read -p "📍 本番 D1 にも投入しますか？ (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   ⏳ wrangler d1 execute (remote)..."
  npx wrangler d1 execute oshidora-db --remote --file /tmp/oshidora-seed.sql
  echo "   ✅ 本番 D1 投入完了"
else
  echo "   ⏭️  本番投入をスキップしました"
fi
echo ""

# 検証
echo "📍 検証"
echo "   ⏳ ローカル D1 の記録数確認中..."
COUNT=$(npx wrangler d1 execute oshidora-db --local --command "SELECT COUNT(*) as total FROM (SELECT id FROM casts WHERE id LIKE 'seed_%' UNION ALL SELECT id FROM works WHERE id LIKE 'seed_%' UNION ALL SELECT id FROM videos WHERE id LIKE 'seed_%')" | grep -oE '[0-9]+' | tail -1)
echo "   ✅ Seed データ総数: $COUNT"
echo ""

echo "=========================================="
echo "✨ 完了！"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "  1. ローカルホストで確認: http://localhost:8081"
echo "     - ユーザー: seed-admin@oshidra.local / Passw0rd!"
echo ""
echo "  2. テストユーザーで確認: http://localhost:8000"
echo "     - ユーザー: seed-user-001@oshidra.local / Passw0rd!"
echo ""
echo "詳細は docs/ を参照してください"
echo ""
