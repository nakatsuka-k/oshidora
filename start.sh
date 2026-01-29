#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}🚀 Starting oshidora...${NC}"

usage() {
    cat <<'EOF'
Usage:
  sh start.sh                 # start local API + web apps
  sh start.sh --prod-api      # start web apps against production API (skip local API/D1 viewer)

Options:
  --prod-api    Use https://api.oshidra.com as API base for Admin/Mobile.
  -h, --help    Show this help.
EOF
}

# Mode flags
USE_PROD_API=0

for arg in "$@"; do
    case "$arg" in
        --prod-api)
            USE_PROD_API=1
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: ${arg}${NC}"
            usage
            exit 1
            ;;
    esac
done

# PIDs (initialized for safe cleanup under `set -u`)
API_PID=""
MOBILE_PID=""
ADMIN_PID=""
D1VIEWER_PID=""
SEED_IMAGES_PID=""
API_PORT=""

START_LOCAL_API=1
START_D1VIEWER=1

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}\n⏹️  Shutting down...${NC}"
    if [ -n "$SEED_IMAGES_PID" ]; then kill "$SEED_IMAGES_PID" 2>/dev/null || true; fi
    if [ -n "$API_PID" ]; then kill "$API_PID" 2>/dev/null || true; fi
    if [ -n "$MOBILE_PID" ]; then kill "$MOBILE_PID" 2>/dev/null || true; fi
    if [ -n "$ADMIN_PID" ]; then kill "$ADMIN_PID" 2>/dev/null || true; fi
    if [ -n "$D1VIEWER_PID" ]; then kill "$D1VIEWER_PID" 2>/dev/null || true; fi

    # Ensure the actual dev server process is terminated (wrangler spawns workerd).
    if [ -n "$API_PORT" ]; then
        local listener_pids
        listener_pids="$(lsof -t -nP -iTCP:"$API_PORT" -sTCP:LISTEN 2>/dev/null || true)"
        if [ -n "$listener_pids" ]; then
            echo -e "${YELLOW}🔌 Killing listeners on port ${API_PORT}: ${listener_pids}${NC}"
            kill $listener_pids 2>/dev/null || true
        fi
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

