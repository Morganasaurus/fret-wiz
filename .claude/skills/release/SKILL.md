---
name: release
description: Test, build, commit and push Fret Wiz, wait for the GitHub Actions image build, and confirm the new image is published. Run only when the user asks to release or ship.
disable-model-invocation: true
argument-hint: "[commit message summary]"
---

Release the current Fret Wiz working tree. Stop and report at the first failure; never skip or weaken a check.

1. **Check the branch.** `git status --short` and `git branch --show-current`. Must be on `main`. If the tree is
   clean and `main` is not ahead of `origin/main`, there is nothing to release: say so and stop.
2. **Test and build.** `npm test` then `npm run build`. Both must pass.
3. **Commit** (skip if nothing is uncommitted). Stage everything except anything that looks like a secret or a
   stray probe file (`src/_probe*` is gitignored; double-check). Write a commit message: a short summary line
   (use `$ARGUMENTS` if given), a blank line, then bullet points of what changed for the user. Follow the
   session's commit attribution rules. Don't change the repo-local git identity.
4. **Push.** `git push origin main`.
5. **Wait for the build.** Run the helper in the background and wait for it to finish (it takes 2–4 minutes):
   `node .claude/skills/release/wait-for-build.mjs $(git rev-parse HEAD)`
   It prints the workflow result, each job's result, and whether `ghcr.io/morganasaurus/fret-wiz:sha-<short>`
   exists. If the build failed, fetch the failing job's details from the GitHub API and report them.
6. **Report.** One short message: the commit, build result, image tag, and the next step for the user:
   "In Portainer, open the fret-wiz stack and use **Pull and redeploy** (re-pull image on). Otherwise Watchtower
   picks it up within about 3 days. Roll back by pinning the image to `sha-<previous>`."
