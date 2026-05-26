const http = require('http');

const DEFAULT_TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || 'llama3.2:3b';

const PROMPT = `You are an OCR receipt processor.

INPUT: Noisy OCR text from a receipt image.
OUTPUT: Clean JSON.

MANDATORY JSON FORMAT:
{
  "vendorName": "SHELL TINAGO",
  "date": "2026/04/12",
  "time": "16:47:52",
  "total": "P358.57",
  "rawTextLines": ["LINE1", "LINE2", ...],
  "fields": {"merchantId": "...", "terminalId": "...", ...}
}

REQUIRED: rawTextLines must be an array of clean strings - one per receipt line.
NO "==", NO "——", NO "mmm", NO "[i", NO "See ae", NO "sme".

Fix common errors: EET→SHELL, P08.57→P358.57, 0S→OS, P2-All→P2-A11

Clean rawTextLines example:
["SHELL TINAGO","PANGANIBAN DRIVE TINAGO NAGA","Camarines Sur PHL 4400","MERCHANT ID EFS201657018","TERMINAL ID 30032138","PAYMENT CHANNEL Card","CARD TYPE MASTERCARD","CARD NO 5535","TRANSACTION TYPE SALE","BATCH NO 000894","TRACE NO 007422","REFERENCE NO 610206664583","TRANSACTION NO BB1087493845","APPR. CODE 478157","DATE/TIME 2026/04/12 16:47:52","APPROVED","SALE AMOUNT P358.57","ARQC B603FD41FDE55B93","ATC 001C","APP LABEL Debit Mastercard","AID A0000000041010","RETAIN THIS COPY FOR YOUR RECORDS","Customer COPY","OS 3.0.57","MODEL P2-A11"]

Be perfect. Return ONLY valid JSON.`;

// Use localhost:11434
const OLLAMA_BASE_URL = 'http://localhost:11434';

/**
 * Simple HTTP request to Ollama
 */
function ollamaRequest(endpoint, data, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, OLLAMA_BASE_URL);
    const postData = JSON.stringify(data);
    
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 11434,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeout
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } 
        catch (e) { reject(new Error('Parse error')); }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Normalize and validate the extracted data
 */
function normalizeReceiptData(rawData, fallbackText = '') {
  // If already an object/array, return after normalization
  if (rawData && typeof rawData === 'object') {
    return normalizeParsedData(rawData);
  }

  // If already a string (JSON string), try to parse it
  let data = null;

  if (typeof rawData === 'string') {
    // First try: direct parse
    try {
      data = JSON.parse(rawData);
      if (data && typeof data === 'object') {
        return normalizeParsedData(data);
      }
    } catch (e) {
      // Continue to try extraction
    }

    // Second try: extract JSON object from string
    const jsonStr = extractJsonObject(rawData);
    if (jsonStr) {
      try {
        data = JSON.parse(jsonStr);
        return normalizeParsedData(data);
      } catch (e) {
        console.log('Failed to parse extracted JSON object:', e.message);
      }
    }

    // Third try: extract JSON array from string
    const jsonArrayStr = extractJsonArray(rawData);
    if (jsonArrayStr) {
      try {
        data = JSON.parse(jsonArrayStr);
        return normalizeParsedData(data);
      } catch (e) {
        console.log('Failed to parse extracted JSON array:', e.message);
      }
    }
  }

  // Ultimate fallback: create from raw text
  return {
    rawExtraction: fallbackText || rawData,
    error: "Could not parse JSON"
  };
}

/**
 * Normalize parsed data (object or array)
 */
function normalizeParsedData(data) {
  if (Array.isArray(data)) {
    // If array of objects, pick the most complete object
    const objects = data.filter(item => item && typeof item === 'object' && !Array.isArray(item));
    if (objects.length > 0) {
      const best = objects.reduce((prev, curr) => {
        const prevScore = Object.keys(prev).length;
        const currScore = Object.keys(curr).length;
        return currScore > prevScore ? curr : prev;
      });
      return best;
    }
    return {
      items: data,
      error: 'Parsed array contained no receipt objects'
    };
  }

  return data;
}

