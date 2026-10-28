# Security policy

This is a teaching project, but we treat security reports seriously.

## Reporting a vulnerability
Please **do not open a public issue**. Use GitHub's private reporting:
**Security tab > Report a vulnerability** on this repository.
You will get a reply within 7 days.

## Scope
- The application code in `src/` and `public/`
- The CI/CD workflows in `.github/`
- The container image built from `Dockerfile`

## What already protects this project
- Every pull request: ESLint, tests, `npm audit`, Trivy (dependencies, secrets, Dockerfile)
- Every push to `main`: SonarQube quality gate and a Trivy image gate before publishing
- Weekly OWASP ZAP baseline scan against an ephemeral container
- Third-party GitHub Actions pinned to commit SHAs; Dependabot keeps them current
