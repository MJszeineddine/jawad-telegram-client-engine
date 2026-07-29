#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NODE22_BIN="${NODE22_BIN:-/opt/homebrew/opt/node@22/bin}"
if [[ -x "$NODE22_BIN/node" ]]; then
  export PATH="$NODE22_BIN:$PATH"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Repository must be clean before closure CI." >&2
  git status --short >&2
  exit 2
fi

HEAD_SHA="$(git rev-parse HEAD)"
ORIGIN_SHA="$(git rev-parse origin/main)"
if [[ "$HEAD_SHA" != "$ORIGIN_SHA" ]]; then
  echo "HEAD does not match origin/main." >&2
  echo "HEAD=$HEAD_SHA" >&2
  echo "origin/main=$ORIGIN_SHA" >&2
  exit 2
fi

RUN_UTC="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
EVIDENCE_DIR="$ROOT/evidence/closure/$RUN_UTC-$HEAD_SHA"
LOG_DIR="$EVIDENCE_DIR/logs"
mkdir -p "$LOG_DIR"

MATRIX_TSV="$EVIDENCE_DIR/command-matrix.tsv"
SUMMARY_JSON="$EVIDENCE_DIR/summary.json"
VERSIONS_TXT="$EVIDENCE_DIR/environment-versions.txt"
IMAGES_TXT="$EVIDENCE_DIR/docker-images.txt"
HEALTH_JSONL="$EVIDENCE_DIR/health.jsonl"

COMPOSE_PROJECT_NAME="jawad_closure_${HEAD_SHA:0:8}_$(date -u +%H%M%S)"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-56432}"
REDIS_HOST_PORT="${REDIS_HOST_PORT:-56379}"
LOCAL_WEB_PORT="${LOCAL_WEB_PORT:-3310}"
LOCAL_BOT_HEALTH_PORT="${LOCAL_BOT_HEALTH_PORT:-3311}"
LOCAL_WORKER_HEALTH_PORT="${LOCAL_WORKER_HEALTH_PORT:-3320}"
RESTORE_DB="jawad_engine_restore_${HEAD_SHA:0:8}"
BACKUP_ROOT="$EVIDENCE_DIR/backups"
COMPOSE_ENV_FILE="$EVIDENCE_DIR/closure.env"

export COMPOSE_PROJECT_NAME
export POSTGRES_HOST_PORT REDIS_HOST_PORT LOCAL_WEB_PORT LOCAL_BOT_HEALTH_PORT LOCAL_WORKER_HEALTH_PORT
export COMPOSE_ENV_FILE
export DATABASE_URL="postgresql://jawad:jawad@localhost:${POSTGRES_HOST_PORT}/jawad_engine"
export RESTORE_DATABASE_URL="postgresql://jawad:jawad@localhost:${POSTGRES_HOST_PORT}/${RESTORE_DB}"
export REDIS_URL="redis://localhost:${REDIS_HOST_PORT}"
export DATA_ENCRYPTION_KEY="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
export ADMIN_SESSION_SECRET="closure-local-session-secret-at-least-32-bytes"
export ADMIN_PASSWORD_SHA256="$(printf 'closure-local-password' | shasum -a 256 | awk '{print $1}')"
export TELEGRAM_BOT_TOKEN=""
export TELEGRAM_BOT_USERNAME="JawadDevDeskBot"
export TELEGRAM_UPDATE_MODE="long_polling"
export BOT_HEALTH_PORT="$LOCAL_BOT_HEALTH_PORT"
export TELEGRAM_WEBHOOK_SECRET="closure-local-webhook-secret"
export TELEGRAM_ADMIN_CHAT_ID="123456789"
export DEMO_MODE="true"
export NODE_ENV="development"
export APP_BASE_URL="http://localhost:${LOCAL_WEB_PORT}"
export TRON_API_BASE_URL="https://api.trongrid.io"
export BASE_CHAIN_ID="8453"
export ATTACHMENT_ROOT="./runtime/uploads"
export ATTACHMENT_MAX_BYTES="10485760"
export DATA_RETENTION_DAYS="90"
export SEED_DATABASE="true"
export RUN_DATABASE_TESTS="true"
export REQUIRE_LOCKFILE="true"
export BACKUP_ROOT

