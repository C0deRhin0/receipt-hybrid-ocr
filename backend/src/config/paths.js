const fs = require('fs');
const path = require('path');

function getBackendRoot() {
  return path.resolve(__dirname, '../..');
}

function getProjectRoot() {
  return path.resolve(getBackendRoot(), '..');
}

function getFrontendRoot() {
  return path.join(getProjectRoot(), 'frontend');
}

function getEnvFilePath() {
  return path.join(getProjectRoot(), '.env.local');
}

function getPidFilePath() {
  return path.join(getProjectRoot(), '.server.pid');
}

function resolveStaticDistPath() {
  const legacyDistPath = path.join(getProjectRoot(), 'dist');
  const frontendDistPath = path.join(getFrontendRoot(), 'dist');

  if (fs.existsSync(frontendDistPath)) {
    return frontendDistPath;
  }

  if (fs.existsSync(legacyDistPath)) {
    return legacyDistPath;
  }

  return null;
}

module.exports = {
  getBackendRoot,
  getProjectRoot,
  getFrontendRoot,
  getEnvFilePath,
  getPidFilePath,
  resolveStaticDistPath
};
