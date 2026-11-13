// DynamoDB store: the control plane keeps no state on disk because prod instances are replaced on every deploy.
// Credentials come from the EC2 instance role (no keys). Table: pushpad-deployments, partition key "id".
const SEVEN_DAYS = 7 * 24 * 3600;

function createDynamoStore({ table, region }) {
  // Required lazily so memory/mock mode never loads the AWS SDK.
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });

  // "ttl" lets DynamoDB delete old records on its own a week after expiry.
  const withTtl = (item) => ({ ...item, ttl: Math.floor(new Date(item.expiresAt).getTime() / 1000) + SEVEN_DAYS });

  const store = {
    kind: 'dynamodb',
    async put(item) {
      await doc.send(new PutCommand({ TableName: table, Item: withTtl(item) }));
      return item;
    },
    async get(id) {
      const out = await doc.send(new GetCommand({ TableName: table, Key: { id } }));
      return out.Item || null;
    },
    async mutate(id, fn) {
      const current = await store.get(id);
      if (!current) return null;
      const next = fn(current);
      if (!next) return current;
      await doc.send(new PutCommand({ TableName: table, Item: withTtl(next), ConditionExpression: 'attribute_exists(id)' }));
      return next;
    },
    // A scan is fine at this scale (a handful of records); revisit with a GSI if volume grows.
    async list() {
      const items = [];
      let key;
      do {
        const out = await doc.send(new ScanCommand({ TableName: table, ExclusiveStartKey: key }));
        items.push(...(out.Items || []));
        key = out.LastEvaluatedKey;
      } while (key);
      return items;
    },
  };
  return store;
}

module.exports = { createDynamoStore };
