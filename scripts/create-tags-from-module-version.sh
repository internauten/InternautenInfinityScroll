#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODULE_FILE_DEFAULT="${ROOT_DIR}/internauteninfinityscroll/internauteninfinityscroll.php"
MODULE_FILE="${MODULE_FILE_DEFAULT}"
ALSO_PLAIN_TAG=false
DRY_RUN=false

usage() {
  cat <<'USAGE'
Usage:
  scripts/create-tags-from-module-version.sh [options]

Options:
  --module-file <path>   Path to module main PHP file
  --also-plain-tag       Also create tag without v prefix (e.g. 1.2.3)
  --dry-run              Print actions without creating tags
  -h, --help             Show this help

Behavior:
  - Reads $this->version from the module file
  - Creates an annotated tag: v<version> and pushes it to origin
  - Optional: creates additional plain tag: <version>
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --module-file)
      shift
      MODULE_FILE="${1:-}"
      if [[ -z "${MODULE_FILE}" ]]; then
        echo "Error: --module-file requires a path argument." >&2
        exit 1
      fi
      ;;
    --also-plain-tag)
      ALSO_PLAIN_TAG=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown option '$1'" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f "${MODULE_FILE}" ]]; then
  echo "Error: Module file not found: ${MODULE_FILE}" >&2
  exit 1
fi

if ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: ${ROOT_DIR} is not a git repository." >&2
  exit 1
fi

if [[ "${DRY_RUN}" != "true" ]]; then
  DIRTY_STATUS="$(git -C "${ROOT_DIR}" status --porcelain)"
  if [[ -n "${DIRTY_STATUS}" ]]; then
    echo "Error: Repository has uncommitted changes. Commit or stash changes before tagging." >&2
    echo "" >&2
    echo "Pending changes:" >&2
    echo "${DIRTY_STATUS}" >&2
    exit 1
  fi
fi

VERSION="$(awk -F"'" '/\$this->version/{print $2; exit}' "${MODULE_FILE}")"

if [[ -z "${VERSION}" ]]; then
  echo "Error: Could not read module version from ${MODULE_FILE}" >&2
  exit 1
fi

SEMVER_REGEX='^[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$'
if [[ ! "${VERSION}" =~ ${SEMVER_REGEX} ]]; then
  echo "Error: Version '${VERSION}' is not valid semver (expected 1.2.3 or 1.2.3-rc.1)." >&2
  exit 1
fi

TAG_V="v${VERSION}"
TAG_PLAIN="${VERSION}"
MESSAGE="Release ${TAG_V}"

create_tag() {
  local tag="$1"

  if git -C "${ROOT_DIR}" rev-parse --verify "refs/tags/${tag}" >/dev/null 2>&1; then
    echo "Error: Tag already exists: ${tag}" >&2
    exit 1
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] Would create annotated tag: ${tag}"
  else
    git -C "${ROOT_DIR}" tag -a "${tag}" -m "${MESSAGE}"
    echo "Created tag: ${tag}"
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] Would push tag to origin: ${tag}"
  else
    git -C "${ROOT_DIR}" push origin "${tag}"
    echo "Pushed tag: ${tag}"
  fi
}

create_tag "${TAG_V}"

if [[ "${ALSO_PLAIN_TAG}" == "true" ]]; then
  create_tag "${TAG_PLAIN}"
fi

echo "Done. Module version: ${VERSION}"
