// Settings: environment variables first (local dev), then SSM Parameter Store (/pushpad/<name>) in AWS mode. Never logged.
const ENV_NAMES = {
  'jenkins-url': 'JENKINS_URL',
  'jenkins-user': 'JENKINS_USER',
  'jenkins-token': 'JENKINS_TOKEN',
  'callback-secret': 'CALLBACK_SECRET',
  'access-code': 'ACCESS_CODE',
  'public-base-url': 'PUBLIC_BASE_URL',
};

function createSettings({ awsMode, region, env = process.env, cacheMs = 5 * 60 * 1000, ssmClient } = {}) {
  const cache = new Map();
  let client = ssmClient;

  async function fromSsm(name) {
    if (!client) {
      const { SSMClient } = require('@aws-sdk/client-ssm');
      client = new SSMClient({ region });
    }
    const { GetParameterCommand } = require('@aws-sdk/client-ssm');
    const out = await client.send(new GetParameterCommand({ Name: `/pushpad/${name}`, WithDecryption: true }));
    return out.Parameter && out.Parameter.Value;
  }

  return {
    async get(name) {
      const envName = ENV_NAMES[name];
      if (!envName) throw new Error('unknown setting');
      if (env[envName]) return env[envName];
      if (!awsMode && !ssmClient) return undefined;
      const hit = cache.get(name);
      if (hit && Date.now() - hit.at < cacheMs) return hit.value;
      try {
        const value = await fromSsm(name);
        cache.set(name, { value, at: Date.now() });
        return value;
      } catch {
        return undefined;     // missing parameter or no permission: callers treat it as "not configured"
      }
    },
  };
}

module.exports = { createSettings, ENV_NAMES };