is_port_listening() {
    local port="$1"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

pick_free_port() {
    local start_port="$1"
    local max_tries="${2:-20}"
    local port="$start_port"
    for _ in $(seq 1 "$max_tries"); do
        if ! is_port_listening "$port"; then
            echo "$port"
            return 0
        fi
        port=$((port + 1))
    done
    return 1
}

# Install dependencies if node_modules doesn't exist
if [ ! -d "$PROJECT_ROOT/apps/api/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing API dependencies...${NC}"
    npm --prefix "$PROJECT_ROOT/apps/api" install
fi

if [ ! -d "$PROJECT_ROOT/apps/mobile/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Mobile dependencies...${NC}"
    npm --prefix "$PROJECT_ROOT/apps/mobile" install
fi

if [ ! -d "$PROJECT_ROOT/apps/admin/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Admin dependencies...${NC}"
    npm --prefix "$PROJECT_ROOT/apps/admin" install
fi

if [ ! -d "$PROJECT_ROOT/apps/d1viewer/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing D1 Viewer dependencies...${NC}"
    npm --prefix "$PROJECT_ROOT/apps/d1viewer" install
fi

API_BASE_URL=""

if [ "$USE_PROD_API" = "1" ]; then
    START_LOCAL_API=0
    START_D1VIEWER=0
    API_BASE_URL="https://api.oshidra.com"
    echo -e "${YELLOW}🌐 Production API mode enabled${NC}"
    echo -e "${YELLOW}📡 Admin/Mobile will use ${API_BASE_URL}${NC}"
    echo "$API_BASE_URL" > "$LOG_DIR/api.url"
    echo "" > "$LOG_DIR/api.port"
else
    # Run database migration for local environment
    echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
    npm --prefix "$PROJECT_ROOT" run db:migrate:local

    # Start seed-images server (for local development)
    echo -e "${YELLOW}🚀 Starting seed-images server on port 8084...${NC}"
    SEED_IMAGES_LOG="$LOG_DIR/seed-images.log"
    echo "--- $(date) Starting seed-images server (port=8084) ---" >> "$SEED_IMAGES_LOG"

    # Check if seed-images directory exists
    if [ ! -d "$PROJECT_ROOT/apps/api/seed-images-generated" ]; then
        mkdir -p "$PROJECT_ROOT/apps/api/seed-images-generated"
    fi

    cd "$PROJECT_ROOT/apps/api/seed-images-generated"
    python3 -m http.server 8084 >> "$SEED_IMAGES_LOG" 2>&1 &
    SEED_IMAGES_PID=$!
    cd "$PROJECT_ROOT"

    # Wait for seed-images server to be ready
    echo -e "${YELLOW}⏳ Waiting for seed-images server to be ready...${NC}"
    for i in {1..10}; do
        if curl -s "http://localhost:8084" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Seed-images server is ready!${NC}"
            break
        fi
        sleep 1
    done

    # Start API server in background
    echo -e "${YELLOW}🚀 Starting API server...${NC}"

    API_PORT="${API_PORT:-8787}"
    API_PORT="$(pick_free_port "$API_PORT" 20)" || {
        echo -e "${RED}❌ Could not find a free port for API starting from 8787${NC}"
        exit 1
    }

    API_BASE_URL="http://127.0.0.1:${API_PORT}"
    echo -e "${YELLOW}📡 API will run on ${API_BASE_URL}${NC}"

    echo "$API_BASE_URL" > "$LOG_DIR/api.url"
    echo "$API_PORT" > "$LOG_DIR/api.port"

    API_LOG="$LOG_DIR/api.log"
    echo "--- $(date) Starting API (port=${API_PORT}) ---" >> "$API_LOG"

    # Force port to avoid wrangler choosing a different port when 8787 is in use.
    ALLOW_DEBUG_RETURN_CODES=1 npm --prefix "$PROJECT_ROOT/apps/api" run dev -- --port "$API_PORT" >> "$API_LOG" 2>&1 &
    API_PID=$!

    # Wait for API to be ready
    echo -e "${YELLOW}⏳ Waiting for API server to be ready...${NC}"
    for i in {1..30}; do
        if curl -s "${API_BASE_URL}/health" | grep -q "ok"; then
            echo -e "${GREEN}✅ API server is ready!${NC}"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ API server failed to start${NC}"
            echo -e "${YELLOW}ℹ️  Last API logs:${NC}"
            tail -n 80 "$API_LOG" || true
            kill $API_PID 2>/dev/null
            exit 1
        fi
    done
fi

# Start Mobile (Web) server in background
echo -e "${YELLOW}🚀 Starting Mobile (Expo Web) server...${NC}"
MOBILE_LOG="$LOG_DIR/mobile.log"
echo "--- $(date) Starting Mobile (EXPO_PUBLIC_API_BASE_URL=${API_BASE_URL}) ---" >> "$MOBILE_LOG"
EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL" npm --prefix "$PROJECT_ROOT/apps/mobile" run web >> "$MOBILE_LOG" 2>&1 &
MOBILE_PID=$!

# Start Admin (Web) server in background (use different port to avoid conflict)
ADMIN_WEB_PORT=${ADMIN_WEB_PORT:-8082}
echo -e "${YELLOW}🚀 Starting Admin (Expo Web) server on port $ADMIN_WEB_PORT...${NC}"
ADMIN_LOG="$LOG_DIR/admin.log"
echo "--- $(date) Starting Admin (port=${ADMIN_WEB_PORT}, EXPO_PUBLIC_API_BASE_URL=${API_BASE_URL}) ---" >> "$ADMIN_LOG"
EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL" npm --prefix "$PROJECT_ROOT/apps/admin" run web -- --port "$ADMIN_WEB_PORT" >> "$ADMIN_LOG" 2>&1 &
ADMIN_PID=$!

if [ "$START_D1VIEWER" = "1" ]; then
    # Start D1 Viewer (Web) server in background
    D1VIEWER_WEB_PORT=${D1VIEWER_WEB_PORT:-8083}
    echo -e "${YELLOW}🚀 Starting D1 Viewer (Web) server on port $D1VIEWER_WEB_PORT...${NC}"
    D1VIEWER_LOG="$LOG_DIR/d1viewer.log"
    echo "--- $(date) Starting D1 Viewer (port=${D1VIEWER_WEB_PORT}, VITE_API_BASE_URL=${API_BASE_URL}) ---" >> "$D1VIEWER_LOG"
    VITE_API_BASE_URL="$API_BASE_URL" npm --prefix "$PROJECT_ROOT/apps/d1viewer" run dev -- --port "$D1VIEWER_WEB_PORT" >> "$D1VIEWER_LOG" 2>&1 &
    D1VIEWER_PID=$!
else
    D1VIEWER_WEB_PORT=""
fi

# Wait for mobile server to be ready
echo -e "${YELLOW}⏳ Waiting for Mobile server to be ready...${NC}"
sleep 8

# Wait for admin server to be ready
echo -e "${YELLOW}⏳ Waiting for Admin server to be ready...${NC}"
for i in {1..30}; do
    if curl -s "http://localhost:$ADMIN_WEB_PORT" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Admin server is ready!${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Admin server failed to start${NC}"
        kill $ADMIN_PID 2>/dev/null
        kill $API_PID $MOBILE_PID 2>/dev/null
        kill $D1VIEWER_PID 2>/dev/null
        exit 1
    fi
done

if [ "$START_D1VIEWER" = "1" ]; then
    # Wait for D1 viewer server to be ready
    echo -e "${YELLOW}⏳ Waiting for D1 Viewer server to be ready...${NC}"
    for i in {1..30}; do
        if curl -s "http://localhost:$D1VIEWER_WEB_PORT" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ D1 Viewer server is ready!${NC}"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ D1 Viewer server failed to start${NC}"
            kill $D1VIEWER_PID 2>/dev/null
            kill $ADMIN_PID 2>/dev/null
            kill $API_PID $MOBILE_PID 2>/dev/null
            exit 1
        fi
    done
fi

# URLs
BROWSER_URL="http://localhost:8081"
ADMIN_URL="http://localhost:$ADMIN_WEB_PORT"
D1VIEWER_URL=""
if [ "$START_D1VIEWER" = "1" ]; then
    D1VIEWER_URL="http://localhost:$D1VIEWER_WEB_PORT"
fi

# Display status
echo ""
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo -e "${GREEN}📡 API Server:${NC} ${API_BASE_URL}"
echo -e "${GREEN}🌐 Sites:${NC}"
echo -e "  - Mobile (Web): ${BROWSER_URL}"
echo -e "  - Admin (Web): ${ADMIN_URL}"
if [ "$START_D1VIEWER" = "1" ]; then
    echo -e "  - D1 Viewer (Web): ${D1VIEWER_URL}"
else
    echo -e "  - D1 Viewer (Web): (skipped)"
fi
if [ "$START_LOCAL_API" = "1" ]; then
    echo -e "  - Seed Images (Web): http://localhost:8084"
fi
echo -e "${GREEN}📝 Logs:${NC} $LOG_DIR (api.log / mobile.log / admin.log / d1viewer.log / seed-images.log)"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep script running
wait
