const express = require('express');
const { appendReceiptData } = require('../../services/sheets.service');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await appendReceiptData(req.body);
    res.json(result);
  } catch (error) {
    console.error('Sheets Error:', error);
    res.status(500).json({ error: 'Failed to push to Google Sheets', details: error.message });
  }
});

module.exports = router;
