/**
 * Image preprocessing for receipt OCR using Sharp
 * Implements: Grayscale → Contrast → Threshold-like processing → Resize
 * Note: Full Canny+perspective transform requires Python OpenCV (see preprocess-python.js)
 */

const sharp = require('sharp');

/**
 * Preprocess image for better OCR results
 * @param {Buffer} imageBuffer - Raw image buffer
 * @returns {Promise<Buffer>} Preprocessed image buffer
 */
async function preprocessImageBuffer(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Get original dimensions
    const width = metadata.width;
    const height = metadata.height;
    
    // Resize if too small (OCR works better at larger sizes)
    let newWidth = width;
    let newHeight = height;
    
    if (width < 800) {
      // Scale up to at least 800px width
      const scale = 800 / width;
      newWidth = 800;
      newHeight = Math.round(height * scale);
    }
    
    // Process: grayscale, increase contrast, slight sharpen
    const processed = await image
      .grayscale()
      .linear(1.3, -30) // Increase contrast
      .resize(newWidth, newHeight, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3
      })
      .normalize() // Normalize brightness
      .toBuffer();
    
    return processed;
  } catch (err) {
    console.log('Preprocessing error:', err.message);
    return imageBuffer; // Return original on error
  }
}

/**
 * Preprocess base64 image
 * @param {string} base64Image - Base64 image (with or without data URL prefix)
 * @returns {Promise<string>} Preprocessed base64 image
 */
async function preprocessBase64(base64Image) {
  // Strip data URL prefix
  const clean = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(clean, 'base64');
  
  const processed = await preprocessImageBuffer(imageBuffer);
  
  // Re-encode as JPEG for better OCR
  const jpegBuffer = await sharp(processed)
    .jpeg({ quality: 90 })
    .toBuffer();
  
  return jpegBuffer.toString('base64');
}

module.exports = { preprocessImageBuffer, preprocessBase64 };