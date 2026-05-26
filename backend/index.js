const fs = require('fs');
const http = require('http');
const https = require('https');
const { loadEnvironment, getRuntimeConfig } = require('./src/config/env');
const { getBackendRoot, getPidFilePath } = require('./src/config/paths');
const { getNetworkIp } = require('./src/utils/network');

loadEnvironment();

const { createApp } = require('./src/app');

const app = createApp();
const { host, port, cloudModeReady } = getRuntimeConfig();

function createPrimaryServer() {
  let server = http.createServer(app);
  let isHttps = false;

  try {
    const backendRoot = getBackendRoot();
    const certFiles = fs.readdirSync(backendRoot).filter(file => file.endsWith('.pem'));
    const keyFileName = certFiles.find(file => file.includes('-key.pem'));
    const certFileName = certFiles.find(file => !file.includes('-key.pem') && file !== keyFileName);

    if (keyFileName && certFileName) {
      const privateKey = fs.readFileSync(`${backendRoot}/${keyFileName}`, 'utf8');
      const certificate = fs.readFileSync(`${backendRoot}/${certFileName}`, 'utf8');
      server = https.createServer({ key: privateKey, cert: certificate }, app);
      isHttps = true;
    }
  } catch (error) {
    // Fallback to HTTP when certificates are unavailable.
  }

  return { server, isHttps };
}

function writePidFile() {
  fs.writeFileSync(getPidFilePath(), String(process.pid));
}

function startFallbackServer(hostname) {
  const fallbackPort = 5002;
  const httpServer = http.createServer(app);

  httpServer.listen(fallbackPort, hostname, () => {
    console.log(`HTTP Fallback: http://${getNetworkIp()}:${fallbackPort} (no certs)`);
    writePidFile();
  });
}

const { server, isHttps } = createPrimaryServer();

server.listen(port, host, () => {
  const protocol = isHttps ? 'https' : 'http';
  const localUrl = `${protocol}://localhost:${port}`;
  const networkUrl = `${protocol}://${getNetworkIp()}:${port}`;

  console.log(`
Receipt Hybrid OCR — NuecAI
───────────────────────────────────
Local:    ${localUrl}
Network:  ${networkUrl}
───────────────────────────────────
Cloud Mode:   ${cloudModeReady ? 'Ready' : '⚠️ Add API key to .env.local'}
Secure Mode: Ollama @ http://localhost:11434
`);

  startFallbackServer(host);
});
