import fs from "node:fs";

import {
  analyzeCommit,
  buildChangelogEntry,
  buildReleaseBody,
  bumpVersion,
  formatVersion,
  getCommitsToRelease,
  getLatestVersionTag,
  runGit,
  tryGit,
  updateChangelog,
} from "./generate-changelog.js";

function commitAndPushChangelog(branchName) {
  if (!branchName) {
    console.log("No branch name provided. Skipping changelog commit.");
    return;
  }

  runGit(["config", "user.name", "github-actions[bot]"]);
  runGit(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  runGit(["add", "CHANGELOG.md"]);

  const staged = tryGit(["diff", "--cached", "--name-only"]);
  if (!staged) {
    console.log("No changelog changes staged.");
    return;
  }

  runGit(["commit", "-m", "chore(release): update changelog [skip release]"]);
  try {
    runGit(["push", "origin", `HEAD:${branchName}`]);
  } catch (error) {
    const stderr = String(error.stderr || "");
    if (!stderr.includes("non-fast-forward")) {
      throw error;
    }

    console.log(`Remote ${branchName} advanced before changelog push. Rebasing and retrying.`);
    runGit(["fetch", "origin", branchName]);
    runGit(["rebase", `origin/${branchName}`], { stdio: "inherit" });
    runGit(["push", "origin", `HEAD:${branchName}`]);
  }
}

async function githubRequest(apiPath, method, body) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "xlink-service-release-workflow",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 422) {
    const payload = await response.json().catch(() => ({}));
    return { ok: false, status: 422, payload };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${method} ${apiPath} failed with ${response.status}: ${text}`);
  }

  const payload = await response.json().catch(() => ({}));
  return { ok: true, status: response.status, payload };
}

async function createRelease(repo, tagName, targetCommitish, body, subject) {
  const result = await githubRequest(`/repos/${repo}/releases`, "POST", {
    tag_name: tagName,
    target_commitish: targetCommitish,
    name: tagName,
    body,
    draft: false,
    prerelease: false,
    generate_release_notes: false,
  });

  if (!result.ok && result.status === 422) {
    console.log(`Release for ${tagName} already exists or could not be created. Skipping.`);
    return;
  }

  console.log(`Created ${tagName} for ${targetCommitish.slice(0, 7)}: ${subject}`);
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repository = process.env.GITHUB_REPOSITORY;
  const branchName = process.env.GITHUB_REF_NAME || "";

  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is required.");
  }

  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required.");
  }

  if (!eventPath || !fs.existsSync(eventPath)) {
    throw new Error("GITHUB_EVENT_PATH is missing or invalid.");
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const before = event.before || "";
  const after = process.env.GITHUB_SHA || event.after || "";

  runGit(["fetch", "--tags", "--force"]);

  let { version: currentVersion } = getLatestVersionTag();
  const commits = getCommitsToRelease(before, after);
  const changelogEntries = [];

  if (commits.length === 0) {
    console.log("No new untagged commits found.");
    return;
  }

  for (const sha of commits) {
    const analysis = analyzeCommit(sha);
    currentVersion = bumpVersion(currentVersion, analysis.bump);

    const tagName = formatVersion(currentVersion);
    const body = buildReleaseBody({ tagName, ...analysis });
    changelogEntries.push(buildChangelogEntry({ tagName, ...analysis }));

    await createRelease(repository, tagName, sha, body, analysis.subject);
  }

  const changelogUpdated = updateChangelog(changelogEntries);
  if (changelogUpdated) {
    commitAndPushChangelog(branchName);
  } else {
    console.log("CHANGELOG.md already up to date.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
