// Default wiring from environment: store, settings, Jenkins client, mock mode.
const config = require('./config');
const mock = require('./mock');
const { createStore } = require('./store');
const { createSettings } = require('./settings');
const { createJenkins } = require('./jenkins');
const { createService } = require('./service');
const { buildApp } = require('./app');

function createDefaultApp() {
  // Local demos in mock mode use a fixed access code unless ACCESS_CODE is set.
  if (config.mock && !process.env.ACCESS_CODE) process.env.ACCESS_CODE = 'demo';
  const store = createStore(config);
  const settings = createSettings({ awsMode: config.awsMode, region: config.region });
  const jenkins = createJenkins({ settings, config });
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const service = createService({ store, settings, jenkins, config, mock, baseUrl });
  const app = buildApp({ service, config, settings });
  return { app, service, store, config };
}

module.exports = { createDefaultApp };
