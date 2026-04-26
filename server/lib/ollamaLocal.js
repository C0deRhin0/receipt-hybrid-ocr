const http = require('http');

const PROMPT = `You are a receipt data extraction system. Look at the receipt image and extract ALL the data you can see.

IMPORTANT:
1. Extract ACTUAL values you see in the image - do NOT make up data.
2. Extract all key-value pairs you can identify. Do NOT use a fixed schema. Name the keys based on what is on the receipt (e.g. "Merchant", "Date", "Tax ID", "Subtotal", "Total").
3. If there is a list of items purchased, extract them as an array of objects under an 'items' key.
4. Return ONLY valid JSON - no explanations.

Output format should be purely dynamic JSON, for example:
{
  "Merchant": "Store Name",
  "Date": "2023-01-01",
  "Any Other Field": "value",
  "items": [
    { "Description": "Item 1", "Quantity": 1, "Price": 5.00 }
  ],
  "Total": 5.50
}`;

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
  // If already a string (JSON string), try to parse it
  let data = null;
  
  if (typeof rawData === 'string') {
    // First try: direct parse
    try {
      data = JSON.parse(rawData);
      if (data && typeof data === 'object') {
        return data;
      }
    } catch (e) {
      // Continue to try extraction
    }
    
    // Second try: extract JSON object from string
    const jsonStr = extractJsonObject(rawData);
    if (jsonStr) {
      try {
        data = JSON.parse(jsonStr);
      } catch (e) {
        console.log('Failed to parse extracted JSON:', e.message);
      }
    }
  }
  
  // If we have valid data object, return it
  if (data && typeof data === 'object') {
    return data;
  }
  
  // Ultimate fallback: create from raw text
  return {
    rawExtraction: fallbackText || rawData,
    error: "Could not parse JSON"
  };
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
async function extractWithOllama(imageBase64) {
  console.log('Secure Mode: Processing with Ollama...');
  
  const model = 'moondream';
  
  // Build prompt
  const prompt = `${PROMPT}\n\nExtract all receipt data now. Return JSON only.`;
  
  try {
    console.log('Calling Ollama API (generate endpoint)...');
    
    // Remove data URI prefix if present, as Ollama expects raw base64
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    
    const resp = await ollamaRequest('/api/generate', {
      model: model,
      prompt: prompt,
      images: [base64Data],
      format: 'json',
      stream: false,
      options: { num_predict: 1500, temperature: 0.1 }
    }, 300000); // 300 seconds timeout
    
    const text = resp.response || '';
    console.log('Response received, length:', text.length);
    console.log('Response preview:', text.substring(0, 300));
    
    // Normalize and validate the response
    return normalizeReceiptData(text, text);
    
  } catch (err) {
    console.error('Ollama error:', err.message);
    throw new Error('Secure Mode failed: ' + err.message);
  }
}

module.exports = { extractWithOllama };