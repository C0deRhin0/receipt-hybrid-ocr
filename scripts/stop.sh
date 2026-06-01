#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PID_FILE="$ROOT_DIR/.server.pid"

echo "=== Stopping Receipt Hybrid OCR ==="

# Stop the Node.js server
if [ ! -f "$PID_FILE" ]; then
  echo "Server not running (no PID file)."
else
  PID=$(cat "$PID_FILE")

  if [ -z "$PID" ] || ! kill -0 "$PID" 2>/dev/null; then
    echo "Server not running."
    rm -f "$PID_FILE"
  else
    echo "Stopping server (PID $PID)..."
    kill -TERM "$PID" 2>/dev/null || true

    WAITED=0
    while kill -0 "$PID" 2>/dev/null; do
      if [ "$WAITED" -ge 5 ]; then
        echo "Force killing server..."
        kill -KILL "$PID" 2>/dev/null || true
        break
      fi
      sleep 1
      WAITED=$((WAITED + 1))
    done

    rm -f "$PID_FILE"
    echo "Server stopped via PID file."
  fi
fi

# Ensure all dangling server processes are killed to prevent EADDRINUSE
echo "Checking for dangling Node.js server processes..."
pkill -f "node backend/index.js" 2>/dev/null || true

# Stop Ollama (optional - ask user)
echo ""
echo "Also stopping Ollama? (y/n)"
read -r response
if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
  echo "Stopping Ollama..."
  brew services stop ollama 2>/dev/null || pkill -f "ollama serve" 2>/dev/null || echo "Ollama may already be stopped."
  echo "Ollama stopped."
fi

echo ""
echo "All services stopped."
