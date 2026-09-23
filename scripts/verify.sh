#!/usr/bin/env bash
#
# The pre-push gate: everything CI runs, in CI's order, logged to a file.
#
# WHY. On 2026-09-23 two pushes went red in a row for things that were already
# true on disk. The first: a server component read an enum out of a 'use
# client' module, which builds green and dies on the first request — the image
# shipped and the search page went down. The second: the @p-322 rename made a
# hundred import lines short enough for prettier to want them on one line, and
# only the handful of files touched by hand had been linted. Both would have
# been caught here in a couple of minutes, before the push.
#
# WHY IN CI'S ORDER. So a local failure is the same failure CI would report,
# found before the push rather than after it.
#
# WHY A FILE. `next build` alone prints thousands of lines and the useful part
# is rarely the tail — today's prettier errors were a screen and a half above
# it. A log you can grep beats a terminal you can scroll.
#
# WHY NOT `; echo "exit=$?"`. That makes the shell exit 0 and the gate always
# look successful. This script exits with the code of whatever failed — the
# same trap the bulk loader fell into when it reported a crashed pipeline as
# "Done".
set -uo pipefail

cd "$(dirname "$0")/.."

LOG="${SAWUBONA_VERIFY_LOG:-tmp/verify.log}"
mkdir -p "$(dirname "$LOG")"
: >"$LOG"

started=$(date +%s)

run() {
  local name="$1"
  shift
  printf '\n=== %s ===\n' "$name" >>"$LOG"
  local from
  from=$(date +%s)
  if "$@" >>"$LOG" 2>&1; then
    printf '  ok    %-16s %ss\n' "$name" "$(($(date +%s) - from))"
    return 0
  fi
  printf '  FAIL  %-16s %ss\n' "$name" "$(($(date +%s) - from))"
  return 1
}

# `next build` imports every page and route module while collecting page
# data, and many construct Zod-validated clients at module load, so it needs
# server-side config present — DATABASE_URL, the endpoint URLs, a Clerk key.
# The image build sets placeholders for exactly this. Rather than repeat them
# here, where they would quietly drift, read them out of the Dockerfile: a
# placeholder added there is picked up automatically, and one removed there
# fails here the same way it would fail CI.
dockerfile_build_env() {
  sed -n '/^ENV SEARCH_ENDPOINT_URL=/,/[^\\]$/p' Dockerfile |
    sed 's/^ENV //; s/\\$//' |
    tr -s ' \t' '\n' |
    grep '='
}

run_build() {
  local placeholders
  placeholders=$(dockerfile_build_env)
  if [ -z "$placeholders" ]; then
    echo "Could not read the build-time placeholders from the Dockerfile." >&2
    echo "Expected an 'ENV SEARCH_ENDPOINT_URL=...' block; has it moved?" >&2
    return 1
  fi
  echo "Building with $(echo "$placeholders" | wc -l | tr -d ' ') placeholders from the Dockerfile:"
  echo "$placeholders" | sed 's/=.*/=…/; s/^/  /'
  # shellcheck disable=SC2046
  env $(echo "$placeholders") npm run build
}

failed=""
# QA runs the first four, in this order. The image build runs `build`, which
# is where `next build` lints and typechecks the app a second time, with
# different settings from `gts lint` — both have caught things the other
# missed, so both are here. `scripts` is not in CI at all: it compiles the
# index enrichment, which nothing else builds, so a break there is invisible
# until a load runs.
for step in \
  "lint|npm run lint" \
  "rsc boundary|npm run check:rsc" \
  "test|npm run test:ci" \
  "compile|npm run compile" \
  "scripts|npm run build:scripts" \
  "build|run_build"; do
  name="${step%%|*}"
  # shellcheck disable=SC2086
  if ! run "$name" ${step#*|}; then
    failed="$name"
    break
  fi
done

echo
if [ -n "$failed" ]; then
  echo "verify FAILED at: ${failed} (after $(($(date +%s) - started))s)"
  echo "full output: ${LOG}"
  echo
  echo "--- last 40 lines ---"
  tail -40 "$LOG"
  exit 1
fi

echo "verify OK in $(($(date +%s) - started))s — full output: ${LOG}"
