const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

// Parse Google Sheets credentials from env
function getSheetsClient() {
  const creds = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  
  if (!creds || !sheetId) {
    return null;
  }
  
  try {
    const credentials = JSON.parse(creds);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    return google.sheets({ version: 'v4', auth });
  } catch (err) {
    console.error('Failed to parse Google credentials:', err.message);
    return null;
  }
}

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const { vendorName, date, items, subtotal, vat, total } = data;
    
    const sheets = getSheetsClient();
    
    if (!sheets) {
      // Return placeholder response if not configured
      return res.json({ 
        success: false, 
        message: 'Google Sheets not configured. Set GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEET_ID in .env' 
      });
    }
    
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    // Build row data dynamically
    const rowData = [
      new Date().toISOString() // Timestamp
    ];
    
    // Convert data to a simple string representation for the sheet
    let scalarFields = [];
    let itemsStr = [];
    
    if (typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          if (itemsStr.length === 0 || key.toLowerCase() === 'items') {
            value.forEach(item => {
              if (typeof item === 'object' && item !== null) {
                const itemParts = Object.entries(item).map(([k, v]) => `${k}: ${v}`);
                itemsStr.push(`{ ${itemParts.join(', ')} }`);
              } else {
                itemsStr.push(String(item));
              }
            });
          }
        } else {
          scalarFields.push(`${key}: ${typeof value === 'object' && value !== null ? JSON.stringify(value) : value}`);
        }
      }
    } else if (Array.isArray(data)) {
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          const itemParts = Object.entries(item).map(([k, v]) => `${k}: ${v}`);
          itemsStr.push(`{ ${itemParts.join(', ')} }`);
        } else {
          itemsStr.push(String(item));
        }
      });
    }

    rowData.push(scalarFields.join('\n'));
    rowData.push(itemsStr.join('\n'));
    
    // Append to sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:A',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData]
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Successfully pushed to Google Sheets',
      updatedRange: response.data.updatedRange
    });
  } catch (error) {
    console.error('Sheets Error:', error);
    res.status(500).json({ error: 'Failed to push to Google Sheets', details: error.message });
  }
});

module.exports = router;