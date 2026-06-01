const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
module.exports = defineConfig({
  plugins: [react()],
  root: 'frontend',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});
