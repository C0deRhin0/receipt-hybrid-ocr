#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PID_FILE="$ROOT_DIR/.server.pid"

PORT=${PORT:-5001}

get_lan_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
    return
  fi

  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
    return
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}'
    return
  fi
}

echo "=== Receipt Hybrid OCR Status ==="
echo ""

# Check server
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
else
  PID=""
fi

if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  START_TIME=$(ps -o lstart= -p "$PID" 2>/dev/null || true)
  if [ -n "$START_TIME" ]; then
    START_EPOCH=$(date -j -f "%a %b %e %T %Y" "$START_TIME" +%s 2>/dev/null || date -d "$START_TIME" +%s 2>/dev/null || echo "")
  else
    START_EPOCH=""
  fi

  NOW_EPOCH=$(date +%s)
  if [ -n "$START_EPOCH" ]; then
    UPTIME_SEC=$((NOW_EPOCH - START_EPOCH))
  else
    UPTIME_SEC=0
  fi

  HOURS=$((UPTIME_SEC / 3600))
  MINS=$(((UPTIME_SEC % 3600) / 60))
  SECS=$((UPTIME_SEC % 60))
  UPTIME_FMT=$(printf "%02dh:%02dm:%02ds" "$HOURS" "$MINS" "$SECS")

  LAN_IP=$(get_lan_ip || true)

  echo "Server:  [RUNNING] PID=$PID Uptime=$UPTIME_FMT"
  echo "Local:   https://localhost:$PORT"
  if [ -n "$LAN_IP" ]; then
    echo "Network: https://$LAN_IP:$PORT"
  fi
else
  echo "Server:  [STOPPED]"
fi

echo ""

# Check Ollama
if command -v curl >/dev/null 2>&1; then
  OLLAMA_STATUS=$(curl -s http://localhost:11434/api/tags 2>/dev/null || echo "")
  if [ -n "$OLLAMA_STATUS" ]; then
    echo "Ollama: [RUNNING]"
    
    # List models
    MODELS=$(echo "$OLLAMA_STATUS" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  for m in data.get('models', []):
    print(f'  - {m[\"name\"]}')
except:
  print('  (error reading models)')
" 2>/dev/null || echo "  (unable to list)")
    
    if [ -n "$MODELS" ]; then
      echo "Models:"
      echo "$MODELS"
    fi
  else
    echo "Ollama: [STOPPED]"
  fi
else
  echo "Ollama: [UNKNOWN] (curl not installed)"
fi

echo ""
echo "=== Quick Commands ==="
echo "Start:  npm run start"
echo "Stop:   npm run stop"
echo "Status: npm run status"