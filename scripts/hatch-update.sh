#!/usr/bin/env bash
# Pull the trunk and rebuild the stack when origin has moved.
# Run from anywhere; it works on the checkout this script lives in.
set -euo pipefail
src=${BASH_SOURCE[0]}
while [ -L "$src" ]; do
  dir=$(cd -P "$(dirname "$src")" && pwd)
  src=$(readlink "$src")
  case $src in /*) ;; *) src=$dir/$src ;; esac
done
script=$(cd -P "$(dirname "$src")" && pwd)/$(basename "$src")
cd -P "$(dirname "$src")/.."

# Link onto ~/.local/bin as `hatch-update` the first time, unless something is there.
link=$HOME/.local/bin/hatch-update
if [ ! -e "$link" ] && [ ! -L "$link" ]; then
  mkdir -p "$HOME/.local/bin"
  ln -s "$script" "$link"
  echo "hatch: linked $link"
  case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "hatch: add \$HOME/.local/bin to your PATH to run it as 'hatch-update'" ;; esac
fi

branch=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || true)
branch=${branch#origin/}
branch=${branch:-main}

git fetch origin "$branch" --quiet

# Only update a clean checkout on the trunk; never clobber local work. A CLI
# built from a feature branch or a dirty tree would replace the one on the PATH
# with code that is not the trunk's, so the build is held to the same rule.
[ "$(git branch --show-current)" = "$branch" ] || { echo "hatch: not on $branch, skipping"; exit 0; }
[ -z "$(git status --porcelain)" ] || { echo "hatch: working tree dirty, skipping"; exit 0; }

moved=
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$branch")" ]; then
  git pull --ff-only
  moved=1
else
  echo "hatch: already up to date"
fi

# Built whether or not anything was pulled: a checkout can be current and still
# hold commits the binary on the PATH was never built from (a pull by hand, a
# merge that landed while this was not run). The build is incremental, so when
# the binary is already current it is a few seconds and nothing is compiled.
if ! out=$(make build-hatch 2>&1); then
  printf '%s\n' "$out" >&2
  echo "hatch: the CLI did not build; the binary on the PATH is unchanged" >&2
  exit 1
fi
echo "hatch: CLI is current at $(git rev-parse --short HEAD)"

[ -n "$moved" ] || exit 0
docker compose "$@" up -d --build   # e.g. hatch-update.sh --profile runner
