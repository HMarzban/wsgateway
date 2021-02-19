module.exports = {
  apps: [
    {
      name: 'WS',
      script: './server/index.pm2.cluster.js',
      instances: 2,
      watch: true,
      exec_mode: 'cluster',
      env: {
        PORT: 3000
      }
    }
  ]
}
