const { createWorker } = require('tesseract.js');
const { preprocessImageBuffer } = require('./preprocess');

let workerPromise;

function getConfig() {
  return {
    languages: process.env.OCR_LANGUAGES || 'eng',
    // Automatic layout segmentation handles photographed receipts with a
    // surrounding background or watermark much better than a forced text block.
    defaultPsm: process.env.OCR_PSM_DEFAULT || '3',
    retryPsm: process.env.OCR_PSM_RETRY || '6',
    // Below this level, a different segmentation pass is often worthwhile.
    // It catches otherwise clear but low-contrast/sparse receipts without
    // paying for two passes on strong scans.
    minConfidence: Number.parseInt(process.env.OCR_MIN_CONFIDENCE || '70', 10) || 70
  };
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(getConfig().languages).catch(error => {
      workerPromise = undefined;
      throw error;
    });
  }
  return workerPromise;
}

function stripDataUrl(base64) {
  if (!base64) return '';
  const commaIndex = base64.indexOf(',');
  return commaIndex === -1 ? base64 : base64.substring(commaIndex + 1);
}

function toLines(data) {
  return (data.lines?.length ? data.lines : String(data.text || '').split('\n').map(text => ({ text })))
    .map(line => String(line.text || '').trim())
    .filter(Boolean);
}

function summarize(data) {
  const words = (data.words || [])
    .filter(word => String(word.text || '').trim())
    .map(word => ({
      text: String(word.text).trim(),
      confidence: Number(word.confidence || 0),
      bbox: word.bbox || null
    }));
  const confidence = words.length
    ? Math.round(words.reduce((sum, word) => sum + word.confidence, 0) / words.length)
    : Math.round(Number(data.confidence || 0));

  return { text: String(data.text || '').trim(), lines: toLines(data), words, confidence };
}

function hasFragmentedNumericLines(lines) {
  // Multiple number-only lines in an otherwise text-heavy document usually
  // mean the automatic layout pass detached labels from their values. This is
  // a generic signal for trying the alternate segmentation mode; it is not a
  // receipt-specific vocabulary rule.
  const numericOnly = lines.filter(line => /^[#€$£]?\s*\d[\d ,.-]*$/.test(String(line).trim())).length;
  return lines.length >= 6 && numericOnly >= 2;
}

async function recognize(worker, imageBuffer, psm) {
  await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
  const { data } = await worker.recognize(imageBuffer);
  return summarize(data || {});
}

/**
 * Literal OCR only. Semantic correction belongs to the evidence-aware
 * reconciliation layer; raw OCR must remain auditable and unchanged.
 */
async function extractTextFromImage(imageBase64) {
  const cleaned = stripDataUrl(imageBase64);
  if (!cleaned || !/^[A-Za-z0-9+/=\s]+$/.test(cleaned)) {
    const error = new Error('Image must be valid base64 data');
    error.statusCode = 400;
    throw error;
  }

  const imageBuffer = Buffer.from(cleaned, 'base64');
  if (!imageBuffer.length) throw new Error('Image is empty');

  const worker = await getWorker();
  const config = getConfig();
  let best = await recognize(worker, imageBuffer, config.defaultPsm);
  let usedEnhancedRetry = false;

  // A second pass costs CPU, so only use it for a weak first result.
  if (best.confidence < config.minConfidence || best.lines.length < 2 || hasFragmentedNumericLines(best.lines)) {
    const enhanced = await preprocessImageBuffer(imageBuffer);
    const retry = await recognize(worker, enhanced, config.retryPsm);
    usedEnhancedRetry = true;
    if (retry.confidence > best.confidence || (retry.confidence === best.confidence && retry.text.length > best.text.length)) {
      best = retry;
    }
  }

  return {
    rawText: best.text,
    rawTextLines: best.lines,
    words: best.words,
    confidence: best.confidence,
    usedEnhancedRetry
  };
}

async function terminateWorker() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = undefined;
}

module.exports = { extractTextFromImage, stripDataUrl, terminateWorker };
