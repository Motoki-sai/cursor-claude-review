---
name: pr-code-review
description: "Skill that runs PR code review with multiple specialist agents. Reviews `git diff` or GitHub PR diffs from security, performance, readability, design, testing, and other angles, then outputs a consolidated report. Must trigger on keywords such as PR review, code review, diff check, pre-merge check, review comments, and code quality. Also when the user says things like 'look at this PR', 'review this', or 'check the diff'."
---

# PR Code Review Agent Team

A skill in which multiple specialist agents review PR diff code from their respective angles and deliver a consolidated report.

## Workflow overview

```
1. Obtain and parse the diff
2. Parallel review by each specialist agent
3. Merge review findings and prioritize
4. Emit the final report
```

---

## Step 1: Obtain the diff

Obtain the diff according to user input.

- **Local Git repository**: run `git diff` to get the diff
- **GitHub PR URL provided**: get the diff with `gh pr diff <PR number>` when the `gh` CLI is available
- **Diff text pasted directly**: use as-is

If the diff is large (over ~500 lines), split by file and pass chunks to each agent. First list changed files and exclude out-of-scope files (generated files, lockfiles, etc.).

### Examples of exclusions

- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `*.generated.*`, `*.min.js`, `*.min.css`
- Changes only to `.gitignore`

---

## Step 2: Review by specialist agents

Review from the perspectives below. Do not run every angle every time; choose those relevant to the diff.

### Agent 1: Security review 🔒

Focus areas:

- SQL injection, XSS, CSRF, and similar vulnerabilities
- Auth/authz gaps (hard-coded secrets, token leakage)
- Missing input validation
- Addition of unsafe dependencies
- Sensitive data in logs or API responses
- Path traversal, SSRF, and similar injection risks

Severity: classify as Critical / High / Medium / Low.

### Agent 2: Performance review ⚡

Focus areas:

- N+1 queries, unnecessary DB calls
- Memory leaks, holding large data in memory inappropriately
- Unnecessary re-renders (for frontend)
- Inefficient algorithms (e.g. O(n²) where O(n) is possible)
- Missing or incorrect cache invalidation
- Bundle impact (large new dependencies)

### Agent 3: Code quality & readability review 📖

Focus areas:

- Naming (variables, functions, classes)
- Function length and single responsibility
- Comment balance (remove obvious comments; add explanations for complex logic)
- Avoid magic numbers and magic strings
- DRY violations (duplicated code)
- Consistency with existing project conventions

### Agent 4: Design & architecture review 🏗️

Focus areas:

- Alignment with SOLID
- Appropriate abstraction level
- Dependency direction (detect cycles)
- Layer boundary violations (e.g. business logic leaking into UI)
- Breaking changes and API compatibility
- Future extensibility

### Agent 5: Testing & reliability review 🧪

Focus areas:

- Tests for new code
- Coverage quality (happy path, errors, edge cases)
- Test quality (not over-coupled to implementation details)
- Appropriate use of mocks and stubs
- Error-handling coverage
- Retries, timeouts, fallbacks

---

## Step 3: Merge review results

Consolidate findings from each agent using the format below.

### Consolidated report format

```markdown
# PR Review Report

## Summary
- PR: [title / number]
- Files changed: N
- Lines added / removed: +X / -Y
- Overall verdict: ✅ Approve / ⚠️ Request Changes / 🚫 Block

## 🚨 Must Fix (required before merge)
| # | File | Line | Area | Finding | Severity |
|---|------|------|------|---------|----------|
| 1 | path/to/file.ts | L42 | Security | Description | Critical |

## ⚠️ Should Fix (strongly recommended)
| # | File | Line | Area | Finding |
|---|------|------|------|---------|

## 💡 Suggestions (improvements)
| # | File | Line | Area | Suggestion |
|---|------|------|------|------------|

## ✅ Good points
- Call out concrete positives; include positive feedback

## 📝 Notes & questions
- Questions where intent was unclear
- Discussion points on design decisions
```

### Verdict criteria

- **✅ Approve**: no Must Fix items; Should Fix items are minor only
- **⚠️ Request Changes**: one or more Must Fix, or several Should Fix items
- **🚫 Block**: Critical security issues or risk of data loss/corruption

---

## Step 4: Output

Emit the review in one of these forms:

1. **In-chat (default)**: show the consolidated report as Markdown
2. **File output**: when `--output file` is specified, save as `review-report.md`
3. **GitHub comment style**: when `--output gh-comments` is specified, emit inline PR comment style

---

## Customization

Users can narrow or deepen the review as follows:

- **Which angles**: e.g. “security only” → run Agent 1 only
- **Depth**: e.g. “quick pass” → report Must Fix–level only; “thorough” → full pass on all angles
- **Language**: default Japanese; switch to match the user’s language
- **Project rules**: if the repo has `.review-rules.md` or similar, read and apply as extra rules

---

## Notes

- Reviews are advisory; a human reviewer makes the final call
- Skip auto-generated or third-party diffs unless they are intentional changes
- If diff context is thin (e.g. whole function not visible), read surrounding code when needed
- Every finding should include both **why it matters** and **how to fix it**
- Do not conflate preference (style) with bugs or design issues; keep preferences in Suggestions
