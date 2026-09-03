const crypto = require('node:crypto');

class ExtractionCache {
  constructor() {
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    // Moving a hit to the end makes Map insertion order an inexpensive LRU.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return structuredClone(entry.value);
  }

  set(key, value, { ttlMs, maxEntries }) {
    if (ttlMs <= 0 || maxEntries <= 0) return;
    this.entries.delete(key);
    this.entries.set(key, {
      value: structuredClone(value),
      expiresAt: Date.now() + ttlMs
    });

    while (this.entries.size > maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }

  clear() {
    this.entries.clear();
  }
}

const extractionCache = new ExtractionCache();

function createExtractionCacheKey(imageBase64, mode) {
  const configFingerprint = [
    process.env.OCR_LANGUAGES || 'eng',
    process.env.OCR_PSM_DEFAULT || '3',
    process.env.OCR_PSM_RETRY || '6',
    process.env.OCR_MIN_CONFIDENCE || '70',
    process.env.OLLAMA_TEXT_MODEL || 'llama3.2:3b',
    process.env.VISION_MODEL || 'granite3.2-vision:2b',
    process.env.ENABLE_VISION_VERIFICATION || 'false'
  ].join('|');
  return crypto
    .createHash('sha256')
    .update('receipt-extraction-v1\0')
    .update(mode)
    .update('\0')
    .update(configFingerprint)
    .update('\0')
    .update(Buffer.from(imageBase64, 'base64'))
    .digest('hex');
}

module.exports = { ExtractionCache, extractionCache, createExtractionCacheKey };