/**
 * Extract a JSON object from potentially malformed JSON string
 */
function extractJsonObject(str) {
  // Find the first { and the last }
  let start = -1;
  let braceCount = 0;
  let end = -1;
  
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      if (start === -1) start = i;
      braceCount++;
    } else if (str[i] === '}') {
      if (start === -1) continue;
      braceCount--;
      if (braceCount === 0 && start !== -1) {
        end = i + 1;
        break;
      }
    }
  }
  
  if (start !== -1 && end !== -1) {
    return str.substring(start, end);
  }
  return null;
}

/**
 * Extract a JSON array from string
 */
function extractJsonArray(str) {
  let start = -1;
  let braceCount = 0;
  let end = -1;
  
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '[') {
      if (start === -1) start = i;
      braceCount++;
    } else if (str[i] === ']') {
      if (start === -1) continue;
      braceCount--;
      if (braceCount === 0 && start !== -1) {
        end = i + 1;
        break;
      }
    }
  }
  
  if (start !== -1 && end !== -1) {
    return str.substring(start, end);
  }
  return null;
}

/**
 * Normalize string - handle empty/null/undefined
 */
function normalizeString(value) {
  if (!value) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  return trimmed === '' || trimmed === 'null' || trimmed === 'undefined' ? null : trimmed;
}

/**
 * Normalize date to YYYY-MM-DD format
 */
