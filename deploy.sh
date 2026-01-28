#!/bin/sh

set -eu

# Enable pipefail when supported (bash/zsh), ignore otherwise.
(set -o pipefail) 2>/dev/null && set -o pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  # shellcheck disable=SC2059
  printf "%b\n" "${YELLOW}▶${NC} $*"
}

ok() {
  # shellcheck disable=SC2059
  printf "%b\n" "${GREEN}✓${NC} $*"
}

die() {
  # shellcheck disable=SC2059
  printf "%b\n" "${RED}✗${NC} $*" 1>&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

need_cmd node
need_cmd npm

API_DIR="$PROJECT_ROOT/apps/api"
ADMIN_DIR="$PROJECT_ROOT/apps/admin"
WEB_DIR="$PROJECT_ROOT/apps/mobile"
UPLOADER_DIR="$PROJECT_ROOT/apps/uploader"

WRANGLER_BIN="$API_DIR/node_modules/.bin/wrangler"

# D1 migration target
D1_DB_NAME="${D1_DB_NAME:-oshidora-db}"

# Wrangler environment targeting
# When wrangler.toml defines multiple environments, wrangler recommends specifying --env explicitly.
# Default to production for safety in this repo; override with WRANGLER_ENV (set to empty to target top-level).
WRANGLER_ENV="${WRANGLER_ENV:-production}"

# Configurable switches
# Backward-compatible aliases:
# - SKIP_BUILD=1 => skips both admin/web builds unless overridden
# - SKIP_DEPLOY=1 => skips API deploy + both Pages deploys unless overridden
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_DEPLOY="${SKIP_DEPLOY:-0}"

SKIP_API_DEPLOY="${SKIP_API_DEPLOY:-$SKIP_DEPLOY}"
SKIP_UPLOADER_DEPLOY="${SKIP_UPLOADER_DEPLOY:-$SKIP_DEPLOY}"
SKIP_ADMIN_BUILD="${SKIP_ADMIN_BUILD:-$SKIP_BUILD}"
SKIP_ADMIN_DEPLOY="${SKIP_ADMIN_DEPLOY:-$SKIP_DEPLOY}"
SKIP_WEB_BUILD="${SKIP_WEB_BUILD:-$SKIP_BUILD}"
SKIP_WEB_DEPLOY="${SKIP_WEB_DEPLOY:-$SKIP_DEPLOY}"

# Cloudflare Pages deploy params
ADMIN_PAGES_PROJECT_NAME="${ADMIN_PAGES_PROJECT_NAME:-oshidora-admin}"
ADMIN_PAGES_BRANCH="${ADMIN_PAGES_BRANCH:-main}"
ADMIN_PAGES_COMMIT_MESSAGE="${ADMIN_PAGES_COMMIT_MESSAGE:-Deploy admin}"

WEB_PAGES_PROJECT_NAME="${WEB_PAGES_PROJECT_NAME:-oshidra-web}"
WEB_PAGES_BRANCH="${WEB_PAGES_BRANCH:-main}"
WEB_PAGES_COMMIT_MESSAGE="${WEB_PAGES_COMMIT_MESSAGE:-Deploy web}"

install_if_missing() {
  dir="$1"
  label="$2"

  if [ ! -d "$dir/node_modules" ]; then
    log "Installing ${label} dependencies..."
    npm --prefix "$dir" install
    ok "Installed ${label} dependencies"
  else
    ok "${label} dependencies already installed"
  fi
}

log "Preparing deploy (migrations + api + uploader + web + admin)"
log "deploy.sh version: 2026-01-28"

if [ -x "$WRANGLER_BIN" ]; then
  # Avoid failing the whole script if wrangler prints a warning.
  wrangler_ver="$("$WRANGLER_BIN" --version 2>/dev/null | head -n 1 || true)"
  if [ -n "$wrangler_ver" ]; then
    log "wrangler: $wrangler_ver"
  fi
fi

install_if_missing "$API_DIR" "API"
install_if_missing "$UPLOADER_DIR" "Uploader"
install_if_missing "$ADMIN_DIR" "Admin"
install_if_missing "$WEB_DIR" "Web"

if [ "$SKIP_MIGRATIONS" != "1" ]; then
  if [ ! -x "$WRANGLER_BIN" ]; then
    die "wrangler not found at $WRANGLER_BIN (try reinstalling in apps/api)"
  fi

  log "Running D1 migrations (remote, non-interactive)..."
  # Wrangler skips the confirmation prompt in CI mode.
  # Run from apps/api so wrangler picks up the correct migrations directory.
  if [ -n "$WRANGLER_ENV" ]; then
    log "cmd: (cd apps/api && CI=1 wrangler d1 migrations apply $D1_DB_NAME --remote --env $WRANGLER_ENV)"
    (cd "$API_DIR" && CI=1 "$WRANGLER_BIN" d1 migrations apply "$D1_DB_NAME" --remote --env "$WRANGLER_ENV")
  else
    log "cmd: (cd apps/api && CI=1 wrangler d1 migrations apply $D1_DB_NAME --remote --env=\"\")"
    (cd "$API_DIR" && CI=1 "$WRANGLER_BIN" d1 migrations apply "$D1_DB_NAME" --remote --env="")
  fi
  ok "Migrations applied"
else
  log "Skipping migrations (SKIP_MIGRATIONS=1)"
fi

if [ "$SKIP_API_DEPLOY" != "1" ]; then
  if [ ! -x "$WRANGLER_BIN" ]; then
    die "wrangler not found at $WRANGLER_BIN (try reinstalling in apps/api)"
  fi

  log "Deploying API (Cloudflare Workers)..."
  if [ -n "$WRANGLER_ENV" ]; then
    npm --prefix "$API_DIR" run deploy -- --env "$WRANGLER_ENV"
  else
    npm --prefix "$API_DIR" run deploy -- --env ""
  fi
  ok "API deployed"
else
  log "Skipping API deploy (SKIP_API_DEPLOY=1)"
fi

if [ "$SKIP_UPLOADER_DEPLOY" != "1" ]; then
  log "Deploying Uploader (Cloudflare Workers)..."
  npm --prefix "$UPLOADER_DIR" run deploy
  ok "Uploader deployed"
else
  log "Skipping Uploader deploy (SKIP_UPLOADER_DEPLOY=1)"
fi

if [ "$SKIP_WEB_BUILD" != "1" ]; then
  log "Building web app (apps/mobile: expo export:web)..."
  npm --prefix "$WEB_DIR" run export:web
  ok "Web build complete"
else
  log "Skipping web build (SKIP_WEB_BUILD=1)"
fi

if [ "$SKIP_WEB_DEPLOY" != "1" ]; then
  if [ ! -x "$WRANGLER_BIN" ]; then
    die "wrangler not found at $WRANGLER_BIN (try reinstalling in apps/api)"
  fi

  log "Deploying web app to Cloudflare Pages..."
  log "  project: $WEB_PAGES_PROJECT_NAME"
  log "  branch:  $WEB_PAGES_BRANCH"

  "$WRANGLER_BIN" pages deploy "$WEB_DIR/dist" \
    --project-name "$WEB_PAGES_PROJECT_NAME" \
    --branch "$WEB_PAGES_BRANCH" \
    --commit-dirty=true \
    --commit-message "$WEB_PAGES_COMMIT_MESSAGE"

  ok "Web deployed"
else
  log "Skipping web deploy (SKIP_WEB_DEPLOY=1)"
fi

if [ "$SKIP_ADMIN_BUILD" != "1" ]; then
  log "Building admin (apps/admin: expo export:web)..."
  npm --prefix "$ADMIN_DIR" run export:web
  ok "Admin build complete"
else
  log "Skipping admin build (SKIP_ADMIN_BUILD=1)"
fi

if [ "$SKIP_ADMIN_DEPLOY" != "1" ]; then
  if [ ! -x "$WRANGLER_BIN" ]; then
    die "wrangler not found at $WRANGLER_BIN (try reinstalling in apps/api)"
  fi

  log "Deploying admin to Cloudflare Pages..."
  log "  project: $ADMIN_PAGES_PROJECT_NAME"
  log "  branch:  $ADMIN_PAGES_BRANCH"

  "$WRANGLER_BIN" pages deploy "$ADMIN_DIR/dist" \
    --project-name "$ADMIN_PAGES_PROJECT_NAME" \
    --branch "$ADMIN_PAGES_BRANCH" \
    --commit-dirty=true \
    --commit-message "$ADMIN_PAGES_COMMIT_MESSAGE"

  ok "Admin deployed"
else
  log "Skipping admin deploy (SKIP_ADMIN_DEPLOY=1)"
fi

ok "Done"
