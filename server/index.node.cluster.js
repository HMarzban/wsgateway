const path = require('path')
const dotEnvPath = path.resolve(__dirname, '../')
require('dotenv-flow').config({
  silent: true,
  path: dotEnvPath
})

const cluster = require('cluster')
const http = require('http')

const { Server } = require('socket.io')
const { connectRedisAdapter } = require('./redis')
const { setupMaster, setupWorker } = require('@socket.io/sticky')
const log4js = require('log4js')
const logger = log4js.getLogger()

const Settings = require('../settings.json')

const { validateSettings, healthCheckRouter, forkComponents } = require('./common')
const {
  PORT,
  HOST,
  LOADBALANCING_METHOD,
  CLUSTER: clustring,
  INSTANCES: numInstances
} = process.env

logger.level = 'debug'

// cluster mode
const CLUSTER = clustring === 'true'
let numCPUs = require('os').cpus().length
const INSTANCES = (numInstances || '1').toLowerCase() === 'max' ? numCPUs : +(numInstances || 1)
if (CLUSTER && INSTANCES) numCPUs = INSTANCES

validateSettings(Settings)

const initHttpService = (httpServer = http.createServer()) => {
  return new Promise(resolve => {
    httpServer.listen(PORT, () => {
      logger.info(`Websocket gateway running at http://${HOST}:${PORT}`)
      resolve(httpServer)
    })
  })
}

const runSocketWorker = async (httpServer = http.createServer(healthCheckRouter)) => {
  logger.info(`Socket ${process.pid} started`)
  const redis = await connectRedisAdapter()
  const io = new Server(httpServer)

  io.adapter(redis.adapter)
  httpServer.on('close', redis.close)

  if (CLUSTER) {
    setupWorker(io)
  }

  forkComponents(Settings, io)
  return httpServer
}

;(async () => {
  if (!CLUSTER) {
    const httpServer = await runSocketWorker()
    await initHttpService(httpServer)
    return
  }

  if (cluster.isMaster) {
    logger.info(`Master ${process.pid} is running`)

    const httpServer = await initHttpService()

    setupMaster(httpServer, {
      loadBalancingMethod: LOADBALANCING_METHOD
    })

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork()
    }

    cluster.on('exit', (worker) => {
      logger.error(`Worker ${worker.process.pid} died`)
      cluster.fork()
    })
  } else {
    await runSocketWorker()
  }
})().catch(error => {
  logger.error(error)
  process.exitCode = 1
})
