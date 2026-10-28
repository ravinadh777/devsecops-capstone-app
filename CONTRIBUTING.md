# Contributing

Thanks for helping! This repository is part of an open DevSecOps capstone:
code changes here are built, scanned and deployed automatically, so the
pipeline is the reviewer you meet first.

## Workflow
1. Fork, create a branch, make a focused change.
2. Run locally: `npm ci && npm run lint && npm test` (Node.js 22).
3. Open a pull request using the template. Describe how you tested it.

## What CI checks on your pull request
| Check | Must pass |
|---|---|
| ESLint + 32+ tests (incl. PostgreSQL) | yes |
| `npm audit` (production deps, high+) | yes |
| Trivy: vulnerable deps, committed secrets, Dockerfile misconfig | yes |
| Image build, container smoke test, Trivy CRITICAL gate | yes |
| SonarQube quality gate | runs after merge for fork PRs (forks get no secrets) |

First-time contributors' workflow runs wait for maintainer approval.

## Rules
- Never commit secrets, tokens or `.env` files. Trivy will block the PR.
- New behaviour needs a test. Input must be validated; errors must not leak internals.
- A `.trivyignore` entry needs a reason, an owner and a review date.

## Practising the security gates
Want to see a gate fail on purpose? See `scripts/demo/block-release.sh` in the
main kit (failing test, leaked secret, vulnerable dependency, quality gate).
