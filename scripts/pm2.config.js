module.exports = {
  apps: [
    {
      name: 'WS',
      script: './server/index.pm2.cluster.js',
      instances: 3,
      watch: true,
      watch: ['../server'],
      exec_mode: 'cluster',
      env: {
        PORT: 3000
      }
    }
  ]
}
