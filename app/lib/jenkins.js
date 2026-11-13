// Jenkins REST client: starts the parameterized deploy and destroy jobs. URL and API token come from settings (SSM in AWS).
async function post(url, { user, token, body }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
      signal: ctrl.signal,
    });
    if (res.status >= 300) throw new Error('jenkins responded ' + res.status);
  } finally {
    clearTimeout(timer);
  }
}

function createJenkins({ settings, config }) {
  async function trigger(job, params) {
    const [base, user, token] = await Promise.all([settings.get('jenkins-url'), settings.get('jenkins-user'), settings.get('jenkins-token')]);
    if (!base || !user || !token) throw new Error('jenkins is not configured');
    const url = `${base.replace(/\/+$/, '')}/job/${encodeURIComponent(job)}/buildWithParameters`;
    await post(url, { user, token, body: params });
  }
  return {
    // Every value is passed as a job parameter; the pipeline re-validates and quotes them before using them.
    triggerDeploy: (d) => trigger(config.jenkinsDeployJob, { DEPLOY_ID: d.id, REPO_URL: d.repoUrl, BRANCH: d.branch, SUBDIR: d.subdir || '' }),
    triggerDestroy: (id) => trigger(config.jenkinsDestroyJob, { DEPLOY_ID: id }),
  };
}

module.exports = { createJenkins };
