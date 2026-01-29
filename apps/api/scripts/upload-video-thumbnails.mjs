#!/usr/bin/env node

// DEPRECATED / DANGEROUS:
// This script used to write fake placeholder URLs (assets-uploader.*) into upload-result.json.
// It caused production seed data to point to non-existent or local-only assets.
// Use `upload-seed-images-uploader-open.mjs` (or the authenticated uploader) instead.

console.error('❌ This script is deprecated. Use upload-seed-images-uploader-open.mjs instead.')
process.exit(1)
