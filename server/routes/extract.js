const express = require('express');
const router = express.Router();
const { extractWithClaude } = require('../lib/claudeVision');
const { extractWithOllama } = require('../lib/ollamaLocal');

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
    const { imageBase64, mode } = req.body;

    if (!imageBase64) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: 'No image provided' });
    }

    let extractionResult;
    let lastError = null;

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
          extractionResult = await extractWithOllama(imageBase64);
        } catch (err2) {
          clearTimeout(timeoutId);
          throw lastError;
        }
      }
    } else {
      // Secure mode (default)
      try {
        extractionResult = await extractWithOllama(imageBase64);
      } catch (err) {
        lastError = err;
        // Try cloud as fallback if secure fails
        if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-api03-placeholder') {
          try {
            extractionResult = await extractWithClaude(imageBase64);
          } catch (err2) {
            clearTimeout(timeoutId);
            throw lastError;
          }
        } else {
          clearTimeout(timeoutId);
          throw lastError;
        }
      }
    }

    clearTimeout(timeoutId);
    if (!res.headersSent && !timeoutFired) {
      res.json(extractionResult);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Extraction Error:', error.message);
    if (!res.headersSent && !timeoutFired) {
      res.status(500).json({ 
        error: 'Failed to extract receipt data', 
        details: error.message 
      });
    }
  }
});

module.exports = router;