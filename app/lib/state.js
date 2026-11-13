// Deployment state machine: the six pipeline stages and the allowed status transitions.
const STAGES = ['clone', 'detect', 'package', 'upload', 'apply', 'health'];

const STAGE_LABELS = {
  clone: 'Clone',
  detect: 'Detect',
  package: 'Package',
  upload: 'Upload',
  apply: 'Terraform apply',
  health: 'Health check',
};

const STATUSES = ['queued', 'running', 'live', 'failed', 'destroying', 'destroyed', 'expired'];

// These statuses still hold (or may hold) cloud resources, so they count toward capacity limits.
const ACTIVE = new Set(['queued', 'running', 'live', 'expired', 'destroying']);

const TRANSITIONS = {
  queued: ['running', 'failed', 'destroying', 'destroyed'],
  running: ['live', 'failed', 'destroying', 'destroyed'],
  live: ['expired', 'destroying', 'destroyed'],
  expired: ['destroying', 'destroyed'],
  failed: ['destroying', 'destroyed'],
  destroying: ['destroyed', 'failed'],
  destroyed: [],
};

const canTransition = (from, to) => from === to || (TRANSITIONS[from] || []).includes(to);

const newStages = () => STAGES.map((name) => ({ name, status: 'pending', startedAt: null, endedAt: null }));

module.exports = { STAGES, STAGE_LABELS, STATUSES, ACTIVE, TRANSITIONS, canTransition, newStages };
