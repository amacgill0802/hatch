#!/usr/bin/env bash
# Pull the trunk, build the CLI, and rebuild the stack when origin has moved.
# Run from anywhere; it works on the checkout this script lives in.
# `hatch-update --dirty` builds what is here as it stands; `--force` rebuilds
# everything whatever has or has not moved. See the flags below.
set -euo pipefail
src=${BASH_SOURCE[0]}
while [ -L "$src" ]; do
  dir=$(cd -P "$(dirname "$src")" && pwd)
  src=$(readlink "$src")
  case $src in /*) ;; *) src=$dir/$src ;; esac
done
script=$(cd -P "$(dirname "$src")" && pwd)/$(basename "$src")
cd -P "$(dirname "$src")/.."

# Anything this script does not recognise goes to `docker compose` untouched, so
# `hatch-update --profile runner` still means what it did.
#
#   --dirty   build the checkout as it stands: uncommitted changes and any
#             branch. Nothing is pulled, since there is no trunk to follow.
#   --force   rebuild everything whether or not anything moved: the CLI
#             from scratch, the images without their cache, the containers
#             recreated.
dirty=
force=
compose_args=()
for arg in "$@"; do
  case $arg in
    --dirty) dirty=1 ;;
    --force) force=1 ;;
    *) compose_args+=("$arg") ;;
  esac
done

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

moved=
if [ -n "$dirty" ]; then
  # Built as it stands: a tree with uncommitted changes, on whatever branch it
  # is on, is the point. Pulling into it would mix the trunk's commits into
  # work in progress, so the script says what it did not do and carries on.
  echo "hatch: --dirty, building this checkout as it stands (not pulling)"
else
  # Only update a clean checkout on the trunk; never clobber local work. A CLI
  # built from a feature branch or a dirty tree would replace the one on the
  # PATH with code that is not the trunk's, so the build is held to the same
  # rule - which --dirty is how to say it is not wanted.
  [ "$(git branch --show-current)" = "$branch" ] || { echo "hatch: not on $branch, skipping (--dirty builds it anyway)"; exit 0; }
  [ -z "$(git status --porcelain)" ] || { echo "hatch: working tree dirty, skipping (--dirty builds it anyway)"; exit 0; }

  # "Is there anything on origin that HEAD lacks", not "is HEAD equal to
  # origin": a trunk that is ahead of origin has nothing to pull, and pulling
  # anyway succeeds, which is not the same as the stack having moved.
  if git merge-base --is-ancestor "origin/$branch" HEAD; then
    echo "hatch: already up to date"
  else
    before=$(git rev-parse HEAD)
    git pull --ff-only
    [ "$(git rev-parse HEAD)" = "$before" ] || moved=1
  fi
fi

# Built whether or not anything was pulled: a checkout can be current and still
# hold commits the binary on the PATH was never built from (a pull by hand, a
# merge that landed while this was not run). The build is incremental, so when
# the binary is already current it is a few seconds and nothing is compiled.
# The CLI needs the dotnet SDK and make, which this script did not always ask
# of the machine it ran on: an operator who only runs the stack has neither.
# Without them the build is skipped, said, and the rest carries on as it always
# did - the stack itself is built in Docker and needs neither.
if command -v make >/dev/null && command -v dotnet >/dev/null; then
  build_args=
  [ -z "$force" ] || build_args=--no-incremental
  if ! out=$(make build-hatch HATCH_BUILD_ARGS="$build_args" 2>&1); then
    printf '%s\n' "$out" >&2
    echo "hatch: the CLI did not build; the binary on the PATH is unchanged" >&2
    exit 1
  fi
  echo "hatch: CLI is current at $(git rev-parse --short HEAD)${dirty:+ (plus uncommitted changes)}"
else
  echo "hatch: no dotnet SDK or make here, so the CLI was not built"
fi

# The stack follows what moved, unless it is told it did, or that it is built
# from a tree that no commit describes - which is never "up to date".
[ -z "$moved$force$dirty" ] && exit 0

if [ -n "$force" ]; then
  docker compose ${compose_args[@]+"${compose_args[@]}"} build --no-cache
  docker compose ${compose_args[@]+"${compose_args[@]}"} up -d --force-recreate
else
  docker compose ${compose_args[@]+"${compose_args[@]}"} up -d --build   # e.g. hatch-update --profile runner
fi
