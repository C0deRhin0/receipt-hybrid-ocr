const http = require('http');
const https = require('https');
const { jsonrepair } = require('jsonrepair');

const VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentType', 'fields', 'lineItems', 'warnings'],
  properties: {
    documentType: { type: 'string', maxLength: 40 },
    fields: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value', 'confidence', 'source', 'evidence'],
        properties: {
          label: { type: 'string', maxLength: 80 },
          value: { type: 'string', maxLength: 160 },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          source: { type: 'string', enum: ['image', 'ocr_confirmed'] },
          evidence: { type: 'string', maxLength: 180 }
        }
      }
    },
    lineItems: {
      type: 'array',
      maxItems: 12,
      items: { type: 'object', additionalProperties: { type: 'string', maxLength: 160 } }
    },
    warnings: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 180 } }
  }
};

const VISION_PROMPT = `You are a careful document-extraction verifier. Read the image itself and use OCR text only as a candidate transcription.

Return valid JSON with exactly these top-level keys: documentType, fields, lineItems, warnings.
- fields is an array. Each entry must have label, value, confidence (high|medium|low), source (image|ocr_confirmed), and evidence. For example: {"label":"merchant","value":"Example Store","confidence":"high","source":"image","evidence":"top heading"}.
- lineItems is an array only when rows are visibly readable. Each item must use dynamic keys and include confidence and evidence when possible.
- Do not invent, infer, complete, or silently correct text, amounts, IDs, dates, currencies, or merchant names.
- If a value is unclear or OCR and image disagree, omit the value and add a warning.
- Keep values exactly as visible; do not use a fixed receipt schema.
- Return at most 20 fields and 12 line items. Keep evidence short.

Follow this JSON Schema exactly:
${JSON.stringify(VISION_SCHEMA)}

OCR CANDIDATE TEXT:
`;

function getBaseUrl() {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}

function requestJson(endpoint, payload, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, getBaseUrl());
    const body = JSON.stringify(payload);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 11434),
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout
    }, response => {
      let responseBody = '';
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(`Ollama returned ${response.statusCode}: ${responseBody.slice(0, 300)}`));
        }
        try { resolve(JSON.parse(responseBody)); } catch { reject(new Error('Ollama returned invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama vision request timed out')); });
    req.end(body);
  });
}

function parseJson(text) {
  if (typeof text !== 'string') throw new Error('Vision model returned no text');
  const match = text.match(/\{[\s\S]*\}/);
  const candidate = match ? match[0] : text.trim();
  try {
    return JSON.parse(candidate);
  } catch (parseError) {
    try {
      const repaired = JSON.parse(jsonrepair(candidate));
      if (repaired && typeof repaired === 'object' && !Array.isArray(repaired)) {
        repaired.warnings = [
          ...(Array.isArray(repaired.warnings) ? repaired.warnings : []),
          'Vision response contained minor JSON syntax errors and was repaired before validation.'
        ];
      }
      return repaired;
    } catch {
      throw new Error(`Vision model returned invalid JSON: ${parseError.message}`);
    }
  }
}

async function extractWithVision({ imageBase64, ocrText }) {
  const response = await requestJson('/api/chat', {
    model: process.env.VISION_MODEL || 'granite3.2-vision:2b',
    messages: [{
      role: 'user',
      content: `${VISION_PROMPT}${ocrText || '(No OCR text available)'}`,
      images: [imageBase64]
    }],
    format: VISION_SCHEMA,
    stream: false,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE || '0',
    options: {
      temperature: 0,
      num_predict: Number.parseInt(process.env.VISION_MAX_TOKENS || '500', 10) || 500
    }
  });

  return parseJson(response?.message?.content);
}

module.exports = { extractWithVision, requestJson, parseJson, VISION_SCHEMA };
