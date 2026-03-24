export function buildReviewPrompt(prNumber: string): string {
  return [
    "Follow the PR Code Review Agent Team workflow defined in the appended system prompt (review-master / pr-code-review skill).",
    "",
    `PR number: ${prNumber}`,
    "",
    "Steps you must perform:",
    `1. From this working directory, obtain the PR diff using: gh pr diff ${prNumber}`,
    "2. If gh is unavailable or fails, explain what is missing (gh auth, remote, or repo) and stop.",
    "3. Exclude generated / lock files per the skill, then run the expert reviews and merge into one report.",
    "4. Output the final integrated report only, in the Markdown format specified in the skill (PR Review Report with tables).",
    "",
  ].join("\n");
}

export function buildBranchReviewPrompt(remoteRef: string, localRef: string, diffFilePath: string): string {
  return [
    "Follow the PR Code Review Agent Team workflow defined in the appended system prompt (review-master / pr-code-review skill).",
    "",
    "This review is from a **local git branch comparison** (not a GitHub PR).",
    `- Remote (base) ref: \`${remoteRef}\``,
    `- Local (compare) ref: \`${localRef}\``,
    `- Diff command used (merge-base, same idea as a PR): \`git diff ${remoteRef}...${localRef}\``,
    "",
    `The full unified diff is in this file (read it with the Read tool):`,
    diffFilePath,
    "",
    "Steps you must perform:",
    "1. Read that file. If it is empty, say there are no changes and stop.",
    "2. Exclude generated / lock files per the skill when interpreting the diff.",
    "3. Run the expert reviews and merge into one report.",
    "4. Output the final integrated report only, in the Markdown format specified in the skill (PR Review Report with tables).",
    "",
  ].join("\n");
}
