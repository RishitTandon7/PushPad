// One place for every limit and mode flag. Limits live in config/limits.json (Jenkins scripts read the same file).
const limits = require('../config/limits.json');

const env = process.env;
const asBool = (value, fallback) => (value === undefined || value === '' ? fallback : value === 'true');

// Mock mode simulates a full deployment with timers: no Jenkins, no AWS.
const mock = env.MOCK_MODE !== undefined
  ? env.MOCK_MODE === 'true'
  : env.PUSHPAD_MODE !== 'aws' && !env.JENKINS_URL;

module.exports = {
  ...limits,
  // The free-tier gate: when on, deploying needs the access code (from SSM, or ACCESS_CODE locally).
  requireAccessCode: asBool(env.REQUIRE_ACCESS_CODE, limits.requireAccessCode),
  mock,
  awsMode: env.PUSHPAD_MODE === 'aws',
  region: env.AWS_REGION || 'us-east-1',
  table: env.DEPLOYMENTS_TABLE || '',
  jenkinsDeployJob: env.JENKINS_DEPLOY_JOB || 'pushpad-deploy',
  jenkinsDestroyJob: env.JENKINS_DESTROY_JOB || 'pushpad-destroy',
  mockStepMs: Number(env.MOCK_STEP_MS || 1400),
  recentListSize: 8,
  logLinesKept: 40,
};
