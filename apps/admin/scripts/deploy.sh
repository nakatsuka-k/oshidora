#!/bin/bash
# Deploy admin to oshidra-admin Pages project
# Ensures deployment to Kousuke@teqst.co.jp's account only

cd "$(dirname "$0")" || exit 1

echo "📦 Building admin app..."
npm run export:web || exit 1

echo ""
echo "🚀 Deploying to Cloudflare Pages..."
echo "   ⚠️  When prompted for account, select: Kousuke@teqst.co.jp's Account"
echo ""

npx wrangler pages deploy dist --project-name oshidora-admin
