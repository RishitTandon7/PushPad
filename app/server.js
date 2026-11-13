// PushPad control plane: static site + deployment API (see lib/ and routes/).
const { createDefaultApp } = require('./lib/compose');

const { app, service, config, store } = createDefaultApp();

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`PushPad listening on ${port} (${config.mock ? 'MOCK mode' : 'AWS mode'}, store: ${store.kind})`);
    if (config.mock && config.requireAccessCode && !process.env.ACCESS_CODE) {
      console.log('Mock mode: set ACCESS_CODE to choose the access code (default for local demos: "demo")');
    }
  });
  // Mark deployments expired even when nobody is watching.
  setInterval(() => service.sweep().catch(() => {}), 30 * 1000).unref();
}

module.exports = app;
