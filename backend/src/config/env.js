const dotenv = require('dotenv');
const { getEnvFilePath } = require('./paths');

function loadEnvironment() {
  dotenv.config({ path: getEnvFilePath() });
}

function hasCloudModeCredentials() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY !== 'sk-ant-api03-placeholder'
  );
}

function getRuntimeConfig() {
  return {
    host: process.env.HOST || '0.0.0.0',
    port: process.env.PORT || 5001,
    cloudModeReady: hasCloudModeCredentials(),
    localScanConcurrency: Math.max(1, Number.parseInt(process.env.LOCAL_SCAN_CONCURRENCY || '1', 10) || 1),
    ocrLanguages: process.env.OCR_LANGUAGES || 'eng',
    visionModel: process.env.VISION_MODEL || 'granite3.2-vision:2b',
    extractionCacheEnabled: process.env.EXTRACTION_CACHE_ENABLED !== 'false',
    extractionCacheTtlMs: Math.max(0, Number.parseInt(process.env.EXTRACTION_CACHE_TTL_SECONDS || '3600', 10) || 0) * 1000,
    extractionCacheMaxEntries: Math.max(0, Number.parseInt(process.env.EXTRACTION_CACHE_MAX_ENTRIES || '100', 10) || 0)
  };
}

module.exports = {
  loadEnvironment,
  getRuntimeConfig,
  hasCloudModeCredentials
};
