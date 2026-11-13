// Mock mode: simulates Jenkins by sending the same callbacks a real build would, so the UI works with no Jenkins or AWS.
// Tip: a repo whose name contains "fail" fails at the Detect stage, to show the error state.
const { STAGES } = require('./state');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCRIPT = {
  clone: (d) => [`Cloning ${d.repo} (${d.branch}), shallow`, 'Cloned 14 files'],
  detect: (d) => (d.appType === 'node' ? ['Found package.json with a start script', 'Project type: node'] : ['Found index.html', 'Project type: static']),
  package: () => ['Zipping source only (no install, no code run)', 'Package size 0.3 MB'],
  upload: (d) => [`Uploading to deployments/${d.id}/`, 'Upload complete'],
  apply: (d) => ['terraform workspace new d-' + d.id, 'Creating 1 small EC2 instance', 'Apply complete: 4 added'],
  health: () => ['Waiting for the site to answer on port 80', 'GET / returned 200'],
};

const guessType = (d) => (/node|express|api|server/i.test(d.repo + d.subdir) ? 'node' : 'static');

// Fire-and-forget; errors are swallowed because a mock run must never crash the server.
async function simulateDeploy(deployment, applyCallback, { stepMs, baseUrl }) {
  const d = { ...deployment, appType: guessType(deployment) };
  try {
    for (const stage of STAGES) {
      await sleep(stepMs / 3);
      await applyCallback({ deployId: d.id, stage, status: 'running', logs: [`> ${stage}`], appType: stage === 'detect' ? d.appType : undefined });
      await sleep(stepMs);
      if (stage === 'detect' && /fail/i.test(d.repo)) {
        await applyCallback({ deployId: d.id, stage, status: 'failed', message: 'No index.html or package.json with a start script was found.', logs: ['ERROR: unsupported project'] });
        return;
      }
      await applyCallback({ deployId: d.id, stage, status: 'done', logs: SCRIPT[stage](d) });
    }
    await applyCallback({ deployId: d.id, status: 'live', url: `${baseUrl}/mock/${d.id}`, instanceId: 'i-mock' + d.id, logs: ['Live at ' + `${baseUrl}/mock/${d.id}`] });
  } catch { /* ignore */ }
}

async function simulateDestroy(id, applyCallback, { stepMs }) {
  try {
    await sleep(stepMs);
    await applyCallback({ deployId: id, status: 'destroyed', logs: ['terraform destroy complete', 'Deleted deployments/' + id + '/'] });
  } catch { /* ignore */ }
}

module.exports = { simulateDeploy, simulateDestroy };
