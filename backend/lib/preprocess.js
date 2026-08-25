/**
 * Image preprocessing for receipt OCR using Sharp
 * Implements: Grayscale → Contrast → Threshold-like processing → Resize
 * Note: Full Canny+perspective transform requires Python OpenCV (see preprocess-python.js)
 */

const sharp = require('sharp');

const MAX_LONG_SIDE = 1920;
// Phone images commonly exceed 12 MP (for example 4032 × 3024). Accept them,
// then immediately reduce the working image before OCR/VLM inference.
const DEFAULT_MAX_INPUT_PIXELS = 48_000_000;

function maxInputPixels() {
  return Number.parseInt(process.env.MAX_INPUT_PIXELS || String(DEFAULT_MAX_INPUT_PIXELS), 10) || DEFAULT_MAX_INPUT_PIXELS;
}

/**
 * Find a large, light paper-like region using a tiny preview. This is a
 * deliberately cheap crop heuristic for photographed receipts; it is skipped
 * when no convincing document region exists, so scans/PDF-like images remain
 * untouched. It avoids OpenCV and its additional runtime/memory cost.
 */
async function detectLightDocumentCrop(image, metadata) {
  const { data, info } = await image.clone()
    .rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let best = null;

  for (let start = 0; start < total; start += 1) {
    if (visited[start]) continue;
    const pixel = start * channels;
    const brightness = (data[pixel] + data[pixel + 1] + data[pixel + 2]) / 3;
    if (brightness < 175) { visited[start] = 1; continue; }

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let count = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      count += 1;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const neighbours = [index - width, index + width, index - 1, index + 1];
      for (const next of neighbours) {
        if (next < 0 || next >= total || visited[next]) continue;
        // Prevent horizontal wrapping at image edges.
        if ((next === index - 1 && x === 0) || (next === index + 1 && x === width - 1)) continue;
        const nextPixel = next * channels;
        const nextBrightness = (data[nextPixel] + data[nextPixel + 1] + data[nextPixel + 2]) / 3;
        if (nextBrightness >= 175) {
          visited[next] = 1;
          queue[tail++] = next;
        } else {
          visited[next] = 1;
        }
      }
    }
    if (!best || count > best.count) best = { count, minX, minY, maxX, maxY };
  }

  if (!best || best.count < total * 0.03) return null;
  const previewBoxWidth = best.maxX - best.minX + 1;
  const previewBoxHeight = best.maxY - best.minY + 1;
  if (previewBoxWidth < width * 0.2 || previewBoxHeight < height * 0.25) return null;

  const scaleX = metadata.width / width;
  const scaleY = metadata.height / height;
  const paddingX = Math.round(previewBoxWidth * scaleX * 0.08);
  const paddingY = Math.round(previewBoxHeight * scaleY * 0.04);
  const left = Math.max(0, Math.floor(best.minX * scaleX) - paddingX);
  const top = Math.max(0, Math.floor(best.minY * scaleY) - paddingY);
  const right = Math.min(metadata.width, Math.ceil((best.maxX + 1) * scaleX) + paddingX);
  const bottom = Math.min(metadata.height, Math.ceil((best.maxY + 1) * scaleY) + paddingY);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Decode, orient and bound an uploaded image before it reaches OCR or a VLM.
 * This deliberately does not threshold the image: aggressive thresholding often
 * removes faint thermal-receipt characters and harms vision models.
 */
async function prepareImageBuffer(imageBuffer) {
  const image = sharp(imageBuffer, { limitInputPixels: maxInputPixels() });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Image has no readable dimensions');
  const crop = await detectLightDocumentCrop(image, metadata);

  let pipeline = image.rotate();
  if (crop) pipeline = pipeline.extract(crop);
  const buffer = await pipeline
    .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return { buffer, mimeType: 'image/jpeg', metadata, crop };
}

/**
 * Make a bounded OCR input without applying document detection/cropping.
 *
 * Cropping is helpful for very large phone photos and visual models, but a
 * close-up receipt can have a pale edge that confuses a lightweight paper
 * detector. OCR should therefore retain the complete frame while still
 * bounding decode/inference memory.
 */
async function prepareOcrImageBuffer(imageBuffer) {
  const image = sharp(imageBuffer, { limitInputPixels: maxInputPixels() });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Image has no readable dimensions');
  const crop = await detectLightDocumentCrop(image, metadata);
  const widthRatio = crop ? crop.width / metadata.width : 1;
  const heightRatio = crop ? crop.height / metadata.height : 1;
  // A crop that trims each axis by roughly the same amount is a reliable
  // document isolation. A strongly one-sided crop is often a false paper
  // boundary (for example, a narrow receipt on a light background) and can
  // confuse automatic layout segmentation, so keep the original frame.
  const useDocumentCrop = Boolean(crop && Math.abs(widthRatio - heightRatio) <= 0.15);

  let pipeline = image.rotate();
  if (useDocumentCrop) pipeline = pipeline.extract(crop);
  const buffer = await pipeline
    .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: 'inside', withoutEnlargement: true })
    // Match the stable encoding used by the document crop path. OCR can be
    // surprisingly sensitive to tiny JPEG edge changes in thermal text.
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return { buffer, mimeType: 'image/jpeg', metadata, crop, usedDocumentCrop: useDocumentCrop };
}

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

module.exports = { preprocessImageBuffer, preprocessBase64, prepareImageBuffer, prepareOcrImageBuffer };
