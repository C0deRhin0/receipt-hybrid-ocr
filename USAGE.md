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

- **Local (HTTPS):** https://localhost:5001
- **Network (HTTPS):** https://192.168.x.x:5001
- **Fallback (HTTP):** http://192.168.x.x:5002

> **Note:** Port 5001 is used because port 5000 may be occupied by other services.

## 3. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOST` | No | 0.0.0.0 | Server bind address |
| `PORT` | No | 5001 | Server port |
| `ANTHROPIC_API_KEY` | Optional | - | Claude Vision API key (cloud mode) |
| `ANTHROPIC_API_BASE_URL` | Optional | anthropic.com | Custom API endpoint |
| `OLLAMA_BASE_URL` | No | http://localhost:11434 | Ollama server URL |
| `OLLAMA_TEXT_MODEL` | No | llama3.2:3b | Local LLM for structuring |
| `GOOGLE_SHEETS_CREDENTIALS` | Optional | - | Service account JSON |
| `GOOGLE_SHEET_ID` | Optional | - | Target spreadsheet ID |

### Company API Support

To use your company's Anthropic-compatible API:

```bash
echo "ANTHROPIC_API_KEY=your-key" >> .env.local
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
───────────────────────────────────
Local:    https://localhost:5001
Network:  https://192.168.11.191:5001
───────────────────────────────────
Cloud Mode:   ⚠️ Add API key to .env.local
Secure Mode: Ollama @ http://localhost:11434
HTTP Fallback: http://192.168.11.191:5002 (no certs)
```

## 5. Secure Mode (Default - Local OCR & LLM)

The app defaults to **Secure Mode** using local processing for privacy. No internet required after models are downloaded.

### How It Works

The processing pipeline has two stages:

**Stage 1: Tesseract.js OCR**
- Direct image-to-text extraction (no preprocessing currently active)
- Returns raw text with OCR artifacts/errors

**Stage 2: Local Ollama LLM**
- Receives raw OCR output
- Corrects common OCR errors (EET→SHELL, P08.57→P358.57)
- Removes noise characters (===, ---, mmm, [i, etc.)
- Extracts structured JSON data

The LLM acts as the "last line of defense" - producing clean output for both the Raw OCR and Structured tabs.

### Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### Install the Text Model

```bash
# Recommended text model for structuring OCR data
ollama pull llama3.2:3b
```

### Start Ollama (if not auto-started)

```bash
ollama serve
```

**Note:** Processing typically takes ~5-15 seconds.

### Fallback Behavior

- If Secure Mode fails and you have an API key configured → falls back to Cloud Mode
- If Cloud Mode fails → attempts Secure Mode as backup

## 6. Cloud Mode (Optional)

For faster processing (~3-5 seconds), add your Anthropic API key:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local
npm run start
```

The mode toggle in the UI lets you switch between Cloud and Secure modes. Your preference is saved in localStorage.

## 7. Camera on External Devices

### Option 1: HTTPS (Port 5001) - Recommended

The server runs on **HTTPS** automatically when certificates exist. This enables camera access on phones/tablets.

On Your Phone:

1. Navigate to `https://192.168.x.x:5001`
2. Accept the certificate warning (one-time per device)
3. Camera will now work

### Option 2: HTTP Fallback (Port 5002)

For devices that can't accept self-signed certificates:

```
http://192.168.x.x:5002
```

This provides the same functionality without HTTPS requirements.

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

1. Open app at local or network URL
2. **Toggle Mode:** Click the lock icon (Secure/Local) or cloud icon (Cloud)
3. **Capture:** Use camera button or upload receipt image
4. **Wait:** A processing overlay will appear (~5-15 sec for local, ~3-5 sec for cloud)
5. **View Data:** Toggle between:
   - **Structured tab:** Clean parsed JSON data
   - **Raw OCR tab:** Processed text (LLM-cleaned) - shows what the LLM produced
6. **Export:** Download CSV or push to Google Sheets

### Mode Indicator

- 🔒 **Secure Mode** (lock icon): Local Ollama processing
- ☁️ **Cloud Mode** (cloud icon): Claude Vision API processing

Your mode preference is saved between sessions.

## 10. Troubleshooting

### "Camera not working on phone"
- Use HTTPS URL (`https://192.168.x.x:5001`)
- Accept the certificate warning in your browser
- Try HTTP fallback (`http://192.168.x.x:5002`)
- Check that your phone is on the same network

### "Secure Mode timeout"
- Ensure Ollama is running: `ollama serve`
- Check text model is installed: `ollama list`
- Try: `ollama pull llama3.2:3b`

### "Cloud Mode not working"
- Verify API key in `.env.local`
- Check key starts with `sk-ant-`
- Restart server after changing `.env.local`

### "Port 5001 already in use"
- Check what's using it: `lsof -i :5001`
- Change port in `.env.local`: `PORT=5002`

### "Extraction shows empty or wrong data"
- **Secure Mode**: Ensure the receipt is clear. Toggle to "Raw OCR" to see processed text.
- **Cloud Mode**: Ensure your API key is valid and has sufficient credits

### "Seeing OCR noise in Raw OCR tab"
- The Raw OCR tab shows LLM-processed text (after error correction)
- The Structured tab shows parsed JSON
- Both display clean output - noise is removed by the LLM

## 11. Accuracy Comparison

| Mode | Model Pipeline | Accuracy | Speed | Internet Required |
|------|----------------|----------|-------|-------------------|
| Secure | Tesseract + Llama3.2:3b | ~70-80% | ~5-15s | No |
| Cloud | Claude Vision | ~95%+ | ~3-5s | Yes |

### Tips for Better Results

**For Secure Mode:**
- Use clear, well-lit receipt images
- Ensure text is readable
- Standard receipt formats work better

**For Cloud Mode:**
- Add your Anthropic API key to `.env.local`
- Much better at handling complex receipts

## 12. API Reference

### POST /api/extract

Extract receipt data from image.

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "mode": "secure"
}
```

**Response:**
```json
{
  "vendorName": "SHELL TINAGO",
  "date": "2026/04/12",
  "time": "16:47:52",
  "total": "P358.57",
  "rawTextLines": [
    "SHELL TINAGO",
    "Camarines Sur PHL 4400",
    "MERCHANT ID EFS201657018",
    ...
  ],
  "fields": {
    "merchantId": "EFS201657018",
    ...
  }
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