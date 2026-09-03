const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const test = require('node:test');
const { parseJson } = require('../lib/ollamaVision');
const {
  normalizeVisionResult,
  extractDeterministicFields,
  clearExtractionCache
} = require('../src/services/receipt-extraction.service');

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

function postJson(port, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      hostname: '127.0.0.1', port, path: '/api/extract', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

test('secure extraction performs real OCR and consumes a local text-structuring response', { timeout: 120000 }, async () => {
  let structuringRequests = 0;
  const visionServer = http.createServer((request, response) => {
    let requestBody = '';
    request.on('data', chunk => { requestBody += chunk; });
    request.on('end', () => {
      const payload = JSON.parse(requestBody);
      structuringRequests += 1;
      assert.equal(request.url, '/api/chat');
      assert.equal(payload.messages[0].images, undefined);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ message: { content: JSON.stringify({
        documentType: 'receipt',
        fields: [{ label: 'merchant', value: 'CITY OF FALMOUTH', confidence: 'high', source: 'ocr_confirmed', evidence: 'CITY OF FALMOUTH' }],
        lineItems: [], warnings: []
      }) } }));
    });
  });
  const visionPort = await listen(visionServer);
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${visionPort}`;
  process.env.VISION_MODEL = 'test-vision';
  process.env.LOCAL_SCAN_CONCURRENCY = '1';
  process.env.EXTRACTION_CACHE_ENABLED = 'true';
  process.env.EXTRACTION_CACHE_TTL_SECONDS = '3600';
  process.env.EXTRACTION_CACHE_MAX_ENTRIES = '10';
  clearExtractionCache();

  const { createApp } = require('../src/app');
  const { terminateWorker } = require('../lib/ocr');
  const appServer = http.createServer(createApp());
  const appPort = await listen(appServer);
  try {
    const imageBase64 = fs.readFileSync('../samples/sample_receipt.png').toString('base64');
    const result = await postJson(appPort, { imageBase64, mode: 'secure' });
    assert.equal(result.status, 200);
    assert.equal(result.body.documentType, 'receipt');
    assert.equal(result.body.structured.fields.merchant.value, 'CITY OF FALMOUTH');
    assert.ok(result.body.rawOcr.text.includes('CITY OF FALMOUTH'));
    assert.ok(result.body.rawOcr.confidence > 0);
    assert.equal(result.body.processing.cache.hit, false);

    const cachedResult = await postJson(appPort, { imageBase64, mode: 'secure' });
    assert.equal(cachedResult.status, 200);
    assert.equal(cachedResult.body.processing.cache.hit, true);
    assert.equal(cachedResult.body.structured.fields.merchant.value, 'CITY OF FALMOUTH');
    assert.equal(structuringRequests, 1);
  } finally {
    clearExtractionCache();
    await close(appServer);
    await close(visionServer);
    await terminateWorker();
  }
});

test('repairs a missing comma in a local vision JSON array', () => {
  const parsed = parseJson('{"documentType":"receipt","fields":{},"lineItems":[{"name":"A"} {"name":"B"}],"warnings":[]}');
  assert.equal(parsed.lineItems.length, 2);
  assert.ok(parsed.warnings.some(warning => warning.includes('repaired')));
});

test('normalizes labeled vision fields without displaying internal schema keys', () => {
  const result = normalizeVisionResult({
    documentType: 'receipt',
    fields: [{ label: 'merchant', value: 'SHELL TINAGO', confidence: 'high', source: 'image', evidence: 'heading' }],
    lineItems: [], warnings: []
  }, { confidence: 80 });
  assert.equal(result.structured.fields.merchant.value, 'SHELL TINAGO');
  assert.equal(Object.hasOwn(result.structured.fields, 'value'), false);
});

test('extracts explicit OCR labels, dates, and labeled amounts without a receipt schema', () => {
  const fields = extractDeterministicFields([
    'User: KLH 06/18/2003',
    'Transaction No.: 221180]',
    'Check Number...: 092345',
    'TEL. 0257505142',
    'BOAT EXCISE TAX 55.00',
    'EXCISE TAX 72.50',
    'Total: 127.50'
  ].join('\n'), 85);
  const values = Object.fromEntries(fields.map(field => [field.label, field.value]));
  assert.equal(values.User, 'KLH');
  assert.equal(values.Date, '06/18/2003');
  assert.equal(values['Transaction No'], '221180');
  assert.equal(values['Check Number'], '092345');
  assert.equal(values.TEL, '0257505142');
  assert.equal(values['BOAT EXCISE TAX'], '55.00');
  assert.equal(values.Total, '127.50');
});

test('selects a safe OCR frame for close-up and photographed receipts', { timeout: 120000 }, async () => {
  const { extractTextFromImage, terminateWorker } = require('../lib/ocr');
  const { prepareOcrImageBuffer } = require('../lib/preprocess');
  const previousThreshold = process.env.OCR_MIN_CONFIDENCE;
  process.env.OCR_MIN_CONFIDENCE = '70';
  try {
    const narrow = await prepareOcrImageBuffer(fs.readFileSync('../samples/sample1.png'));
    assert.equal(narrow.usedDocumentCrop, false);
    const narrowResult = await extractTextFromImage(narrow.buffer.toString('base64'));
    assert.equal(narrowResult.usedEnhancedRetry, true);
    assert.match(narrowResult.rawText, /GRESP S\.R\.L/i);
    assert.match(narrowResult.rawText, /T[O0]TALE/i);

    const photographed = await prepareOcrImageBuffer(fs.readFileSync('../samples/sample2.jpeg'));
    assert.equal(photographed.usedDocumentCrop, true);
    const photographedResult = await extractTextFromImage(photographed.buffer.toString('base64'));
    assert.match(photographedResult.rawText, /Maya/i);
    assert.match(photographedResult.rawText, /MODEL: P2-A11/i);
  } finally {
    if (previousThreshold === undefined) delete process.env.OCR_MIN_CONFIDENCE;
    else process.env.OCR_MIN_CONFIDENCE = previousThreshold;
    await terminateWorker();
  }
});