cat > "$COMPOSE_ENV_FILE" <<ENV
NODE_ENV=development
DEMO_MODE=true
APP_BASE_URL=http://localhost:${LOCAL_WEB_PORT}
MINI_APP_URL=
DATABASE_URL=postgresql://jawad:jawad@postgres:5432/jawad_engine
REDIS_URL=redis://redis:6379
TRUSTED_PROXY_HEADER=x-real-ip
TELEGRAM_BOT_TOKEN=
TELEGRAM_UPDATE_MODE=long_polling
BOT_HEALTH_PORT=${LOCAL_BOT_HEALTH_PORT}
TELEGRAM_WEBHOOK_PORT=
TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME}
TELEGRAM_ADMIN_CHAT_ID=${TELEGRAM_ADMIN_CHAT_ID}
TELEGRAM_WEBHOOK_SECRET=${TELEGRAM_WEBHOOK_SECRET}
ADMIN_SESSION_SECRET=${ADMIN_SESSION_SECRET}
ADMIN_PASSWORD_SHA256=${ADMIN_PASSWORD_SHA256}
DATA_ENCRYPTION_KEY=${DATA_ENCRYPTION_KEY}
ATTACHMENT_ROOT=/app/runtime/uploads
ATTACHMENT_MAX_BYTES=${ATTACHMENT_MAX_BYTES}
DATA_RETENTION_DAYS=${DATA_RETENTION_DAYS}
TRON_API_BASE_URL=${TRON_API_BASE_URL}
BASE_CHAIN_ID=${BASE_CHAIN_ID}
PAYMENT_CONFIRMATIONS_TRON=20
PAYMENT_CONFIRMATIONS_BASE=12
ENV
chmod 600 "$COMPOSE_ENV_FILE"

printf "name\tstatus\texit_code\tseconds\tlog\n" > "$MATRIX_TSV"

