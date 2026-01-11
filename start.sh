#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}🚀 Starting oshidora...${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}\n⏹️  Shutting down...${NC}"
    kill $API_PID $MOBILE_PID $ADMIN_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

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
npm --prefix "$PROJECT_ROOT/apps/api" run dev &
API_PID=$!

# Wait for API to be ready
echo -e "${YELLOW}⏳ Waiting for API server to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://127.0.0.1:8787/health | grep -q "ok"; then
        echo -e "${GREEN}✅ API server is ready!${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ API server failed to start${NC}"
        kill $API_PID 2>/dev/null
        exit 1
    fi
done

# Start Mobile (Web) server in background
echo -e "${YELLOW}🚀 Starting Mobile (Expo Web) server...${NC}"
npm --prefix "$PROJECT_ROOT/apps/mobile" run web &
MOBILE_PID=$!

# Start Admin (Web) server in background (use different port to avoid conflict)
ADMIN_WEB_PORT=${ADMIN_WEB_PORT:-8082}
echo -e "${YELLOW}🚀 Starting Admin (Expo Web) server on port $ADMIN_WEB_PORT...${NC}"
npm --prefix "$PROJECT_ROOT/apps/admin" run web -- --port "$ADMIN_WEB_PORT" &
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
echo -e "${GREEN}📡 API Server:${NC} http://127.0.0.1:8787"
echo -e "${GREEN}🌐 Mobile (Web):${NC} http://localhost:8081"
echo -e "${GREEN}🛠️  Admin (Web):${NC} http://localhost:$ADMIN_WEB_PORT"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep script running
wait
