const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const extractRoute = require('./routes/extract');
const sheetsRoute = require('./routes/sheets');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Enable CORS for all origins
app.use(cors());

// Increase payload limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api/extract', extractRoute);
app.use('/api/sheets', sheetsRoute);

// Serve static files from React build (../dist or client/dist)
const distPath = fs.existsSync(path.join(__dirname, '../dist'))
  ? path.join(__dirname, '../dist')
  : path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Catch-all route to serve the React index.html for client-side routing
  app.use('/', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Helper to get local network IP
function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback
}

// HTTPS / mkcert Setup - enable if certificates exist
let server = http.createServer(app);
let isHttps = false;

try {
  const certFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.pem'));
  const keyFileName = certFiles.find(f => f.includes('-key.pem'));
  const certFileName = certFiles.find(f => !f.includes('-key.pem') && f !== keyFileName);

  if (keyFileName && certFileName) {
    const privateKey = fs.readFileSync(path.join(__dirname, keyFileName), 'utf8');
    const certificate = fs.readFileSync(path.join(__dirname, certFileName), 'utf8');
    server = https.createServer({ key: privateKey, cert: certificate }, app);
    isHttps = true;
  }
} catch (err) {
  // Fallback to HTTP
}

// Start Server - simplified, just start
server.listen(PORT, HOST, () => {
  const protocol = isHttps ? 'https' : 'http';
  const localUrl = `${protocol}://localhost:${PORT}`;
  const networkUrl = `${protocol}://${getNetworkIp()}:${PORT}`;

  console.log(`
Receipt Hybrid OCR — NuecAI
───────────────────────────────────
Local:    ${localUrl}
Network:  ${networkUrl}
───────────────────────────────────
Cloud Mode:   ${process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-api03-placeholder' ? 'Ready' : '⚠️ Add API key to .env.local'}
Secure Mode: Ollama @ http://localhost:11434
`);

  if (!isHttps) {
    console.log(`
⚠️  NOTE: Camera on phones needs HTTPS (certificates auto-created)
`);
  }

  // Write PID file for scripts to track
  const pidPath = path.join(__dirname, '../.server.pid');
  fs.writeFileSync(pidPath, String(process.pid));
});