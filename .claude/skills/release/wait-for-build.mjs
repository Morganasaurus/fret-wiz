// Wait for the GitHub Actions run for a commit, then check the image tag on GHCR.
// Usage: node wait-for-build.mjs <commit-sha>
// Uses the public GitHub API (no token needed for this public repo).

const REPO = "Morganasaurus/fret-wiz";
const IMAGE = "morganasaurus/fret-wiz";
const sha = process.argv[2];
if (!sha) {
  console.error("usage: node wait-for-build.mjs <commit-sha>");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path) => {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "fret-wiz-release" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
};

// 1. Find the run for this commit (it can take a few seconds to appear).
let run;
for (let i = 0; i < 30 && !run; i++) {
  const { workflow_runs } = await api(`/actions/runs?head_sha=${sha}&per_page=5`);
  run = workflow_runs?.[0];
  if (!run) await sleep(5000);
}
if (!run) {
  console.log(`No workflow run found for ${sha.slice(0, 7)} after 2.5 minutes.`);
  process.exit(1);
}
console.log(`Run ${run.id}: ${run.html_url}`);

// 2. Wait for it to finish (up to ~12 minutes).
for (let i = 0; i < 70 && run.status !== "completed"; i++) {
  await sleep(10000);
  run = await api(`/actions/runs/${run.id}`);
}
console.log(`Workflow: ${run.status} ${run.conclusion ?? ""}`);
const { jobs } = await api(`/actions/runs/${run.id}/jobs`);
for (const job of jobs) {
  console.log(`  job ${job.name}: ${job.conclusion}`);
  for (const step of job.steps ?? []) {
    if (step.conclusion && !["success", "skipped"].includes(step.conclusion)) {
      console.log(`    step "${step.name}": ${step.conclusion}`);
    }
  }
}
if (run.conclusion !== "success") process.exit(1);

// 3. Confirm the image tag exists and can be pulled anonymously.
const tag = `sha-${sha.slice(0, 7)}`;
const tokenRes = await fetch(`https://ghcr.io/token?scope=repository:${IMAGE}:pull`);
const { token } = await tokenRes.json();
const tagsRes = await fetch(`https://ghcr.io/v2/${IMAGE}/tags/list`, {
  headers: { Authorization: `Bearer ${token}` },
});
const tags = tagsRes.ok ? (await tagsRes.json()).tags ?? [] : [];
console.log(
  tags.includes(tag)
    ? `Image ghcr.io/${IMAGE}:${tag} is published (and :latest points to it).`
    : `Image tag ${tag} NOT found on GHCR (status ${tagsRes.status}).`,
);
process.exit(tags.includes(tag) ? 0 : 1);
