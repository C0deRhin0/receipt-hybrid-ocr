const { extractWithClaude } = require('../../lib/claudeVision');
const { extractTextFromImage } = require('../../lib/ocr');
const { prepareImageBuffer, prepareOcrImageBuffer } = require('../../lib/preprocess');
const { extractWithVision } = require('../../lib/ollamaVision');
const { extractWithText } = require('../../lib/ollamaText');
const { hasCloudModeCredentials, getRuntimeConfig } = require('../config/env');

let activeJobs = 0;
const waitingJobs = [];

function runLocalJob(job) {
  const limit = getRuntimeConfig().localScanConcurrency;
  return new Promise((resolve, reject) => {
    const start = () => {
      activeJobs += 1;
      Promise.resolve(job()).then(resolve, reject).finally(() => {
        activeJobs -= 1;
        const next = waitingJobs.shift();
        if (next) next();
      });
    };
    if (activeJobs < limit) start();
    else waitingJobs.push(start);
  });
}

function cleanLines(lines) {
  return Array.isArray(lines) ? lines.map(line => String(line || '').trim()).filter(Boolean) : [];
}

function confidenceScore(value) {
  return ({ high: 0.9, medium: 0.65, low: 0.4 })[String(value || '').toLowerCase()] || 0.4;
}

function normalizedKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanValue(value) {
  return String(value || '')
    .replace(/^[\s|~_—–-]+|[\s|~_—–\]\[}]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract explicit, document-agnostic OCR facts without guessing a schema.
 * This complements the LLM: if a label and value are visibly present in OCR,
 * they should not disappear merely because a small model omits them.
 */
function extractDeterministicFields(ocrText, ocrConfidence = 0) {
  const fields = [];
  const seen = new Set();
  const confidence = ocrConfidence >= 80 ? 'high' : 'medium';
  const add = (label, value, evidence) => {
    const cleanLabel = cleanValue(label).replace(/[.:]+$/g, '').trim();
    const clean = cleanValue(value);
    const key = normalizedKey(cleanLabel);
    if (!key || cleanLabel.length < 2 || !/[a-z]/i.test(cleanLabel) || !/[a-z0-9]/i.test(clean) || seen.has(key)) return;
    seen.add(key);
    fields.push({ label: cleanLabel, value: clean, confidence, source: 'ocr_confirmed', evidence: cleanValue(evidence) });
  };

  for (const originalLine of String(ocrText || '').split('\n')) {
    const line = cleanValue(originalLine);
    if (!line) continue;

    // Dates and times are useful explicit facts even when a receipt prints
    // them beside other columns instead of after a label.
    const standaloneDate = line.match(/\b(?:\d{1,4}[/-]){2}\d{2,4}\b/);
    if (standaloneDate) add('Date', standaloneDate[0], originalLine);
    const standaloneTime = line.match(/\b\d{1,2}[:.-]\d{2}\b/);
    if (standaloneTime && standaloneTime[0] !== standaloneDate?.[0]) add('Time', standaloneTime[0], originalLine);

    const labeled = line.match(/^(.{1,70}?)(?:\s*:\s*|\s*\.{2,}\s*:?[\s]*)(.+)$/);
    if (labeled) {
      let [, label, value] = labeled;
      const dateMatch = value.match(/\b(?:\d{1,4}[/-]){2}\d{2,4}\b/);
      if (dateMatch) {
        add('Date', dateMatch[0], originalLine);
        value = value.replace(dateMatch[0], '').trim();
      }
      add(label, value, originalLine);
      continue;
    }

    // Many compact receipts omit the colon but still place an alphabetic
    // label immediately before a long numeric ID (phone, tax ID, counter ID).
    const identifier = line.match(/^([A-Za-z][A-Za-z .&/()#-]{1,60}?)\s+((?:#?\d[\d ./:_-]{2,}|[A-Z]{1,4}\d[\w-]{2,}))$/);
    if (identifier) {
      add(identifier[1], identifier[2], originalLine);
      continue;
    }

    // A label followed by a money-like terminal value is explicit even without a colon.
    const amount = line.match(/^([A-Za-z][A-Za-z0-9 &/().#-]{1,78}?)\s+([₱$€£]?\s*\d+(?:[,.]\d{2}))$/);
    if (amount) add(amount[1], amount[2], originalLine);
  }
  return fields;
}

function mergeDeterministicFields(fields, ocr) {
  const merged = { ...fields };
  const existing = new Set(Object.keys(merged).map(normalizedKey));
  for (const field of extractDeterministicFields(ocr.text, ocr.confidence)) {
    const key = normalizedKey(field.label);
    if (existing.has(key)) continue;
    merged[field.label] = field;
    existing.add(key);
  }
  return merged;
}

function normalizeVisionResult(value, ocr) {
  const source = value && typeof value === 'object' ? value : {};
  const fields = {};
  const addField = (key, field) => {
    const entry = field && typeof field === 'object' && !Array.isArray(field) ? field : { value: field };
    if (entry.value === undefined || entry.value === null || String(entry.value).trim() === '') return;
    const baseKey = String(key || 'field').trim() || 'field';
    const uniqueKey = fields[baseKey] ? `${baseKey}_${Object.keys(fields).length + 1}` : baseKey;
    fields[uniqueKey] = {
      value: entry.value,
      confidence: ['high', 'medium', 'low'].includes(entry.confidence) ? entry.confidence : 'low',
      source: ['image', 'ocr_confirmed'].includes(entry.source) ? entry.source : 'image',
      evidence: entry.evidence ? String(entry.evidence) : ''
    };
  };
  if (Array.isArray(source.fields)) {
    for (const field of source.fields) addField(field?.label, field);
  } else if (source.fields && typeof source.fields === 'object') {
    // Backward-compatible handling for older/flattened vision responses.
    if ('value' in source.fields) addField('documentSummary', source.fields);
    else for (const [key, field] of Object.entries(source.fields)) addField(key, field);
  }
  const mergedFields = mergeDeterministicFields(fields, ocr);
  const lineItems = Array.isArray(source.lineItems)
    ? source.lineItems.filter(item => item && typeof item === 'object' && Object.keys(item).some(key => !['label', 'value', 'confidence', 'source', 'evidence'].includes(key)))
    : [];
  const warnings = Array.isArray(source.warnings) ? source.warnings.map(String) : [];
  if (ocr.confidence < Number(process.env.OCR_MIN_CONFIDENCE || 70)) {
    warnings.unshift(`OCR confidence is low (${ocr.confidence}%). Review values before export.`);
  }
  const fieldScores = Object.values(mergedFields).map(field => confidenceScore(field.confidence));
  const score = fieldScores.length
    ? fieldScores.reduce((sum, current) => sum + current, 0) / fieldScores.length
    : Math.min(0.4, ocr.confidence / 100);
  return {
    documentType: typeof source.documentType === 'string' ? source.documentType : 'document',
    structured: { fields: mergedFields, lineItems },
    audit: {
      overallConfidence: score >= 0.8 ? 'high' : score >= 0.55 ? 'medium' : 'low',
      warnings,
      fieldEvidence: mergedFields
    }
  };
}

function createOcrOnlyResult(ocr, warning) {
  const fields = mergeDeterministicFields({}, ocr);
  return {
    documentType: 'document',
    structured: { fields, lineItems: [] },
    audit: {
      overallConfidence: ocr.confidence >= 70 ? 'medium' : 'low',
      warnings: [warning],
      fieldEvidence: fields
    }
  };
}

async function readOcr(imageBase64) {
  const result = await extractTextFromImage(imageBase64);
  return {
    text: result.rawText || '',
    lines: cleanLines(result.rawTextLines),
    words: Array.isArray(result.words) ? result.words : [],
    confidence: Number(result.confidence || 0),
    usedEnhancedRetry: Boolean(result.usedEnhancedRetry)
  };
}

async function extractLocal(imageBase64, verified) {
  return runLocalJob(async () => {
    const upload = Buffer.from(imageBase64, 'base64');
    // Keep the full image for OCR. The VLM-oriented paper crop can sometimes
    // make automatic Tesseract layout detection ignore upper receipt regions.
    const ocrImage = await prepareOcrImageBuffer(upload);
    const ocr = await readOcr(ocrImage.buffer.toString('base64'));
    let result;
    if (verified) {
      try {
        // Text OCR is the primary evidence for local structured output. A small
        // VLM is useful for optional visual verification, but is not dependable
        // enough to be the sole extractor on this hardware.
        result = normalizeVisionResult(await extractWithText(ocr.text), ocr);
        if (process.env.ENABLE_VISION_VERIFICATION === 'true') {
          try {
            const prepared = await prepareImageBuffer(upload);
            const preparedBase64 = prepared.buffer.toString('base64');
            const vision = normalizeVisionResult(await extractWithVision({ imageBase64: preparedBase64, ocrText: ocr.text }), ocr);
            result.audit.warnings.push(...vision.audit.warnings.map(warning => `Vision check: ${warning}`));
          } catch (error) {
            result.audit.warnings.push(`Vision check was unavailable: ${error.message}`);
          }
        }
      } catch (error) {
        result = createOcrOnlyResult(ocr, `Text structuring was unavailable: ${error.message}`);
      }
    } else {
      result = createOcrOnlyResult(ocr, 'Fast local mode: values were not vision-verified.');
    }
    return {
      ...result,
      rawOcr: ocr,
      processing: { mode: verified ? 'secure-text-structured' : 'secure-fast', imageMimeType: ocrImage.mimeType }
    };
  });
}

async function extractCloud(imageBase64) {
  if (!hasCloudModeCredentials()) {
    const error = new Error('Cloud mode requires a valid ANTHROPIC_API_KEY');
    error.statusCode = 400;
    throw error;
  }
  const prepared = await prepareImageBuffer(Buffer.from(imageBase64, 'base64'));
  const data = await extractWithClaude(prepared.buffer.toString('base64'));
  return {
    documentType: 'document',
    structured: { fields: data && typeof data === 'object' ? data : {}, lineItems: Array.isArray(data?.items) ? data.items : [] },
    rawOcr: { text: '', lines: [], words: [], confidence: null, usedEnhancedRetry: false },
    audit: { overallConfidence: 'unverified', warnings: ['Cloud result was not locally OCR-verified.'], fieldEvidence: {} },
    processing: { mode: 'cloud', imageMimeType: prepared.mimeType }
  };
}

async function extractReceiptData({ imageBase64, mode }) {
  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    const error = new Error('No image provided');
    error.statusCode = 400;
    throw error;
  }
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
  if (mode === 'cloud') return extractCloud(cleanBase64);
  return extractLocal(cleanBase64, mode !== 'secure-fast');
}

module.exports = { extractReceiptData, normalizeVisionResult, extractDeterministicFields, runLocalJob };
