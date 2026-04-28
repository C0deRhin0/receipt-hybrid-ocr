const express = require('express');
const router = express.Router();
const { extractWithClaude } = require('../lib/claudeVision');
const { parseReceiptText, extractWithOllamaFromText, filterExtractionByOcr, createFallbackData, normalizeReceiptData } = require('../lib/ollamaLocal');
const { extractTextFromImage } = require('../lib/ocr');

// Request timeout - 300 seconds max (Local models can take several minutes)
const REQUEST_TIMEOUT = 300000;

router.post('/', async (req, res) => {
  let timeoutFired = false;
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      timeoutFired = true;
      res.status(504).json({ error: 'Request timeout', details: 'Processing took too long. Please try again.' });
    }
  }, REQUEST_TIMEOUT);

  try {
    if (!req.is('application/json')) {
      clearTimeout(timeoutId);
      return res.status(415).json({
        error: 'Unsupported content type',
        details: 'Expected application/json with imageBase64.'
      });
    }

    const { imageBase64, mode } = req.body;

    if (!imageBase64) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: 'No image provided' });
    }

    let extractionResult;
    let lastError = null;

    let ocrResult = null;
    try {
      ocrResult = await extractTextFromImage(imageBase64);
      
      // Handle both object and string returns (backwards compat)
      let ocrText = '';
      let ocrLines = [];
      
      if (ocrResult && typeof ocrResult === 'object' && ocrResult.rawText) {
        ocrText = ocrResult.rawText;
        ocrLines = ocrResult.rawTextLines || [];
      } else if (typeof ocrResult === 'string') {
        ocrText = ocrResult;
        ocrLines = ocrResult.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      }
      
      if (!ocrText || ocrText.trim().length === 0) {
        throw new Error('OCR returned empty text');
      }
      
      // Return early - will be combined below
      ocrResult = { text: ocrText, lines: ocrLines };
    } catch (err) {
      console.error('OCR Error:', err.message);
      ocrResult = { text: '', lines: [] };
    }

    // Use OCR result
    const ocrText = ocrResult?.text || '';
    const ocrLines = ocrResult?.lines || [];

    // Determine mode - default to secure (local) if not specified
    const effectiveMode = mode || 'secure';
    
    if (effectiveMode === 'cloud') {
      // Cloud mode - check API key first
      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-api03-placeholder') {
        clearTimeout(timeoutId);
        return res.status(400).json({ 
          error: 'Cloud mode requires a valid ANTHROPIC_API_KEY',
          details: 'Add your API key to .env.local or switch to Secure Mode'
        });
      }
      
      try {
        extractionResult = await extractWithClaude(imageBase64);
      } catch (err) {
        lastError = err;
        // Try secure as fallback if cloud fails
        try {
          if (!ocrText || ocrText.trim().length === 0) {
            throw new Error('OCR text unavailable for secure fallback');
          }
          extractionResult = await extractWithOllamaFromText(ocrText);
        } catch (err2) {
          console.error('Fallback extraction also failed:', err2.message);
          clearTimeout(timeoutId);
          throw lastError;
        }
      }
    } else {
      // Secure mode (default)
      try {
        if (!ocrText || ocrText.trim().length === 0) {
          throw new Error('OCR returned empty text');
        }
        extractionResult = await extractWithOllamaFromText(ocrText);
      } catch (err) {
        lastError = err;
        // Try cloud as fallback if secure fails
        if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-api03-placeholder') {
          try {
            extractionResult = await extractWithClaude(imageBase64);
          } catch (err2) {
            console.error('Fallback extraction also failed:', err2.message);
            clearTimeout(timeoutId);
            throw lastError;
          }
        } else {
          // If no cloud fallback, return OCR-only fallback
          extractionResult = parseReceiptText(ocrText || '');
        }
      }
    }

    clearTimeout(timeoutId);
    if (timeoutFired || res.headersSent) {
      return;
    }

    // Final normalization pass for safety
    if (typeof extractionResult === 'string') {
      extractionResult = normalizeReceiptData(extractionResult, ocrText);
    }

    if (!extractionResult || typeof extractionResult !== 'object') {
      extractionResult = createFallbackData(ocrText || '');
    }

    // USE LLM's cleaned rawTextLines for BOTH rawTextLines and rawText
    const llmCleanLines = extractionResult?.rawTextLines;
    const isClean = llmCleanLines && Array.isArray(llmCleanLines) && llmCleanLines.length > 0 && 
      !llmCleanLines[0]?.includes('See ae') && 
      !llmCleanLines[0]?.includes('===');
    
    // Use LLM cleaned lines - this goes to BOTH Raw OCR and Structured displays
    const finalLines = isClean ? llmCleanLines : ((ocrText || '').split('\n').map(line => line.trim()).filter(Boolean));
    const finalText = finalLines.join('\n');
    
    extractionResult.rawTextLines = finalLines;
    extractionResult.rawText = finalText;

    // Return cleaned output
    return res.json(extractionResult);
  } catch (error) {
    clearTimeout(timeoutId);
    if (timeoutFired || res.headersSent) {
      return;
    }

    console.error('Extraction Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to extract receipt data', 
      details: error.message 
    });
  }
});

module.exports = router;