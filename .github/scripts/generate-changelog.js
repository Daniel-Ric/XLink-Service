import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CHANGELOG_PATH = path.resolve(process.cwd(), "CHANGELOG.md");

export function runGit(args, options = {}) {
  const output = execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  return typeof output === "string" ? output.trim() : "";
}

export function tryGit(args) {
  try {
    return runGit(args);
  } catch {
    return "";
  }
}

export function parseVersion(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag || "").trim());
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function formatVersion(version) {
  return `v${version.major}.${version.minor}.${version.patch}`;
}

export function bumpVersion(version, bump) {
  if (bump === "major") {
    return { major: version.major + 1, minor: 0, patch: 0 };
  }

  if (bump === "minor") {
    return { major: version.major, minor: version.minor + 1, patch: 0 };
  }

  return { major: version.major, minor: version.minor, patch: version.patch + 1 };
}

function compareVersions(a, b) {
  if (a.major !== b.major) {
    return a.major - b.major;
  }

  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }

  return a.patch - b.patch;
}

function readPackageVersion() {
  const packagePath = path.resolve(process.cwd(), "package.json");
  if (!fs.existsSync(packagePath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return parseVersion(packageJson.version);
  } catch {
    return null;
  }
}

export function getLatestVersionTag() {
  const tags = tryGit(["tag", "--list", "v*.*.*"]).split(/\r?\n/).filter(Boolean);
  const parsed = tags
    .map((tag) => ({ tag, version: parseVersion(tag) }))
    .filter((entry) => entry.version)
    .sort((left, right) => compareVersions(left.version, right.version));

  if (parsed.length > 0) {
    return parsed[parsed.length - 1];
  }

  const packageVersion = readPackageVersion();
  if (packageVersion) {
    return { tag: formatVersion(packageVersion), version: packageVersion, fromPackage: true };
  }

  return { tag: "v0.0.0", version: { major: 0, minor: 0, patch: 0 }, fromPackage: true };
}

function isZeroSha(sha) {
  return !sha || /^0+$/.test(sha);
}

function hasAnyTag(sha) {
  return tryGit(["tag", "--points-at", sha]).split(/\r?\n/).filter(Boolean).length > 0;
}

export function getCommitsToRelease(before, after) {
  if (isZeroSha(after)) {
    return [];
  }

  const range = !isZeroSha(before) ? `${before}..${after}` : after;
  const commits = tryGit(["rev-list", "--reverse", range]).split(/\r?\n/).filter(Boolean);
  const relevantCommits = !isZeroSha(before) ? commits : [after];

  return relevantCommits.filter((sha) => !hasAnyTag(sha));
}

export function getCommitsBetween(fromRef, toRef = "HEAD") {
  if (!fromRef || !tryGit(["rev-parse", "--verify", "--quiet", fromRef])) {
    return tryGit(["rev-list", "--reverse", toRef]).split(/\r?\n/).filter(Boolean);
  }

  return tryGit(["rev-list", "--reverse", `${fromRef}..${toRef}`]).split(/\r?\n/).filter(Boolean);
}

export function parseNumStat(sha) {
  const output = tryGit(["show", "--format=", "--numstat", "--find-renames", sha]);
  const files = [];
  let additions = 0;
  let deletions = 0;

  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    const [addedRaw, deletedRaw, ...rest] = line.split("\t");
    const filePath = rest.join("\t");
    const added = addedRaw === "-" ? 0 : Number(addedRaw);
    const deleted = deletedRaw === "-" ? 0 : Number(deletedRaw);

    additions += Number.isFinite(added) ? added : 0;
    deletions += Number.isFinite(deleted) ? deleted : 0;
    files.push(filePath);
  }

  return {
    files,
    filesChanged: files.length,
    additions,
    deletions,
    totalChanges: additions + deletions,
  };
}

