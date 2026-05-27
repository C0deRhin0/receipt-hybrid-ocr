const express = require('express');
const cors = require('cors');
const { resolveStaticDistPath } = require('./config/paths');
const extractRoute = require('./http/routes/extract');
const sheetsRoute = require('./http/routes/sheets');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use('/api/extract', extractRoute);
  app.use('/api/sheets', sheetsRoute);

  const staticDistPath = resolveStaticDistPath();
  if (staticDistPath) {
    app.use(express.static(staticDistPath));
    app.use('/', (req, res) => {
      res.sendFile(`${staticDistPath}/index.html`);
    });
  }

  return app;
}

module.exports = { createApp };
