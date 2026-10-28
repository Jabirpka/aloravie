// PM2 process config — runs all three Aloravie services on one VPS.
// See docs/DEPLOY.md for the full runbook.
//
// Prerequisites (per app, on the server):
//   backend:  npm ci && npm run build        -> produces dist/index.js; reads backend/.env
//   web:      NEXT_PUBLIC_API_URL=https://api.<domain> npm ci && npm run build
//   admin:    NEXT_PUBLIC_API_URL=https://api.<domain> npm ci && npm run build
//   (NEXT_PUBLIC_API_URL is baked in at build time, so set it before `next build`.)
//
// Start:   pm2 start ecosystem.config.js && pm2 save && pm2 startup
// Reload:  pm2 reload ecosystem.config.js   (after a rebuild)
module.exports = {
  apps: [
    {
      name: "aloravie-api",
      cwd: "./backend",
      script: "dist/index.js",
      env: { NODE_ENV: "production" },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "400M",
    },
    {
      name: "aloravie-web",
      cwd: "./web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
      max_memory_restart: "500M",
    },
    {
      name: "aloravie-admin",
      cwd: "./admin",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      env: { NODE_ENV: "production" },
      max_memory_restart: "500M",
    },
  ],
};
