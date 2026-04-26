const Anthropic = require('@anthropic-ai/sdk');

const PROMPT = `Extract ALL details from this receipt.
Extract all key-value pairs you can identify. Do NOT use a fixed schema. Name the keys based on what is on the receipt (e.g. "Merchant", "Date", "Tax ID", "Subtotal", "Total").
If there is a list of items purchased, extract them as an array of objects under an 'items' key.
Return ONLY valid JSON.`;

/**
 * Extracts receipt information using Anthropic's Claude Vision API
 * @param {string} imageBase64 - Base64 encoded image
 * @returns {Promise<Object>} JSON object containing extracted data
 */
async function extractWithClaude(imageBase64) {
  console.log('Routing extraction to Cloud Mode (Claude Vision API)...');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Cloud mode requires ANTHROPIC_API_KEY. Add it to .env.local file.');
  }
  
  // Support custom API base URL (for company endpoints)
  const baseURL = process.env.ANTHROPIC_API_BASE_URL || undefined;
  
  const clientConfig = { apiKey };
  if (baseURL) {
    clientConfig.baseURL = baseURL;
  }
  
  const client = new Anthropic(clientConfig);
  
  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: PROMPT
            }
          ]
        }
      ]
    });
    
    // Extract JSON from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }
    
    // Parse the JSON from the text response
    const text = content.text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    
    if (jsonStart === -1) {
      // Try a more lenient parse - maybe it's wrapped in markdown
      const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*})\s*```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]);
      }
      throw new Error('Could not parse JSON from Claude response. The image may not be a receipt.');
    }
    
    const jsonStr = text.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Claude Vision error:', err.message);
    
    // If Claude fails due to invalid image, return a clear error
    if (err.message.includes('invalid_image') || err.message.includes('Unsupported')) {
      throw new Error('Could not process this image. Please upload a clear receipt photo.');
    }
    
    throw err;
  }
}

module.exports = { extractWithClaude };