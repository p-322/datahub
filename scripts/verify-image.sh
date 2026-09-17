#!/usr/bin/env bash
#
# WHAT THE DATAHUB IMAGE ACTUALLY CONTAINS — checked by running the artefact.
#
# Same idea as argus/src/argus/ops/verify-image.sh: the build workflow builds the
# image, runs THIS against it, and only then pushes, so an image that cannot
# start never reaches ghcr and Enterprise can never pull it. Source-level checks
# (lint, tsc, jest) all resolve the workspace through apps/ and packages/; the
# image has neither, only Next.js's standalone output. Only running it tells.
#
# Checks:
#   1. the standalone entrypoint exists where the CMD expects it
#   2. the server starts and answers HTTP within a bounded time, with NO
#      backend configured — any HTTP status is a pass, a refused connection or
#      a crashed process is a fail. (Clerk middleware may answer 500 without
#      keys; that is still "the server runs".)
#
# Usage:  bash scripts/verify-image.sh [image-ref]        # default datahub:local
set -euo pipefail

IMAGE="${1:-datahub:local}"
NAME="datahub-verify-$$"

if ! command -v docker >/dev/null 2>&1; then
  # Exit 2, not 0: "could not check" must never look like "checked, passed".
  echo "docker is not available, so the artefact cannot be inspected." >&2
  exit 2
fi

fail() { echo "FAIL  $*" >&2; docker rm -f "${NAME}" >/dev/null 2>&1 || true; exit 1; }
trap 'docker rm -f "${NAME}" >/dev/null 2>&1 || true' EXIT

echo "Inspecting ${IMAGE}"

# ---- 1. entrypoint present ----------------------------------------------------
echo -n "entrypoint /app/current/server.js: "
docker run --rm --entrypoint sh "${IMAGE}" -c 'test -f /app/current/server.js' \
  || fail "server.js missing — standalone output not copied where the CMD expects it"
echo "ok"

# ---- 2. server starts and answers ------------------------------------------------
echo -n "server answers HTTP: "
docker run -d --name "${NAME}" -p 127.0.0.1:0:3000 \
  -e NODE_ENV=production -e PORT=3000 -e HOSTNAME=0.0.0.0 \
  "${IMAGE}" >/dev/null
PORT="$(docker port "${NAME}" 3000/tcp | head -1 | sed 's/.*://')"

status=""
for _ in $(seq 1 30); do
  if ! docker inspect -f '{{.State.Running}}' "${NAME}" 2>/dev/null | grep -q true; then
    echo; docker logs "${NAME}" 2>&1 | tail -30 >&2
    fail "container exited before answering"
  fi
  status="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || true)"
  [[ -n "${status}" && "${status}" != "000" ]] && break
  sleep 1
done
[[ -n "${status}" && "${status}" != "000" ]] || { docker logs "${NAME}" 2>&1 | tail -30 >&2; fail "no HTTP answer within 30s"; }
echo "ok — HTTP ${status}"

echo
echo "PASS  ${IMAGE}"
