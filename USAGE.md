# Usage Guide

## 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/NuecAI/receipt-hybrid-ocr.git
cd receipt-hybrid-ocr
npm install
```

Copy the environment example:

```bash
cp .env.example .env.local
```

## 2. Quick Start

```bash
# Start the server (manages Ollama automatically)
npm run start
```

The server runs on **HTTPS by default** (for camera access on external devices).

- **Local:** https://localhost:5001
- **Network:** https://192.168.x.x:5001

> **Note:** Port 5001 is used because port 5000 may be occupied by other services.

## 3. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOST` | No | 0.0.0.0 | Server bind address |
| `PORT` | No | 5001 | Server port (5000 may be occupied) |
| `ANTHROPIC_API_KEY` | Optional | - | Claude Vision API key (cloud mode) |
| `ANTHROPIC_API_BASE_URL` | Optional | anthropic.com | Custom API endpoint (for company APIs) |
| `OLLAMA_BASE_URL` | No | http://localhost:11434 | Ollama server URL |
| `GOOGLE_SHEETS_CREDENTIALS` | Optional | - | Service account JSON |
| `GOOGLE_SHEET_ID` | Optional | - | Target spreadsheet ID |

### Company API Support

To use your company's Anthropic-compatible API:

```bash
echo "ANTHROPIC_API_KEY=your-key" > .env.local
echo "ANTHROPIC_API_BASE_URL=https://api.company.com/v1" >> .env.local
npm run start
```

## 4. Server Management Scripts

```bash
npm run start   # Start server with Ollama management
npm run stop    # Stop server
npm run status  # Check server and Ollama status
```

Example output:
```
Receipt Hybrid OCR — NuecAI
──────────────────────────────────
Local:    https://localhost:5001
Network:  https://192.168.1.37:5001
──────────────────────────────────
Cloud Mode:   ⚠️ Add API key to .env.local
Secure Mode: Ollama @ http://localhost:11434
```

## 5. Secure Mode (Default - Local OCR)

The app defaults to **Secure Mode** using local Ollama for privacy. No internet required after model is downloaded.

### Install Ollama:

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### Install Vision Model:

```bash
# Recommended: Lightweight model for OCR (~1.7GB)
ollama pull moondream

# Alternative: larger but more capable
ollama pull llava
```

### Start Ollama (if not auto-started):

```bash
ollama serve
```

**Note:** The app automatically detects and uses your vision model. Processing takes ~10-15 seconds on first run (model loading), then ~3-5 seconds subsequent runs.

### Fallback Behavior

If Secure Mode fails and you have an API key configured, the system automatically falls back to Cloud Mode. Conversely, if Cloud Mode fails, it attempts Secure Mode as backup.

## 6. Cloud Mode (Optional)

For faster processing (~3-5 seconds), add your Anthropic API key:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run start
```

The mode toggle in the UI lets you switch between Cloud and Secure modes. Your preference is saved in localStorage.

## 7. Camera on External Devices

The server runs on **HTTPS** automatically when certificates exist. This enables camera access on phones/tablets.

### Setup (One-time):

```bash
# Install mkcert
brew install mkcert

# Setup local CA (requires admin)
sudo mkcert -install

# Generate certificates for localhost and LAN IP
mkcert $(hostname) localhost 127.0.0.1 192.168.1.37
```

Move the generated `.pem` files to `server/` directory.

Certificates are auto-detected and HTTPS is enabled automatically.

### On Your Phone:

1. Navigate to `https://[YOUR-LAN-IP]:5001`
2. Accept the certificate warning (one-time, per device)
3. Camera will now work

## 8. Google Sheets Export

1. Create Google Cloud project → Enable Sheets API
2. Create Service Account → Download JSON credentials
3. Share spreadsheet with service account email
4. Set in `.env.local`:
```
GOOGLE_SHEETS_CREDENTIALS={"...": "..."}
GOOGLE_SHEET_ID=your-sheet-id
```

## 9. Using the App

### Demo Flow

1. Open app at `https://localhost:5001` (or network URL)
2. **Toggle Mode:** Click the lock icon (Secure/Local) or cloud icon (Cloud)
3. **Capture:** Use camera button or upload receipt image
4. **Wait:** Processing indicator shows (~10-15 sec for local, ~3-5 sec for cloud)
5. **View:** Parsed data appears in table format
6. **Export:** Download CSV or push to Google Sheets

### Mode Indicator

- 🔒 **Secure Mode** (lock icon): Local Ollama processing
- ☁️ **Cloud Mode** (cloud icon): Claude Vision API processing

Your mode preference is saved between sessions.

## 10. Troubleshooting

### "Camera not working on phone"
- Ensure you're using HTTPS (not HTTP)
- Accept the certificate warning in your browser
- Check that your phone is on the same network

### "Secure Mode timeout"
- Ensure Ollama is running: `ollama serve`
- Check model is installed: `ollama list`
- Try: `ollama pull moondream`

### "Cloud Mode not working"
- Verify API key in `.env.local`
- Check key starts with `sk-ant-`
- Restart server after changing `.env.local`

### "Port 5001 already in use"
- Check what's using it: `lsof -i :5001`
- Change port in `.env.local`: `PORT=5002`

### "Extraction shows empty or wrong data"
- **Secure Mode (Local)**: Moondream is a lightweight model (~1GB). Complex receipts may not parse correctly.
  - Try using clearer receipt images
  - Switch to Cloud Mode for better accuracy
- **Cloud Mode**: Ensure your API key is valid and has sufficient credits

### "Fallback to raw text displayed"
When the AI cannot extract structured data, the UI will show:
- A "Could not parse structured data" message
- Raw extracted text (if available)

This typically happens with:
- Very complex receipt layouts
- Poor image quality
- Non-standard receipt formats

## 11. Accuracy Comparison

| Mode | Model | Accuracy | Speed | Internet Required |
|------|-------|----------|-------|-------------------|
| Secure | Moondream (1B) | ~60-70% | ~10-15s | No |
| Cloud | Claude Vision | ~95%+ | ~3-5s | Yes |

### Tips for Better Results

**For Secure Mode:**
- Use clear, well-lit receipt images
- Ensure text is readable
- Standard receipt formats work better

**For Cloud Mode (Recommended for accuracy):**
- Add your Anthropic API key to `.env.local`
- Much better at handling complex receipts

## 12. API Reference

### POST /api/extract

Extract receipt data from image.

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "mode": "secure" // or "cloud"
}
```

**Response:**
```json
{
  "vendorName": "Store Name",
  "date": "2024-01-15",
  "items": [
    { "description": "Item 1", "quantity": 2, "unitPrice": 5.99 }
  ],
  "subtotal": 11.98,
  "vat": 1.20,
  "total": 13.18
}
```

### POST /api/sheets

Export data to Google Sheets (if configured).

**Request:**
```json
{
  "data": { "vendorName": "...", ... }
}
```