export function cleanCommitSubject(subject) {
  return String(subject || "")
    .replace(/^Merge pull request\s+#\d+\s+from\s+\S+\s*/i, "Merge ")
    .replace(/^[a-z]+(\(.+\))?!?:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function determineBump(commitMessage, stats) {
  if (/BREAKING CHANGE|!:/.test(commitMessage) || stats.filesChanged >= 20 || stats.totalChanges >= 700) {
    return "major";
  }

  if (/^feat(\(.+\))?:/im.test(commitMessage) || stats.filesChanged >= 6 || stats.totalChanges >= 180) {
    return "minor";
  }

  return "patch";
}

function classifyFile(file) {
  const normalized = file.replace(/\\/g, "/");

  if (normalized.startsWith(".github/workflows/")) {
    return "GitHub workflows";
  }

  if (normalized.startsWith(".github/scripts/")) {
    return "GitHub automation scripts";
  }

  if (normalized.startsWith(".github/")) {
    return "GitHub configuration";
  }

  if (normalized.startsWith("src/routes/")) {
    return "Xbox and Minecraft API routes";
  }

  if (normalized.startsWith("src/services/")) {
    return "Xbox, Microsoft, and PlayFab service integrations";
  }

  if (normalized.startsWith("src/middleware/")) {
    return "Middleware";
  }

  if (normalized.startsWith("src/config/")) {
    return "Runtime configuration";
  }

  if (normalized.startsWith("src/utils/")) {
    return "Shared utilities";
  }

  if (normalized === "src/app.js" || normalized === "src/server.js") {
    return "Application bootstrap";
  }

  if (normalized.startsWith("src/")) {
    return "Application source";
  }

  if (normalized.startsWith("tests/") || normalized.startsWith("test/")) {
    return "Tests";
  }

  if (/^package(-lock)?\.json$/i.test(normalized)) {
    return "Dependencies";
  }

  if (/^README\.md$/i.test(normalized)) {
    return "README";
  }

  if (/^SECURITY\.md$/i.test(normalized)) {
    return "Security documentation";
  }

  if (/^CHANGELOG\.md$/i.test(normalized)) {
    return "Changelog";
  }

  if (/postman_collection\.json$/i.test(normalized)) {
    return "Postman collection";
  }

  if (/^production\.env\.example$/i.test(normalized)) {
    return "Deployment configuration";
  }

  return "Repository files";
}

function groupFiles(files) {
  const groups = new Map();

  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    const group = classifyFile(normalized);
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group).push(normalized);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupedFiles]) => [label, groupedFiles.sort()]);
}

function summarizeAreas(files) {
  const interesting = new Set();

  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    if (normalized.startsWith(".github/")) {
      interesting.add("CI and release automation");
    } else if (normalized.startsWith("src/services/")) {
      interesting.add("Xbox, Minecraft, and PlayFab integrations");
    } else if (normalized.startsWith("src/routes/")) {
      interesting.add("HTTP API routes");
    } else if (normalized.startsWith("src/middleware/")) {
      interesting.add("request middleware");
    } else if (normalized.startsWith("tests/") || normalized.startsWith("test/")) {
      interesting.add("test coverage");
    } else if (/^package(-lock)?\.json$/i.test(normalized)) {
      interesting.add("project dependencies");
    } else {
      interesting.add("repository files");
    }
  }

  return Array.from(interesting).slice(0, 3);
}

function formatChangedAreas(files, maxExamples = 2, maxGroups = 6) {
  const groups = groupFiles(files);
  if (!groups.length) {
    return ["- No changed areas were reported by git."];
  }

  const lines = [];
  for (const [label, groupedFiles] of groups.slice(0, maxGroups)) {
    const examples = groupedFiles.slice(0, maxExamples);
    const hiddenCount = groupedFiles.length - examples.length;
    const exampleText = examples.length ? `: ${examples.join(", ")}` : "";
    lines.push(
      `- ${label}: ${groupedFiles.length} file${groupedFiles.length === 1 ? "" : "s"}${exampleText}${hiddenCount > 0 ? `, plus ${hiddenCount} more` : ""}`,
    );
  }

  if (groups.length > maxGroups) {
    lines.push(`- Other areas: ${groups.length - maxGroups} additional group${groups.length - maxGroups === 1 ? "" : "s"}.`);
  }

  return lines;
}

