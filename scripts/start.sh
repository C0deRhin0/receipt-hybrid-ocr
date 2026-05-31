#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PID_FILE="$ROOT_DIR/.server.pid"
LOG_FILE="$ROOT_DIR/server.log"
CERT_DIR="$ROOT_DIR/backend"
FRONTEND_DIST_DIR="$ROOT_DIR/frontend/dist"

load_env() {
  if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    . "$ROOT_DIR/.env"
    set +a
  fi

  if [ -f "$ROOT_DIR/.env.local" ]; then
    set -a
    . "$ROOT_DIR/.env.local"
    set +a
  fi
}

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

check_ollama() {
  if command -v curl >/dev/null 2>&1; then
    curl -s http://localhost:11434/api/tags >/dev/null 2>&1
    return $?
  fi
  return 1
}

check_and_renew_cert() {
  CURRENT_IP=$(get_lan_ip)
  
  if [ -z "$CURRENT_IP" ]; then
    echo "No LAN IP found, skipping cert check."
    return 0
  fi
  
  echo "Current IP: $CURRENT_IP"
  
  # Check if certificates exist and match current IP
  if [ -d "$CERT_DIR" ]; then
    CERT_FILES=$(ls "$CERT_DIR"/*.pem 2>/dev/null || true)
    
    if [ -n "$CERT_FILES" ]; then
      # Check if cert filename contains current IP
      for cert in $CERT_FILES; do
        case "$cert" in
          *"$CURRENT_IP"*)
            # Current IP matches cert - we're good
            echo "Certificate for $CURRENT_IP found."
            return 0
            ;;
        esac
      done
      
      # Cert exists but IP mismatch - need to regenerate
      echo "Certificate mismatch!"
      echo "  Current IP: $CURRENT_IP"
      echo "  Cert is for different IP"
      echo "Regenerating certificate..."
    fi
  else
    echo "No certificates found. Generating..."
  fi
  
  mkcert -cert-file "$CERT_DIR/$CURRENT_IP+1.pem" -key-file "$CERT_DIR/$CURRENT_IP+1-key.pem" "$CURRENT_IP" localhost 127.0.0.1 2>/dev/null || \
  mkcert "$CURRENT_IP" localhost 127.0.0.1
  
  if [ $? -eq 0 ]; then
    echo "Certificate generated successfully."
    
    # Move new certs to backend folder if not already there
    NEW_CERTS=$(ls "$ROOT_DIR"/*"$CURRENT_IP"*.pem 2>/dev/null || true)
    if [ -n "$NEW_CERTS" ]; then
      for cert in $NEW_CERTS; do
        cp "$cert" "$CERT_DIR/" 2>/dev/null || true
      done
      rm -f "$ROOT_DIR"/*"$CURRENT_IP"*.pem 2>/dev/null || true
    fi
  else
    echo "Warning: Failed to generate certificate. Using HTTP fallback."
  fi
  
  return 0
}

load_env

PORT=${PORT:-5001}

echo "=== Starting Receipt Hybrid OCR ==="

# Check if server already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Server already running (PID $PID)."
    exit 0
  fi
  rm -f "$PID_FILE"
fi

# Start Ollama if not running
echo "Checking Ollama..."
if ! check_ollama; then
  echo "Starting Ollama..."
  brew services start ollama 2>/dev/null || ollama serve &
  sleep 3
  
  TRIES=0
  while ! check_ollama && [ $TRIES -lt 10 ]; do
    sleep 1
    TRIES=$((TRIES + 1))
  done
  
  if check_ollama; then
    echo "Ollama started."
  else
    echo "Warning: Ollama may not be ready."
  fi
else
  echo "Ollama already running."
fi

# Check/renew certificate for current network
echo "Checking certificates..."
check_and_renew_cert

# Build frontend if needed
if [ ! -d "$FRONTEND_DIST_DIR" ]; then
  echo "Building frontend..."
  (cd "$ROOT_DIR" && npm run build)
fi

touch "$LOG_FILE"

# Start the server
cd "$ROOT_DIR"
node backend/index.js >> "$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"

LAN_IP=$(get_lan_ip || true)

echo ""
echo "=== Services Running ==="
echo "Server PID: $PID"
echo "Server Local: https://localhost:$PORT"
if [ -n "$LAN_IP" ]; then
  echo "Server Network: https://$LAN_IP:$PORT"
fi
echo "Ollama: http://localhost:11434"
echo ""
echo "Started successfully."
