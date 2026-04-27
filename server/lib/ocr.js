const { createWorker } = require('tesseract.js');

let workerPromise;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng');
      return worker;
    })();
  }

  return workerPromise;
}

function stripDataUrl(base64) {
  if (!base64) return '';
  const commaIndex = base64.indexOf(',');
  if (commaIndex !== -1) {
    return base64.substring(commaIndex + 1);
  }
  return base64;
}

async function extractTextFromImage(imageBase64) {
  const worker = await getWorker();
  const cleaned = stripDataUrl(imageBase64);
  const imageBuffer = Buffer.from(cleaned, 'base64');

  const { data } = await worker.recognize(imageBuffer);
  return data?.text || '';
}

module.exports = { extractTextFromImage };
