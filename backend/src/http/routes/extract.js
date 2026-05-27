const express = require('express');
const router = express.Router();
const { extractReceiptData } = require('../../services/receipt-extraction.service');

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

    const extractionResult = await extractReceiptData({ imageBase64, mode });

    clearTimeout(timeoutId);
    if (timeoutFired || res.headersSent) {
      return;
    }

    // Return cleaned output
    return res.json(extractionResult);
  } catch (error) {
    clearTimeout(timeoutId);
    if (timeoutFired || res.headersSent) {
      return;
    }

    console.error('Extraction Error:', error.message);
    return res.status(error.statusCode || 500).json({ 
      error: 'Failed to extract receipt data', 
      details: error.details || error.message 
    });
  }
});

module.exports = router;