function inferChangeType(commitMessage, subject, stats) {
  const message = `${subject}\n${commitMessage}`;

  if (/BREAKING CHANGE|!:/.test(message)) {
    return "Breaking change";
  }

  if (/^feat(\(.+\))?:/im.test(message)) {
    return "Feature";
  }

  if (/^fix(\(.+\))?:/im.test(message)) {
    return "Bug fix";
  }

  if (/^perf(\(.+\))?:/im.test(message)) {
    return "Performance improvement";
  }

  if (/^test(\(.+\))?:/im.test(message) || stats.files.some((file) => file.replace(/\\/g, "/").startsWith("tests/"))) {
    return "Test coverage";
  }

  if (/^docs(\(.+\))?:/im.test(message) || stats.files.some((file) => /^README\.md$/i.test(file))) {
    return "Documentation";
  }

  if (/^ci(\(.+\))?:/im.test(message) || stats.files.some((file) => file.replace(/\\/g, "/").startsWith(".github/"))) {
    return "CI and automation";
  }

  if (/^chore(\(.+\))?:/im.test(message) || stats.files.some((file) => /^package(-lock)?\.json$/i.test(file))) {
    return "Maintenance";
  }

  return "Repository update";
}

function extractCommitDetails(commitMessage, subject) {
  const normalizedSubject = String(subject || "").trim();
  const lines = String(commitMessage || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== normalizedSubject)
    .filter((line) => cleanCommitSubject(line) !== normalizedSubject)
    .filter((line) => !/^Signed-off-by:/i.test(line))
    .filter((line) => !/^Co-authored-by:/i.test(line));

  return lines.slice(0, 8);
}

function describeBumpReason(commitMessage, stats, bump) {
  if (bump === "major") {
    if (/BREAKING CHANGE|!:/.test(commitMessage)) {
      return "breaking-change marker in the commit message";
    }

    return `large change footprint (${stats.filesChanged} files, ${stats.totalChanges} total line changes)`;
  }

  if (bump === "minor") {
    if (/^feat(\(.+\))?:/im.test(commitMessage)) {
      return "feature commit marker";
    }

    return `medium change footprint (${stats.filesChanged} files, ${stats.totalChanges} total line changes)`;
  }

  return "patch-level repository update";
}

function formatCommitNotes(details, maxLines = 4) {
  return details
    .map((line) => line.replace(/^[-*]\s*/, ""))
    .filter(Boolean)
    .slice(0, maxLines)
    .map((line) => `- ${line}`);
}

function buildImpactLine(type, areas, stats) {
  const areaText = areas.length ? areas.join(", ") : "the repository";
  const size =
    stats.filesChanged >= 20 || stats.totalChanges >= 700
      ? "large"
      : stats.filesChanged >= 6 || stats.totalChanges >= 180
        ? "medium"
        : "small";

  return `${type} with a ${size} change footprint across ${areaText}.`;
}

export function analyzeCommit(sha) {
  const fullMessage = tryGit(["show", "-s", "--format=%B", sha]);
  const subject = cleanCommitSubject(tryGit(["show", "-s", "--format=%s", sha]));
  const stats = parseNumStat(sha);
  const bump = determineBump(fullMessage, stats);

  return { sha, fullMessage, subject, stats, bump };
}

