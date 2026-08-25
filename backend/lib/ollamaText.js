const { requestJson, parseJson, VISION_SCHEMA } = require('./ollamaVision');

const TEXT_STRUCTURE_PROMPT = `You are a precise document-data extraction engine.

The OCR text below is the only source of truth. Extract every clearly supported receipt/document detail into the required JSON schema.
- fields must be a labeled array: one entry for merchant, address, merchant ID, terminal ID, payment channel, card type, card number, transaction type, batch/trace/reference/transaction numbers, approval code, date/time, amount, cryptographic IDs, app label, AID, OS, model, and any other labeled details actually present.
- Preserve the OCR value exactly. Do not repair, infer, or invent characters. If a value is ambiguous, omit it and add a warning.
- Do not return a summary. Do not use generic labels such as "value" or "document summary".
- Extract lineItems only if the OCR clearly contains purchased-item rows.
- Return no more than 30 fields and keep evidence to the exact OCR line.

Follow this JSON Schema exactly:
${JSON.stringify(VISION_SCHEMA)}

OCR TEXT:
`;

async function extractWithText(ocrText) {
  const response = await requestJson('/api/chat', {
    model: process.env.OLLAMA_TEXT_MODEL || 'llama3.2:3b',
    messages: [{ role: 'user', content: `${TEXT_STRUCTURE_PROMPT}${ocrText || '(No OCR text available)'}` }],
    format: VISION_SCHEMA,
    stream: false,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE || '0',
    options: {
      temperature: 0,
      num_predict: Number.parseInt(process.env.TEXT_MAX_TOKENS || '700', 10) || 700
    }
  });
  return parseJson(response?.message?.content);
}

module.exports = { extractWithText };
