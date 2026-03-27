module.exports = {
  apps: [
    {
      name: 'iccorehub-domestic-billing',
      script: './server.mjs',
      cwd: '/srv/iccorehub/domestic-billing',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '8788',
      },
    },
  ],
}