function normalizeDate(value) {
  if (!value) return null;
  
  // If already a valid date string
  if (typeof value === 'string') {
    // Try various date formats
    const datePatterns = [
      /^(\d{4})-(\d{2})-(\d{2})/,  // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})/,  // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})/,    // DD-MM-YYYY
    ];
    
    for (const pattern of datePatterns) {
      const match = value.match(pattern);
      if (match) {
        if (pattern === datePatterns[0]) return value.substring(0, 10);
        if (pattern === datePatterns[1]) return `${match[3]}-${match[1]}-${match[2]}`;
        if (pattern === datePatterns[2]) return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
    
    // Try Date constructor
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  
  return null;
}

/**
 * Normalize number
 */
function normalizeNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Normalize items array
 */
function normalizeItems(items, fallbackText) {
  if (!items) return [];
  
  let itemsArray = items;
  if (typeof items === 'string') {
    try {
      itemsArray = JSON.parse(items);
    } catch (e) {
      itemsArray = [];
    }
  }
  
  if (!Array.isArray(itemsArray)) return [];
  
  return itemsArray.map(item => ({
    description: normalizeString(item.description) || 'Unknown Item',
    quantity: normalizeNumber(item.quantity) || 1,
    unitPrice: normalizeNumber(item.unitPrice) || 0
  })).filter(item => item.description !== 'Unknown Item' || item.unitPrice > 0);
}

/**
 * Extract vendor name from fallback text
 */
function extractVendorFromText(text) {
  if (!text) return null;
  // First line often contains vendor name
  const lines = text.split('\n').filter(l => l.trim());
  return lines[0]?.substring(0, 50) || null;
}

/**
 * Create fallback data when extraction completely fails
 */
function createFallbackData(fallbackText) {
  return {
    vendorName: extractVendorFromText(fallbackText) || 'Unknown Vendor',
    date: new Date().toISOString().split('T')[0],
    items: [],
    subtotal: 0,
    vat: 0,
    total: 0,
    rawExtraction: fallbackText?.substring(0, 500) || ''
  };
}

/**
 * Extract with Ollama
 */
function parseReceiptText(ocrText) {
  const text = (ocrText || '').replace(/\r/g, '').trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    return createFallbackData(ocrText);
  }

  const result = {
    vendorName: lines[0] || 'Unknown Vendor',
    items: []
  };

  for (const line of lines) {
    const telMatch = line.match(/\bTEL\.?\s*([+\d][\d\s.-]{5,})/i);
    if (telMatch) result['TEL.'] = telMatch[1].replace(/\s+/g, '');

    const pivaMatch = line.match(/\bP\.?\s*IVA\s*([A-Z0-9]+)/i);
    if (pivaMatch) result['P.IVA'] = pivaMatch[1];

    const totalMatch = line.match(/\bTOTALE\b[^\d]*([\d.,]+)/i);
    if (totalMatch) result.total = normalizeMoney(totalMatch[1]);

    const piecesMatch = line.match(/\bNUMERO\s+PEZZ[AI]\b[^\d]*([\d]+)/i);
    if (piecesMatch) result.pieces = piecesMatch[1];

    const dateTimeMatch = line.match(/\b(\d{2}[/-]\d{2}[/-]\d{2,4})\s+(\d{2}[-:]\d{2})/);
    if (dateTimeMatch) {
      result.date = normalizeDate(dateTimeMatch[1]);
      result.time = dateTimeMatch[2].replace('-', ':');
    } else {
      const dateOnlyMatch = line.match(/\b(\d{2}[/-]\d{2}[/-]\d{2,4})\b/);
      if (dateOnlyMatch) result.date = normalizeDate(dateOnlyMatch[1]);
    }
  }

  return result;
}

function normalizeMoney(value) {
  if (!value) return value;
  return value.replace(/\./g, '').replace(',', '.');
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isLikelyFromOcr(value, ocrText) {
  if (value === null || value === undefined) return false;
  const normalizedOcr = normalizeForMatch(ocrText);
  if (!normalizedOcr) return false;

  const normalizedValue = normalizeForMatch(value);
  if (normalizedValue.length >= 3 && normalizedOcr.includes(normalizedValue)) {
    return true;
  }

  const ocrDigits = normalizeDigits(ocrText);
  const valueDigits = normalizeDigits(value);
  if (valueDigits.length >= 3 && ocrDigits.includes(valueDigits)) {
    return true;
  }

  return false;
}

function filterExtractionByOcr(extractionResult, ocrText) {
  if (!extractionResult || typeof extractionResult !== 'object') return extractionResult;
  if (!ocrText) return extractionResult;

  const alwaysKeep = new Set(['rawText', 'rawTextLines']);
  const filtered = {};

  for (const [key, value] of Object.entries(extractionResult)) {
    if (alwaysKeep.has(key)) {
      filtered[key] = value;
      continue;
    }

    if (key === 'items' && Array.isArray(value)) {
      const filteredItems = value.filter(item => {
        if (!item || typeof item !== 'object') return false;
        return Object.values(item).some(itemValue => isLikelyFromOcr(itemValue, ocrText));
      });
      filtered.items = filteredItems;
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      const nested = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (isLikelyFromOcr(nestedValue, ocrText) || isLikelyFromOcr(nestedKey, ocrText)) {
          nested[nestedKey] = nestedValue;
        }
      }
      if (Object.keys(nested).length > 0) {
        filtered[key] = nested;
      }
      continue;
    }

    if (isLikelyFromOcr(value, ocrText) || isLikelyFromOcr(key, ocrText)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

async function extractWithOllamaFromText(ocrText) {
  console.log('Secure Mode: Structuring OCR text with Ollama...');

  const model = DEFAULT_TEXT_MODEL;
  const prompt = `${PROMPT}\n\nOCR TEXT:\n${ocrText}\n\nExtract all receipt data now. Return JSON only.`;

  try {
    console.log('Calling Ollama API (generate endpoint)...');

    const resp = await ollamaRequest('/api/generate', {
      model: model,
      prompt: prompt,
      format: 'json',
      stream: false,
      options: { num_predict: 1400, temperature: 0.0 }
    }, 300000); // 300 seconds timeout

    const text = resp.response || '';
    console.log('Response received, length:', text.length);
    console.log('Response preview:', text.substring(0, 300));

    return normalizeReceiptData(text, text);
  } catch (err) {
    console.error('Ollama error:', err.message);
    throw new Error('Secure Mode failed: ' + err.message);
  }
}

module.exports = {
  parseReceiptText,
  extractWithOllamaFromText,
  filterExtractionByOcr,
  normalizeReceiptData,
  createFallbackData
};
