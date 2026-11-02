#!/usr/bin/env bash
# Deploys OpenLet to the VPS (ssh alias "vps"): build here, upload a release, install production
# dependencies, dump the database, migrate, switch the "current" symlink, reload PM2, check health.
#
# Before the first run, check these against the server (see README "Deploying to a VPS"):
#   - a site user and folder ($SITE_USER, $APP) with Node 24 from nvm and PM2
#   - $APP/api.env with the production settings (copy .env.example; DEMO_MODE=true for the demo)
#   - free ports for $WEB_PORT and $API_PORT, and nginx proxying $DOMAIN to 127.0.0.1:$WEB_PORT
set -euo pipefail

DOMAIN=${DOMAIN:-openlet.toukirahmedrony.com}
SITE_USER=${SITE_USER:-openlet}
APP=${APP:-/home/$SITE_USER/app}
WEB_PORT=${WEB_PORT:-3031}
API_PORT=${API_PORT:-4131}
REL=$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)
R=$APP/releases/$REL

# Node: nvm first (Mac and WSL), Homebrew only as a fallback.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 24 >/dev/null 2>&1 || true
elif [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

cd "$(dirname "$0")"

echo "==> Build (clean, production settings only)"
rm -rf apps/web/.next apps/api/dist packages/shared/dist
env -i HOME="$HOME" PATH="$PATH" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
  API_INTERNAL_URL="http://127.0.0.1:$API_PORT" \
  pnpm exec turbo run build --force

echo "==> Package release $REL"
OUT=$(mktemp -d)
TGZ=$(mktemp)
trap 'rm -rf "$OUT" "$TGZ"' EXIT
mkdir -p "$OUT/web/apps/web/.next" "$OUT/apps/api" "$OUT/apps/web" "$OUT/packages/shared"
cp -a apps/web/.next/standalone/. "$OUT/web/"
cp -a apps/web/.next/static "$OUT/web/apps/web/.next/static"
cp -a apps/web/public "$OUT/web/apps/web/public"
cp package.json pnpm-lock.yaml pnpm-workspace.yaml ecosystem.config.cjs "$OUT/"
cp apps/web/package.json "$OUT/apps/web/"
cp -a apps/api/package.json apps/api/prisma.config.ts apps/api/prisma apps/api/dist "$OUT/apps/api/"
cp -a packages/shared/package.json packages/shared/dist "$OUT/packages/shared/"
COPYFILE_DISABLE=1 tar -czf "$TGZ" -C "$OUT" .

echo "==> Upload"
scp -q "$TGZ" "vps:/tmp/openlet-$REL.tgz"

echo "==> Install, back up, migrate, switch"
ssh vps "bash -s" <<REMOTE
set -euo pipefail
sudo -u $SITE_USER mkdir -p $R
sudo -u $SITE_USER tar -xzf /tmp/openlet-$REL.tgz -C $R
rm -f /tmp/openlet-$REL.tgz
REMOTE

ssh vps "cd /tmp && sudo -u $SITE_USER -H bash -s" <<REMOTE
set -euo pipefail
export NVM_DIR=\$HOME/.nvm
set +u; . \$NVM_DIR/nvm.sh; nvm use 24 >/dev/null; set -u
cd $R
command -v pnpm >/dev/null || npm install -g pnpm@10 >/dev/null
pnpm install --prod --frozen-lockfile --filter @openlet/api... >/dev/null
# Database copy before migrating (owner-only, newest kept for a rollback, older than 3 days removed).
mkdir -p $APP/backups && chmod 700 $APP/backups
(umask 077; pg_dump "\$(grep ^DATABASE_URL= $APP/api.env | cut -d= -f2-)" | gzip > $APP/backups/db-before-$REL.sql.gz)
find $APP/backups -maxdepth 1 -type f -name 'db-before-*.sql.gz' -mtime +2 ! -name db-before-$REL.sql.gz -delete
(cd apps/api && node --env-file=$APP/api.env node_modules/prisma/build/index.js migrate deploy)
cd $APP
PREV=\$(readlink current || true)
ln -sfn $R current.new && mv -Tf current.new current
OPENLET_APP_DIR=$APP OPENLET_WEB_PORT=$WEB_PORT OPENLET_API_PORT=$API_PORT pm2 startOrReload $R/ecosystem.config.cjs --update-env >/dev/null
pm2 save >/dev/null
ok=0
for i in \$(seq 1 30); do
  if curl -fs -o /dev/null http://127.0.0.1:$API_PORT/api/v1/health && curl -fs -o /dev/null http://127.0.0.1:$WEB_PORT/; then ok=1; break; fi
  sleep 2
done
if [ \$ok != 1 ]; then
  echo "Health check failed, rolling back to \$PREV" >&2
  if [ -n "\$PREV" ]; then ln -sfn "\$PREV" current.new && mv -Tf current.new current; pm2 reload openlet-api openlet-worker openlet-web --update-env >/dev/null; fi
  exit 1
fi
ls -1dt $APP/releases/* | tail -n +3 | xargs -r rm -rf
REMOTE

code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/")
health=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/v1/health")
echo "==> https://$DOMAIN/ $code, /api/v1/health $health"
[ "$code" = 200 ] && [ "$health" = 200 ]