cleanup() {
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

run_step() {
  local name="$1"
  shift
  local safe_name
  safe_name="$(printf "%s" "$name" | tr -cs "A-Za-z0-9._-" "_")"
  local log="$LOG_DIR/${safe_name}.log"
  local start end status
  start="$(date +%s)"
  set +e
  "$@" >"$log" 2>&1
  status=$?
  set -e
  end="$(date +%s)"
  if [[ "$status" -eq 0 ]]; then
    printf "%s\tPASS\t%s\t%s\t%s\n" "$name" "$status" "$((end-start))" "${log#$ROOT/}" | tee -a "$MATRIX_TSV"
  else
    printf "%s\tFAIL\t%s\t%s\t%s\n" "$name" "$status" "$((end-start))" "${log#$ROOT/}" | tee -a "$MATRIX_TSV"
    tail -120 "$log" >&2 || true
    exit "$status"
  fi
}

probe_runtime_health() {
  local url response attempt ok
  for url in \
    "http://127.0.0.1:${LOCAL_WEB_PORT}/api/health" \
    "http://127.0.0.1:${LOCAL_BOT_HEALTH_PORT}/health" \
    "http://127.0.0.1:${LOCAL_WORKER_HEALTH_PORT}/health"
  do
    ok=false
    response="$(mktemp)"
    for attempt in $(seq 1 45); do
      if curl -fsS "$url" > "$response"; then
        cat "$response" >> "$HEALTH_JSONL"
        printf "\n" >> "$HEALTH_JSONL"
        rm -f "$response"
        ok=true
        break
      fi
      sleep 2
    done
    if [[ "$ok" != "true" ]]; then
      rm -f "$response"
      echo "Health check failed for $url" >&2
      return 1
    fi
  done
  docker compose exec -T postgres pg_isready -U jawad -d jawad_engine
  docker compose exec -T redis redis-cli ping
}

{
  echo "commit=$HEAD_SHA"
  echo "origin_main=$ORIGIN_SHA"
  echo "utc=$RUN_UTC"
  echo "compose_project=$COMPOSE_PROJECT_NAME"
  echo "node=$(node --version)"
  echo "pnpm=$(corepack pnpm --version)"
  echo "docker=$(docker --version)"
  echo "docker_compose=$(docker compose version)"
  echo "git=$(git --version)"
} > "$VERSIONS_TXT"

run_step "clean repository state" git diff --quiet
run_step "clean staged state" git diff --cached --quiet
run_step "HEAD matches origin/main" bash -c 'test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"'
run_step "frozen pnpm installation" corepack pnpm install --frozen-lockfile --ignore-scripts
run_step "lint" corepack pnpm lint
run_step "core typecheck" corepack pnpm typecheck
run_step "web typecheck" corepack pnpm typecheck:web
run_step "unit tests" corepack pnpm test

run_step "start isolated postgres and redis" docker compose up -d --wait postgres redis
run_step "migration from empty database" docker compose run --rm migrate
run_step "idempotent migration repeat" docker compose run --rm migrate
run_step "deterministic seed" corepack pnpm db:seed
run_step "live PostgreSQL integration tests no skip" corepack pnpm test:integration

run_step "E2E" corepack pnpm test:e2e
run_step "Next.js production build" env NODE_ENV=production DEMO_MODE=true corepack pnpm --filter @jawad/web build
run_step "Playwright chromium install" corepack pnpm exec playwright install chromium
run_step "Playwright mobile desktop browser tests" corepack pnpm test:browser
run_step "accessibility smoke and overflow" bash -c 'PORT=3300 corepack pnpm dev >"$0/accessibility-demo-server.log" 2>&1 &
server_pid=$!
cleanup_server(){ kill "$server_pid" >/dev/null 2>&1 || true; }
trap cleanup_server EXIT
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3300/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3300/health >/dev/null
node --experimental-strip-types - <<'"'"'NODE'"'"'
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:3300/", { waitUntil: "networkidle" });
const result = await page.evaluate(() => {
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const buttons = [...document.querySelectorAll("button")].filter(button => (button.textContent ?? "").trim().length > 0).length;
  const headings = [...document.querySelectorAll("h1,h2,h3")].filter(heading => (heading.textContent ?? "").trim().length > 0).length;
  const bodyText = document.body.textContent ?? "";
  return { overflow, buttons, headings, hasPrivacyWarning: /Do not send passwords/i.test(bodyText) };
});
await browser.close();
if (result.overflow > 1) throw new Error(`HORIZONTAL_OVERFLOW_${result.overflow}`);
if (result.buttons < 3) throw new Error("ACCESSIBLE_BUTTON_SMOKE_FAILED");
if (result.headings < 1) throw new Error("HEADING_SMOKE_FAILED");
if (!result.hasPrivacyWarning) throw new Error("PRIVACY_WARNING_MISSING");
console.log(JSON.stringify(result));
NODE
' "$LOG_DIR"

run_step "dependency policy audit" corepack pnpm audit:deps
run_step "pnpm registry audit high" corepack pnpm audit --audit-level high
run_step "secret scan" corepack pnpm secret:scan
run_step "Gitleaks history redacted" docker run --rm -v "$ROOT:/repo" zricethezav/gitleaks:v8.28.0 detect --source=/repo --no-banner --redact --exit-code=1
run_step "Docker Compose config" bash -o pipefail -c 'docker compose config | sed -E "s#(ADMIN_PASSWORD_SHA256|ADMIN_SESSION_SECRET|DATA_ENCRYPTION_KEY|DATABASE_URL|REDIS_URL|TELEGRAM_ADMIN_CHAT_ID|TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET): .*#\\1: [REDACTED]#g"'
run_step "Docker image build" docker compose build

run_step "container startup" docker compose up -d migrate web worker bot
docker compose images > "$IMAGES_TXT"
run_step "real health checks" probe_runtime_health
run_step "database backup" corepack pnpm db:backup
LATEST_BACKUP="$(ls -t "$BACKUP_ROOT"/jawad-client-engine-*.dump | head -1)"
BACKUP_SHA="$(shasum -a 256 "$LATEST_BACKUP" | awk '{print $1}')"
BACKUP_SIZE="$(wc -c < "$LATEST_BACKUP" | tr -d ' ')"
run_step "create disposable restore database" docker compose exec -T postgres psql -U jawad -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${RESTORE_DB}" -c "CREATE DATABASE ${RESTORE_DB}"
run_step "restore into isolated disposable database" corepack pnpm db:restore-test -- "$LATEST_BACKUP"
printf "backup_sha256=%s\nbackup_size_bytes=%s\nrestore_database=%s\narchive_retained=false\n" "$BACKUP_SHA" "$BACKUP_SIZE" "$RESTORE_DB" > "$EVIDENCE_DIR/backup-restore.txt"
find "$BACKUP_ROOT" -type f -name "*.dump" -delete
find "$BACKUP_ROOT" -depth -type d -empty -delete
run_step "restart validation" docker compose restart web worker bot postgres redis
sleep 8
run_step "post-restart health validation" probe_runtime_health

TEST_COUNT="$(grep -hE '^# tests [0-9]+' "$LOG_DIR"/unit_tests.log "$LOG_DIR"/live_PostgreSQL_integration_tests_no_skip.log 2>/dev/null | awk '{sum += $3} END {print sum+0}')"
BROWSER_COUNT="$(grep -Eo '[0-9]+ passed' "$LOG_DIR"/Playwright_mobile_desktop_browser_tests.log 2>/dev/null | awk '{sum += $1} END {print sum+0}')"
IMAGE_COUNT="$(tail -n +2 "$IMAGES_TXT" | wc -l | tr -d ' ')"

node - <<NODE > "$SUMMARY_JSON"
const summary = {
  ok: true,
  commit: "$HEAD_SHA",
  utc: "$RUN_UTC",
  githubActions: "BLOCKED_EXTERNAL -- runner unavailable before job execution",
  independentClosureCi: "PASS",
  tests: { nodeTestCount: Number("$TEST_COUNT"), browserTestCount: Number("$BROWSER_COUNT") },
  docker: { composeProject: "$COMPOSE_PROJECT_NAME", imageRows: Number("$IMAGE_COUNT") },
  evidence: {
    commandMatrix: "command-matrix.tsv",
    environmentVersions: "environment-versions.txt",
    dockerImages: "docker-images.txt",
    health: "health.jsonl"
  }
};
console.log(JSON.stringify(summary, null, 2));
NODE

find "$EVIDENCE_DIR" -type f \
  ! -name "sha256-manifest.txt" \
  ! -name "closure.env" \
  -print0 | sort -z | xargs -0 shasum -a 256 > "$EVIDENCE_DIR/sha256-manifest.txt"
rm -f "$COMPOSE_ENV_FILE"

echo "Independent closure CI PASS"
echo "Evidence: ${EVIDENCE_DIR#$ROOT/}"
