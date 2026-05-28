const { extractWithClaude } = require('../../lib/claudeVision');
const {
  parseReceiptText,
  extractWithOllamaFromText,
  createFallbackData,
  normalizeReceiptData
} = require('../../lib/ollamaLocal');
const { extractTextFromImage } = require('../../lib/ocr');
const { hasCloudModeCredentials } = require('../config/env');

async function readOcrPayload(imageBase64) {
  try {
    const ocrResult = await extractTextFromImage(imageBase64);

    if (ocrResult && typeof ocrResult === 'object' && ocrResult.rawText) {
      return {
        text: ocrResult.rawText,
        lines: ocrResult.rawTextLines || []
      };
    }

    if (typeof ocrResult === 'string') {
      return {
        text: ocrResult,
        lines: ocrResult.split('\n').map(value => value.trim()).filter(Boolean)
      };
    }
  } catch (error) {
    console.error('OCR Error:', error.message);
  }

  return { text: '', lines: [] };
}

function finalizeExtractionResult(extractionResult, ocrText) {
  let result = extractionResult;

  if (typeof result === 'string') {
    result = normalizeReceiptData(result, ocrText);
  }

  if (!result || typeof result !== 'object') {
    result = createFallbackData(ocrText || '');
  }

  const llmCleanLines = result?.rawTextLines;
  const isClean = Array.isArray(llmCleanLines) &&
    llmCleanLines.length > 0 &&
    !llmCleanLines[0]?.includes('See ae') &&
    !llmCleanLines[0]?.includes('===');

  const finalLines = isClean
    ? llmCleanLines
    : (ocrText || '').split('\n').map(line => line.trim()).filter(Boolean);

  result.rawTextLines = finalLines;
  result.rawText = finalLines.join('\n');

  return result;
}

async function extractReceiptData({ imageBase64, mode }) {
  const ocrResult = await readOcrPayload(imageBase64);
  const ocrText = ocrResult.text || '';
  const effectiveMode = mode || 'secure';
  let extractionResult;
  let lastError = null;

  if (effectiveMode === 'cloud') {
    if (!hasCloudModeCredentials()) {
      const error = new Error('Cloud mode requires a valid ANTHROPIC_API_KEY');
      error.statusCode = 400;
      error.details = 'Add your API key to .env.local or switch to Secure Mode';
      throw error;
    }

    try {
      extractionResult = await extractWithClaude(imageBase64);
    } catch (error) {
      lastError = error;
      if (!ocrText.trim()) {
        throw error;
      }

      try {
        extractionResult = await extractWithOllamaFromText(ocrText);
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError.message);
        throw lastError;
      }
    }
  } else {
    try {
      if (!ocrText.trim()) {
        throw new Error('OCR returned empty text');
      }

      extractionResult = await extractWithOllamaFromText(ocrText);
    } catch (error) {
      lastError = error;

      if (hasCloudModeCredentials()) {
        try {
          extractionResult = await extractWithClaude(imageBase64);
        } catch (fallbackError) {
          console.error('Fallback extraction also failed:', fallbackError.message);
          throw lastError;
        }
      } else {
        extractionResult = parseReceiptText(ocrText || '');
      }
    }
  }

  return finalizeExtractionResult(extractionResult, ocrText);
}

module.exports = { extractReceiptData };
