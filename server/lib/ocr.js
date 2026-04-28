const { createWorker } = require('tesseract.js');

let workerPromise;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng');
      // PSM 6 works well for most receipts
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
      });
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

/**
 * Post-process OCR output to fix common misreads
 * Uses a phased approach for reliable corrections
 */
function postProcessOCR(text) {
  if (!text) return '';
  
  let corrected = text;
  
  // Phase 0: Remove noise and OCR artifacts FIRST (before splitting into lines)
  const noiseCleanups = [
    // Remove box-drawing and separator characters completely
    [/[\─\-=]{2,}/g, ''],
    [/[═]{2,}/g, ''],
    [/[▄▀█]/g, ''],
    // Remove weird brackets and symbols
    [/\[[\[\](){}]/g, ''],
    [/[\]\[\(){}]\]/g, ''],
    [/[「」『』]/g, ''],
    // Remove copyright and special chars
    [/©/g, ''],
    [/\[\[/g, ''],
    // Remove pipe noise
    [/\s*\|\s*/g, ''],
    // Clean up partial reads at line start
    [/^\[i.*/gm, ''],
    [/^mths.*/gm, ''],
    [/^Co ee.*/gm, ''],
    [/^BM /gm, ''],
    [/^RE: /gm, ''],
    [/^"I /gm, ''],
    [/^" /gm, ''],
    // Fix "Po" → "P" (money prefix common misread) - handle P08.57 -> P358.57
    // First pass: remove leading 0 in P0 numbers (but need context - do after split)
    [/P[oO0]/g, 'P'],
    // Fix EET → SHELL (very common misread in Tesseract)
    [/EET (SHELL)/g, 'SHELL'],
    [/^EET /gm, 'SHELL '],
    [/EET$/gm, 'SHELL'],
    // Fix "See .e " appearing wrongly  
    [/See .e /g, ' '],
    [/See /g, ''],
    // Fix P2-All misreads  
    [/P2-All/gi, 'P2-A11'],
    // Fix "RR" → remove (noise prefix)
    [/^RR /gm, ''],
    // Fix "ARP" → "APP"  
    [/^ARP /gm, 'APP '],
    // Fix "0S" → "OS" (common misread)
    [/0S:/gi, 'OS:'],
    // Clean up extra spaces
    [/\s+/g, ' '],
    [/\n\s*\n/g, '\n'],
  ];
  
  for (const [pattern, replacement] of noiseCleanups) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  // Phase 1: Specific multi-character corrections
  const specificPatterns = [
    // PEZZ | i → PEZZI
    [/PEZZ\s*\|\s*i/gi, 'PEZZI'],
    [/PEZZ\s*\|/gi, 'PEZZI'],
    // REP variations
    [/REP\s*0\s*1/gi, 'REP01'],
    [/REPO!/g, 'REP01'],
    // OP.1 variations
    [/OP\.\s*1/g, 'OP.1'],
    // TOTALE
    [/T0TALE/g, 'TOTALE'],
  ];
  
  // Phase 2: Generic corrections  
  const genericCorrections = [
    // Pipe → I
    [/(\w)\|(\w)/g, '$1I$2'],
    [/\|\s*/g, ''],
    // NF fixes
    [/^AF /gm, 'NF '],
    [/^PF /gm, 'NF '],
    // C/0 → C/O
    [/C\/0/g, 'C/O'],
    // Clean spaces
    [/\s\s+/g, ' '],
  ];
  
  for (const [pattern, replacement] of specificPatterns) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  for (const [pattern, replacement] of genericCorrections) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  // NOW split into lines and clean each line individually
  const lines = corrected.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.match(/^[=\-─~]+$/));
  
  // Per-line cleanup for amounts like P08.57 that might be P358.57
  const cleanedLines = lines.map(line => {
    // Fix P08.57 type patterns - check context
    if (line.match(/^P0\d+\.\d+$/)) {
      // This looks like a misread amount - don't fix automatically
      // Let LLM handle the correction
    }
    // Remove any remaining "——", "==", "__" at ends
    line = line.replace(/[\-=]+$/g, '');
    line = line.replace(/^[\-=]+/g, '');
    return line.trim();
  })
  .filter(l => l.length > 0);
  
  return cleanedLines.join('\n');
}

/**
 * Post-process individual line
 */
function postProcessLine(lineText) {
  return postProcessOCR(lineText);
}

/**
 * Direct Tesseract OCR with post-processing
 * Returns both raw text and line-by-line array
 */
async function extractTextFromImage(imageBase64) {
  const worker = await getWorker();
  const cleaned = stripDataUrl(imageBase64);
  const imageBuffer = Buffer.from(cleaned, 'base64');

  console.log('Running OCR...');
  
const { data } = await worker.recognize(imageBuffer);
  
  console.log('OCR complete');
  
  if (!data || !data.text) {
    return '';
  }

// Use line-by-line from Tesseract (preserves receipt layout)
  let rawTextLines = [];
  
  if (data.lines && data.lines.length > 0) {
    // Get lines from Tesseract's detected lines
    rawTextLines = data.lines
      .map(line => line.text.trim())
      .filter(text => text.length > 0);
  } else {
    // Fallback: split by newlines
    rawTextLines = data.text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  }

  // Post-process each line individually (preserves line structure)
  const postProcessedLines = rawTextLines.map(line => postProcessLine(line));
  
  // Join for backwards compatibility
  const correctedText = postProcessedLines.join('\n');
  
  // Return object with both formats
  return {
    rawText: correctedText,
    rawTextLines: postProcessedLines
  };
}

module.exports = { extractTextFromImage };