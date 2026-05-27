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
    cloudModeReady: hasCloudModeCredentials()
  };
}

module.exports = {
  loadEnvironment,
  getRuntimeConfig,
  hasCloudModeCredentials
};
