const Redis = require('ioredis')
const { createAdapter } = require('@socket.io/redis-adapter')
const logger = require('log4js').getLogger()

exports.connectRedisAdapter = async () => {
  const pubClient = new Redis({
    host: process.env.REDIS_URL || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    lazyConnect: true
  })
  const subClient = pubClient.duplicate()
  const clients = [pubClient, subClient]
  const close = () => clients.forEach(client => client.disconnect())
  clients.forEach(client => client.on('error', error => logger.error('Redis connection error', error)))

  try {
    await Promise.all(clients.map(client => client.connect()))
    return { adapter: createAdapter(pubClient, subClient), close }
  } catch (error) {
    close()
    throw error
  }
}
