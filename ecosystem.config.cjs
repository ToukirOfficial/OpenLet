// PM2 on the VPS, run as the site user. Web and API listen on 127.0.0.1 only; nginx serves the domain
// and sends everything (including /api/*) to the web server, which forwards /api/* to the API.
const APP = process.env.OPENLET_APP_DIR || '/home/openlet/app';
const WEB_PORT = process.env.OPENLET_WEB_PORT || '3031';
const API_PORT = process.env.OPENLET_API_PORT || '4131';

module.exports = {
  apps: [
    {
      name: 'openlet-api',
      cwd: `${APP}/current/apps/api`,
      script: 'dist/main.js',
      node_args: [`--env-file=${APP}/api.env`],
      env: { API_PORT, API_HOST: '127.0.0.1' },
      max_memory_restart: '384M',
      kill_timeout: 10000,
    },
    {
      name: 'openlet-worker',
      cwd: `${APP}/current/apps/api`,
      script: 'dist/worker.js',
      node_args: [`--env-file=${APP}/api.env`],
      max_memory_restart: '384M',
      kill_timeout: 30000,
    },
    {
      name: 'openlet-web',
      cwd: `${APP}/current/web`,
      script: 'apps/web/server.js',
      env: { NODE_ENV: 'production', PORT: WEB_PORT, HOSTNAME: '127.0.0.1' },
      max_memory_restart: '384M',
    },
  ],
};
