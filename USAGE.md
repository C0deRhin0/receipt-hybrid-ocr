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
| `OLLAMA_TEXT_MODEL` | No | llama3.2 | The local LLM used to structure OCR text |
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

## 5. Secure Mode (Default - Local OCR & LLM Structuring)

The app defaults to **Secure Mode** using local processing for privacy. No internet required after models are downloaded. The pipeline first extracts raw text using **tesseract.js**, then uses a local Ollama model (configured via `OLLAMA_TEXT_MODEL`) to structure the data into JSON.

### Install Ollama:

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### Install the Text Model:

```bash
# Recommended text model for structuring OCR data
ollama pull llama3.2

# You can use a different model by setting OLLAMA_TEXT_MODEL in .env.local
```

### Start Ollama (if not auto-started):

```bash
ollama serve
```

**Note:** The app will handle OCR locally using Tesseract and structure the text using your specified Ollama model. Processing typically takes ~5-15 seconds.

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
4. **Wait:** A processing overlay will appear over the preview image (~5-15 sec for local, ~3-5 sec for cloud)
5. **View Data:** The parsed data appears in the Parsed Data panel
6. **Toggle Structured/Raw:** Switch between AI-structured JSON tables or Raw OCR text extraction
7. **Export:** Download CSV or push to Google Sheets

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
- Check text model is installed: `ollama list`
- Try: `ollama pull llama3.2` or verify your `OLLAMA_TEXT_MODEL` value.

### "Cloud Mode not working"
- Verify API key in `.env.local`
- Check key starts with `sk-ant-`
- Restart server after changing `.env.local`

### "Port 5001 already in use"
- Check what's using it: `lsof -i :5001`
- Change port in `.env.local`: `PORT=5002`

### "Extraction shows empty or wrong data"
- **Secure Mode (Local)**: Ensure the receipt is clear. Tesseract.js may struggle with poor lighting, meaning the LLM gets bad input text. Toggle to **Raw OCR** to see exactly what text the LLM received.
- **Cloud Mode**: Ensure your API key is valid and has sufficient credits

### "Fallback to raw text displayed"
When the AI cannot extract structured data, you can toggle the UI to show:
- The raw extracted text from the OCR pass (useful for debugging)

This typically happens with:
- Very complex receipt layouts
- Poor image quality
- Non-standard receipt formats

## 11. Accuracy Comparison

| Mode | Model Pipeline | Accuracy | Speed | Internet Required |
|------|-------|----------|-------|-------------------|
| Secure | Tesseract + Llama3.2 | ~70-80% | ~5-15s | No |
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