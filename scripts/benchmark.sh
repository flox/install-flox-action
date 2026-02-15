#!/usr/bin/env bash
# benchmark.sh - Compare installation times: DeterminateSystems vs Cachix vs Flox
#
# Usage:
#   ./scripts/benchmark.sh              # run all benchmarks via act
#   ./scripts/benchmark.sh act          # same (explicit)
#   ./scripts/benchmark.sh docker       # use raw Docker containers
#   ./scripts/benchmark.sh <job-name>   # run one: bench-determinate, bench-cachix,
#                                       #          bench-flox, bench-flox-via-nix
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ACT_IMAGE="ghcr.io/catthehacker/ubuntu:js-24.04"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

declare -A RESULTS 2>/dev/null || true

# ---------------------------------------------------------------------------
# Docker-based benchmarks (no act needed)
# ---------------------------------------------------------------------------
docker_bench() {
    local name="$1"
    local install_cmd="$2"
    local verify_cmd="$3"

    echo -e "\n${BLUE}${BOLD}Benchmarking: ${name}${NC}"
    echo "─────────────────────────────────────"

    local start end duration
    start=$(date +%s)

    docker run --rm --privileged \
        -v "$REPO_DIR:/workspace:ro" \
        "$ACT_IMAGE" \
        bash -c "
            set -e
            export DEBIAN_FRONTEND=noninteractive
            $install_cmd
            $verify_cmd
        " 2>&1 | tail -5

    end=$(date +%s)
    duration=$((end - start))

    echo -e "${GREEN}${BOLD}${name}: ${duration}s${NC}\n"
    RESULTS["$name"]="$duration"
}

run_docker_benchmarks() {
    echo -e "${BOLD}Running Docker-based benchmarks${NC}"
    echo "Image: $ACT_IMAGE"
    echo ""

    if ! command -v docker &>/dev/null; then
        echo -e "${RED}Docker not found. Install Docker or use 'act' mode.${NC}"
        exit 1
    fi

    if ! docker info &>/dev/null 2>&1; then
        echo -e "${RED}Docker daemon not running.${NC}"
        exit 1
    fi

    echo "Pulling image (one-time)..."
    docker pull "$ACT_IMAGE" 2>&1 | tail -1

    docker_bench "DeterminateSystems" \
        "curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install linux --init none --no-confirm" \
        ". /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh && nix --version"

    docker_bench "Cachix (nixos.org)" \
        "adduser --disabled-password --gecos '' nixuser && su -l nixuser -c 'curl -L https://nixos.org/nix/install | sh -s -- --no-daemon' && su -l nixuser -c '. ~/.nix-profile/etc/profile.d/nix.sh && nix --version'" \
        "echo done"

    docker_bench "install-flox-action" \
        "export INPUT_DOWNLOAD_URL=https://downloads.flox.dev/by-env/stable/deb/flox.x86_64-linux.deb RETRIES=3 DISABLE_METRICS=true && bash /workspace/scripts/install-flox.sh" \
        "flox --version"

    print_results
}

# ---------------------------------------------------------------------------
# Act-based benchmarks (closer to real GitHub Actions)
# ---------------------------------------------------------------------------
run_act_job() {
    local job="$1"
    local name="$2"

    echo -e "\n${BLUE}${BOLD}Benchmarking: ${name}${NC}"
    echo "─────────────────────────────────────"

    local start end duration
    start=$(date +%s)

    (cd "$REPO_DIR" && act push \
        -P "ubuntu-latest=$ACT_IMAGE" \
        -W .github/workflows/benchmark.yml \
        -j "$job" \
        --privileged \
        --env FLOX_DISABLE_METRICS=true \
        2>&1) | tail -20

    end=$(date +%s)
    duration=$((end - start))

    echo -e "${GREEN}${BOLD}${name}: ${duration}s${NC}\n"
    RESULTS["$name"]="$duration"
}

run_act_benchmarks() {
    local job="${1:-all}"

    echo -e "${BOLD}Running act-based benchmarks${NC}"
    echo "Image: $ACT_IMAGE"
    echo ""

    if ! command -v act &>/dev/null; then
        echo -e "${RED}act not found. Install via: flox activate${NC}"
        exit 1
    fi

    if ! docker info &>/dev/null 2>&1; then
        echo -e "${RED}Docker daemon not running (required by act).${NC}"
        exit 1
    fi

    echo "Pulling image (one-time)..."
    docker pull "$ACT_IMAGE" 2>&1 | tail -1

    case "$job" in
        bench-determinate)
            run_act_job "bench-determinate" "DeterminateSystems" ;;
        bench-cachix)
            run_act_job "bench-cachix" "Cachix" ;;
        bench-flox)
            run_act_job "bench-flox" "install-flox-action" ;;
        bench-flox-via-nix)
            run_act_job "bench-flox-via-nix" "install-flox-action (nix path)" ;;
        all)
            run_act_job "bench-determinate" "DeterminateSystems"
            run_act_job "bench-cachix" "Cachix"
            run_act_job "bench-flox" "install-flox-action"
            run_act_job "bench-flox-via-nix" "install-flox-action (nix path)"
            ;;
        *)
            echo -e "${RED}Unknown job: $job${NC}"
            echo "Available: bench-determinate, bench-cachix, bench-flox, bench-flox-via-nix, all"
            exit 1 ;;
    esac

    print_results
}

# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
print_results() {
    if [ ${#RESULTS[@]} -eq 0 ]; then
        return
    fi

    echo ""
    echo -e "${BOLD}==========================================${NC}"
    echo -e "${BOLD}  Benchmark Results${NC}"
    echo -e "${BOLD}==========================================${NC}"
    printf "  %-35s %s\n" "Installer" "Time"
    echo "  ─────────────────────────────────── ─────"

    for name in "${!RESULTS[@]}"; do
        printf "  %-35s %ss\n" "$name" "${RESULTS[$name]}"
    done

    echo -e "${BOLD}==========================================${NC}"
    echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
MODE="${1:-act}"

case "$MODE" in
    docker)
        run_docker_benchmarks ;;
    act)
        run_act_benchmarks "all" ;;
    bench-*)
        run_act_benchmarks "$MODE" ;;
    *)
        echo "Usage: $0 [act|docker|bench-<job>]"
        echo ""
        echo "Modes:"
        echo "  act              Run all benchmarks via act (default)"
        echo "  docker           Run all benchmarks via raw Docker"
        echo "  bench-<job>      Run single benchmark via act"
        echo ""
        echo "Jobs:"
        echo "  bench-determinate     DeterminateSystems/nix-installer-action"
        echo "  bench-cachix          cachix/install-nix-action"
        echo "  bench-flox            install-flox-action (package)"
        echo "  bench-flox-via-nix    install-flox-action (via existing Nix)"
        exit 0 ;;
esac
