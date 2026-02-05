---
name: publish
description: Prepare oxlint-plugin-inhuman for an npm publish release. Use when the user asks to publish, prep a release, bump version, update README, tag, or push for oxlint-plugin-inhuman.
---

# Publish

## Overview

Prepare this repo for `npm publish` end-to-end: verify status, update docs if needed, bump version, commit, tag, and push. Do not run `npm publish`; stop after confirming readiness.

## Workflow

1. Preflight
- Ensure the cwd is `/Users/n14/Projects/Open-Source/oxlint-plugin-inhuman`.
- Check `git status -sb` and `git diff` to understand what will be released.
- Run `make lint` and `npm test` if code changed since last green run or if unsure; lint is mandatory after runtime changes.

2. Update docs
- Review `README.md` for any rule changes or new fixtures and update if needed.

3. Pick version
- If the user provided a version, use it.
- Otherwise infer:
  - Patch for fixes or docs/fixtures only
  - Minor for behavior changes or new capabilities
  - Major for breaking changes
- Apply with `npm version <x.y.z> --no-git-tag-version`.
- Update `package-lock.json` only if it is tracked; do not add it if the repo doesn’t track it.

4. Commit
- Follow repo style: imperative subject, blank line, `-` bullets.
- Split commits if code changes and docs should be separated, or if multiple concerns exist.
- Use heredoc with `git commit -F - <<'EOF' ... EOF`.

5. Tag
- Create `vX.Y.Z` tag.
- Prefer lightweight tag unless the user asks for annotated.

6. Push
- Push commits to `origin`.
- Push the tag: `git push origin vX.Y.Z`.

7. Final response
- Report version, commits, tag status, and confirm the repo is ready.
- Tell the user they can now run `npm publish`.

## Notes

- Do not run `npm pack` unless asked.
- If any tooling fails, fix and rerun before proceeding.
