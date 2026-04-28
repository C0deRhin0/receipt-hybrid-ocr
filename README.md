# Receipt Hybrid OCR

<div align="center">

<h2 style="color: #0096FF">NuecAI - Local LAN Deployment</h2>

**Hybrid Receipt OCR** — Cloud + Local AI-powered receipt extraction

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Claude](https://img.shields.io/badge/Claude-Vision-orange)](https://www.anthropic.com/claude)
[![Ollama](https://img.shields.io/badge/Ollama-Local-red)](https://ollama.com)

</div>

---

## What is Receipt Hybrid OCR?

**Receipt Hybrid OCR** gives you a choice: use cloud AI for speed, or local AI for privacy. Both paths output structured JSON — vendor, date, line items, totals — ready for CSV export or Google Sheets push.

> **Demo**: Capture a receipt → Get structured data in under 5 seconds (cloud) or 15 seconds (local)

### Features

- **Hybrid routing** — Switch between Claude Vision (cloud) and Local pipeline (tesseract.js + local LLM)
- **Secure mode (default)** — Process receipts entirely offline using local OCR and AI structuring
- **Raw OCR & Structured Data** — Toggle between raw extracted text and AI-parsed JSON data
- **Enhanced UI** — Features a receipt preview image, processing overlay during extraction, and dark-first design
- **One-click export** — Download as CSV or push directly to Google Sheets
- **Local LAN Deployment** — Self-hosted Express server accessible across your local network
- **HTTPS enabled** — Camera access works on external devices (phones/tablets)
- **HTTP fallback** — Port 5002 for devices without certificate support

### Architecture

```
                    ┌──────────────────────────────────────────┐
                    │            Client Devices                │
                    │         (Mobile / Desktop on LAN)        │
                    └───────────────────┬──────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │     Express Server (Host Machine)        │
                    │   Port 5001 (HTTPS) / Port 5002 (HTTP)   │
                    │                                          │
                    │       ┌─────────────┐    ┌──────────┐    │
                    │       │ Secure Mode │    │  Cloud   │    │
                    │       │ (tesseract +│───▶│ (Claude  │    │
                    │       │ local LLM)  │    │  Vision) │    │
                    │       └─────────────┘    └──────────┘    │
                    └───────────────────┬──────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │         Output (Clean JSON Display)         │
                    │   Raw OCR & Structured tabs, CSV export,   │
                    │            Google Sheets push              │
                    └──────────────────────────────────────────┘
```

### Processing Pipeline (Secure Mode)

```
1. User uploads receipt image
         │
         ▼
2. Tesseract.js extracts raw text (direct - no preprocessing currently)
         │
         ▼
3. Local Ollama LLM processes and cleans the text
         │   - Fixes OCR errors (EET→SHELL, P08.57→P358.57)
         │   - Removes noise (===, ---, mmm, [i, etc.)
         │   - Extracts structured data
         │
         ▼
4. Clean output rendered in both Raw OCR and Structured tabs
```

#### Note on Preprocessing

The codebase includes optional preprocessing modules that are NOT currently active:
- `server/lib/preprocess.js` - Sharp-based image enhancement
- `server/preprocess.py` - OpenCV-based preprocessing (requires venv)

These were tested but found that direct Tesseract + LLM cleaning produced better results for the receipts tested. Future work could re-enable these for different receipt types.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/NuecAI/receipt-hybrid-ocr.git
cd receipt-hybrid-ocr
npm install

# Copy env template
cp .env.example .env.local

# Start the server (includes Ollama management)
npm run start
```

### Access

- **Local (HTTPS):** https://localhost:5001
- **Network (HTTPS):** https://192.168.x.x:5001
- **Fallback (HTTP):** http://192.168.x.x:5002 (for devices without cert support)

> **Note:** Port 5001 is used because port 5000 may be occupied by other services.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Styling | Tailwind CSS (dark-first) |
| Cloud AI | Claude Vision API |
| Local OCR | Tesseract.js |
| Local AI | Ollama (local text model, e.g., llama3.2:3b) |

---

## Mode Comparison

| Feature | Secure Mode (Default) | Cloud Mode |
|---------|----------------------|------------|
| Processing | Local (Tesseract + Ollama) | Cloud (Claude) |
| Internet required | No | Yes |
| Privacy | 100% offline | Data sent to Claude |
| Speed | ~5-15 sec | ~3-5 sec |
| Accuracy | ~70-80% | ~95%+ |
| API key needed | No | Yes |
| Model | `llama3.2:3b` | Claude Vision |

---

## Installation

### Prerequisites

1. **Node.js** (v18+)
2. **Ollama** (for Secure Mode)
   ```bash
   # macOS
   brew install ollama
   # Linux
   curl -fsSL https://ollama.com/install.sh | sh
   ```

### Install local AI model

```bash
# Pull recommended text model for structuring OCR
ollama pull llama3.2:3b
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOST` | No | 0.0.0.0 | Server bind address |
| `PORT` | No | 5001 | Server port |
| `ANTHROPIC_API_KEY` | Optional | - | Claude Vision API key (cloud mode) |
| `OLLAMA_TEXT_MODEL` | No | llama3.2:3b | Local LLM for structuring |
| `GOOGLE_SHEETS_CREDENTIALS` | Optional | - | Service account JSON |
| `GOOGLE_SHEET_ID` | Optional | - | Target spreadsheet ID |

---

## Camera on External Devices

### Option 1: HTTPS (Port 5001) - Recommended

The server auto-generates HTTPS certificates. Use this URL on phones:

```
https://192.168.x.x:5001
```

1. Navigate to the above URL
2. Accept the certificate warning (one-time per device)
3. Camera will work

### Option 2: HTTP Fallback (Port 5002)

For devices that can't accept self-signed certificates:

```
http://192.168.x.x:5002
```

---

## Using the App

### Demo Flow

1. Open app at local or network URL
2. **Toggle Mode:** Click the lock icon (Secure/Local) or cloud icon (Cloud)
3. **Capture:** Use camera button or upload receipt image
4. **Wait:** A processing overlay will appear (~5-15 sec for local, ~3-5 sec for cloud)
5. **View Data:** Toggle between:
   - **Structured tab:** Clean parsed JSON data
   - **Raw OCR tab:** Processed text (LLM-cleaned)
6. **Export:** Download CSV or push to Google Sheets

### Mode Indicator

- 🔒 **Secure Mode:** Local Ollama processing (default)
- ☁️ **Cloud Mode:** Claude Vision API processing

---

## Accuracy Comparison

| Mode | Pipeline | Accuracy | Speed | Internet Required |
|------|----------|----------|-------|-------------------|
| Secure | Tesseract + Llama3.2:3b | ~70-80% | ~5-15s | No |
| Cloud | Claude Vision | ~95%+ | ~3-5s | Yes |

### Tips for Better Results (Secure Mode)

- Use clear, well-lit receipt images
- Ensure text is readable
- Standard receipt formats work better

---

## API Reference

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

---

## License

MIT © NuecAI