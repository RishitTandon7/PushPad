// Pick the store: DynamoDB when a table is configured, otherwise in memory.
const { createMemoryStore } = require('./memory');

function createStore(config) {
  if (config.table && !config.mock) {
    const { createDynamoStore } = require('./dynamo');
    return createDynamoStore({ table: config.table, region: config.region });
  }
  return createMemoryStore();
}

module.exports = { createStore };
