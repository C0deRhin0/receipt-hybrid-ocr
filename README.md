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

### Architecture

```
                    ┌──────────────────────────────────────────┐
                    │            Client Devices                │
                    │         (Mobile / Desktop on LAN)        │
                    └───────────────────┬──────────────────────┘
                                        │
                                        ▼
                    ┌──────────────────────────────────────────┐
                    │     Express Server (Host Machine)        │
                    │         Port 5001 (HTTPS enabled)        │
                    │                                          │
                    │       ┌─────────────┐    ┌──────────┐    │
                    │       │ Secure Mode │    │  Cloud   │    │
                    │       │ (tesseract +│──▶ │ (Claude  │    │
                    │       │ local LLM)  │    │  Vision) │    │
                    │       └─────────────┘    └──────────┘    │
                    └───────────────────┬──────────────────────┘
                                        │
                                        ▼
                    ┌──────────────────────────────────────────┐
                    │            Output Rendering              │
                    │       (Local Display / Google Sheets)    │
                    └──────────────────────────────────────────┘
```

### Quick Start

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

- **Local:** https://localhost:5001
- **Network:** https://192.168.x.x:5001 (from other devices on LAN)

> **Note:** Port 5001 is used because port 5000 may be occupied by other services.

See [USAGE.md](./USAGE.md) for full setup including:
- Environment variables (including `OLLAMA_TEXT_MODEL` for local parsing)
- Local OCR + LLM setup (Secure Mode)
- Google Sheets OAuth configuration

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Styling | Tailwind CSS (dark-first) |
| Cloud AI | Claude Vision API |
| Local OCR | Tesseract.js |
| Local AI | Ollama (local text model, e.g., llama3.2) |
| CI/CD | GitHub Actions |

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
| Model | Tesseract.js + `OLLAMA_TEXT_MODEL` | Claude Vision |

---

## Contributing

We welcome contributions to Receipt Hybrid OCR! Please follow these steps:

1. Fork the repo and clone it locally
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Make your changes and write tests if applicable
4. Run the CI locally (`npm run lint` and `npm run build`)
5. Commit with conventional commits (e.g., `feat: add awesome feature`)
6. Push to your fork and open a Pull Request against `main`

Please ensure your PR description clearly describes the problem and solution.

---

## Inspiration

This project was inspired by [bhimrazy/receipt-ocr](https://github.com/bhimrazy/receipt-ocr) — the nearest public analogue for receipt OCR. We diverge with hybrid routing (cloud + local), Secure Mode for privacy, and Google Sheets export.

---

## License

MIT © NuecAI