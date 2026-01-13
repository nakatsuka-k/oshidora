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

# PIDs (initialized for safe cleanup under `set -u`)
API_PID=""
MOBILE_PID=""
ADMIN_PID=""
API_PORT=""

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}\n⏹️  Shutting down...${NC}"
    if [ -n "$API_PID" ]; then kill "$API_PID" 2>/dev/null || true; fi
    if [ -n "$MOBILE_PID" ]; then kill "$MOBILE_PID" 2>/dev/null || true; fi
    if [ -n "$ADMIN_PID" ]; then kill "$ADMIN_PID" 2>/dev/null || true; fi

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

# Run database migration for local environment
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
npm --prefix "$PROJECT_ROOT" run db:migrate:local

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
npm --prefix "$PROJECT_ROOT/apps/api" run dev -- --port "$API_PORT" >> "$API_LOG" 2>&1 &
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
        exit 1
    fi
done

# Open browser
BROWSER_URL="http://localhost:8081"
ADMIN_URL="http://localhost:$ADMIN_WEB_PORT"
echo -e "${GREEN}🌐 Opening browser at $BROWSER_URL${NC}"
open "$BROWSER_URL"
echo -e "${GREEN}🌐 Opening admin at $ADMIN_URL${NC}"
open "$ADMIN_URL"

# Display status
echo ""
echo -e "${GREEN}✅ All services are running!${NC}"
echo ""
echo -e "${GREEN}📡 API Server:${NC} ${API_BASE_URL}"
echo -e "${GREEN}🌐 Mobile (Web):${NC} http://localhost:8081"
echo -e "${GREEN}🛠️  Admin (Web):${NC} http://localhost:$ADMIN_WEB_PORT"
echo -e "${GREEN}📝 Logs:${NC} $LOG_DIR (api.log / mobile.log / admin.log)"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep script running
wait
