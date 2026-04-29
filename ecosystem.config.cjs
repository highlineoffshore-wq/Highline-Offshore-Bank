/**
 * PM2 process file — avoids `npm start` / cross-env on lean production servers.
 *
 * Usage (from repo root):
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'white-label-banking',
      cwd: __dirname,
      script: 'server/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