export function buildReleaseBody({ sha, subject, fullMessage, stats, bump }) {
  const shortSha = sha.slice(0, 7);
  const areas = summarizeAreas(stats.files);
  const changeType = inferChangeType(fullMessage, subject, stats);
  const details = extractCommitDetails(fullMessage, subject);
  const notes = formatCommitNotes(details, 6);

  return [
    `Automated release for commit \`${shortSha}\`.`,
    "",
    "## Summary",
    "",
    `- Change type: ${changeType}`,
    `- Main change: ${subject || "Repository update"}`,
    `- Impact: ${buildImpactLine(changeType, areas, stats)}`,
    `- Bump reason: ${describeBumpReason(fullMessage, stats, bump)}`,
    "",
    "## Notable changes",
    "",
    ...(notes.length ? notes : [`- ${subject || "Repository update"}`]),
    "",
    "## Changed areas",
    "",
    ...formatChangedAreas(stats.files, 3, 8),
    "",
    "## Release metadata",
    "",
    `- Version bump: ${bump}`,
    `- Files changed: ${stats.filesChanged}`,
    `- Line changes: +${stats.additions} / -${stats.deletions}`,
  ].join("\n");
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function buildChangelogEntry({ tagName, sha, subject, fullMessage, stats, bump }) {
  const versionLabel = tagName.replace(/^v/, "");
  const shortSha = sha.slice(0, 7);
  const areas = summarizeAreas(stats.files);
  const changeType = inferChangeType(fullMessage, subject, stats);
  const details = extractCommitDetails(fullMessage, subject);
  const notes = formatCommitNotes(details, 4);
  const noteSection = notes.length ? ["", "### Notable Changes", "", ...notes] : [];

  return [
    `## ${versionLabel} (${getTodayIsoDate()})`,
    "",
    "### Summary",
    "",
    `- Change type: ${changeType}`,
    `- Main change: ${subject || "Repository update"} (${shortSha})`,
    `- Impact: ${buildImpactLine(changeType, areas, stats)}`,
    `- Bump reason: ${describeBumpReason(fullMessage, stats, bump)}`,
    "",
    "### Changed Areas",
    "",
    ...formatChangedAreas(stats.files, 2, 6),
    ...noteSection,
    "",
    "### Release Metrics",
    "",
    `- Version bump: ${bump}`,
    `- Files changed: ${stats.filesChanged}`,
    `- Line changes: +${stats.additions} / -${stats.deletions}`,
    "",
  ].join("\n");
}

export function updateChangelog(entries) {
  if (!entries.length) {
    return false;
  }

  const existing = fs.existsSync(CHANGELOG_PATH) ? fs.readFileSync(CHANGELOG_PATH, "utf8") : "# Changelog\n\n";
  const normalizedExisting = existing.trimStart().startsWith("# Changelog") ? existing : `# Changelog\n\n${existing}`;
  const withoutHeader = normalizedExisting.replace(/^# Changelog\s*/u, "").replace(/^\s+/, "");
  const nextContent = `# Changelog\n\n${entries.join("\n")}${withoutHeader ? `${withoutHeader.trimStart()}\n` : ""}`;

  if (nextContent === existing) {
    return false;
  }

  fs.writeFileSync(CHANGELOG_PATH, nextContent, "utf8");
  return true;
}

function parseCliArgs(args) {
  const result = {
    write: false,
    from: "",
    to: "HEAD",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--write") {
      result.write = true;
    } else if (arg === "--from") {
      result.from = args[index + 1] || "";
      index += 1;
    } else if (arg === "--to") {
      result.to = args[index + 1] || "HEAD";
      index += 1;
    }
  }

  return result;
}

export function buildChangelogForRange({ from = "", to = "HEAD" } = {}) {
  let { version: currentVersion } = getLatestVersionTag();
  const commits = getCommitsBetween(from || getLatestVersionTag().tag, to).filter((sha) => !hasAnyTag(sha));
  const entries = [];

  for (const sha of commits) {
    const analysis = analyzeCommit(sha);
    currentVersion = bumpVersion(currentVersion, analysis.bump);
    const tagName = formatVersion(currentVersion);
    entries.push(buildChangelogEntry({ tagName, ...analysis }));
  }

  return entries;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const entries = buildChangelogForRange({ from: args.from, to: args.to });

  if (!entries.length) {
    console.log("No untagged commits found for changelog generation.");
    return;
  }

  if (args.write) {
    const updated = updateChangelog(entries);
    console.log(updated ? "CHANGELOG.md updated." : "CHANGELOG.md already up to date.");
    return;
  }

  console.log(entries.join("\n"));
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
