const { google } = require('googleapis');

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
  } catch (error) {
    console.error('Failed to parse Google credentials:', error.message);
    return null;
  }
}

function buildRowData(data) {
  const rowData = [new Date().toISOString()];
  const scalarFields = [];
  const itemsStr = [];

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        if (itemsStr.length === 0 || key.toLowerCase() === 'items') {
          value.forEach(item => {
            if (typeof item === 'object' && item !== null) {
              const itemParts = Object.entries(item).map(([itemKey, itemValue]) => `${itemKey}: ${itemValue}`);
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
        const itemParts = Object.entries(item).map(([itemKey, itemValue]) => `${itemKey}: ${itemValue}`);
        itemsStr.push(`{ ${itemParts.join(', ')} }`);
      } else {
        itemsStr.push(String(item));
      }
    });
  }

  rowData.push(scalarFields.join('\n'));
  rowData.push(itemsStr.join('\n'));

  return rowData;
}

async function appendReceiptData(data) {
  const sheets = getSheetsClient();
  if (!sheets) {
    return {
      success: false,
      message: 'Google Sheets not configured. Set GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEET_ID in .env'
    };
  }

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Sheet1!A:A',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [buildRowData(data)]
    }
  });

  return {
    success: true,
    message: 'Successfully pushed to Google Sheets',
    updatedRange: response.data.updatedRange
  };
}

module.exports = { appendReceiptData };
