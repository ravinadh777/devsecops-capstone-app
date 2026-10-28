#!/usr/bin/env bash
# Installs a pinned Trivy release and verifies its SHA-256 checksum.
#
# Why not aquasecurity/trivy-action? In March 2026 (CVE-2026-33634) attackers
# force-pushed almost every version tag of trivy-action and setup-trivy to a
# credential stealer, and published a malicious Trivy v0.69.4. Pinning a
# known-good binary version and verifying it is the lesson: mutable tags are
# not a security boundary. Confirm TRIVY_VERSION against Aqua's advisory
# before changing it.
set -euo pipefail

TRIVY_VERSION="${TRIVY_VERSION:-0.76.1}"
case "${TRIVY_VERSION}" in
  0.69.4|0.69.5|0.69.6) echo "Refusing known-compromised Trivy ${TRIVY_VERSION}" >&2; exit 1 ;;
esac

INSTALL_DIR="${INSTALL_DIR:-${RUNNER_TEMP:-/tmp}/trivy-bin}"
TARBALL="trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz"
BASE_URL="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

curl -fsSL -o "${WORK}/${TARBALL}" "${BASE_URL}/${TARBALL}"
curl -fsSL -o "${WORK}/checksums.txt" "${BASE_URL}/trivy_${TRIVY_VERSION}_checksums.txt"
(cd "${WORK}" && grep " ${TARBALL}\$" checksums.txt | sha256sum -c -)

mkdir -p "${INSTALL_DIR}"
tar -xzf "${WORK}/${TARBALL}" -C "${INSTALL_DIR}" trivy
"${INSTALL_DIR}/trivy" --version
if [[ -n "${GITHUB_PATH:-}" ]]; then echo "${INSTALL_DIR}" >> "${GITHUB_PATH}"; fi
