# devsecops-capstone-app

[![CI](https://github.com/ravinadh777/devsecops-capstone-app/actions/workflows/ci.yml/badge.svg)](https://github.com/ravinadh777/devsecops-capstone-app/actions/workflows/ci.yml)
[![DAST](https://github.com/ravinadh777/devsecops-capstone-app/actions/workflows/dast.yml/badge.svg)](https://github.com/ravinadh777/devsecops-capstone-app/actions/workflows/dast.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Student Task Manager**: the application half of an open-source DevSecOps capstone.
A small Node.js 22 API + web UI whose real purpose is to travel through a complete
delivery pipeline: tests, SAST, dependency/secret/image scanning, SHA-tagged images,
GitOps promotion, Argo CD deployment, KEDA autoscaling and OWASP ZAP.

Deployment configuration lives in the companion repo:
[devsecops-capstone-gitops](https://github.com/ravinadh777/devsecops-capstone-gitops).

## Run it
```bash
npm ci
npm test                       # unit + integration tests
npm start                      # http://localhost:3000
docker build -t stm . && docker run --rm -p 3000:3000 stm
```
PostgreSQL mode: `STORE=postgres` plus the standard `PGHOST PGUSER PGPASSWORD PGDATABASE` variables.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | /health | liveness |
| GET | /ready | readiness (checks the database; 503 while draining) |
| GET | /version | version, git SHA, pod name |
| GET | /metrics | Prometheus metrics (drives KEDA) |
| GET, POST | /api/tasks | list, create |
| GET, PATCH, DELETE | /api/tasks/:id | read, update, delete |
| GET | /load?ms=50 | bounded CPU work for scaling demos (max 250 ms) |

## Pipeline (`.github/workflows/ci.yml`)
lint + tests -> SonarQube quality gate -> Trivy repo scan -> build, smoke test,
Trivy image gate, SBOM -> push `<user>/student-task-manager:<sha7>` (main only)
-> commit the new tag to the GitOps repo -> Argo CD deploys it.

## Contributing and security
See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). MIT licensed.
