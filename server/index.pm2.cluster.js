const path = require('path')
const dotEnvPath = path.resolve(__dirname, '../')
require('dotenv-flow').config({
  silent: true,
  path: dotEnvPath
})

const http = require('http')
const { Server } = require('socket.io')
const { connectRedisAdapter } = require('./redis')
const log4js = require('log4js')
const logger = log4js.getLogger()

const Settings = require('../settings.json')
const { validateSettings, healthCheckRouter, forkComponents } = require('./common')
const { PORT, HOST } = process.env
logger.level = 'debug'

validateSettings(Settings)

async function start () {
  const redis = await connectRedisAdapter()
  const httpServer = http.createServer(healthCheckRouter)
  const io = new Server(httpServer)
  io.adapter(redis.adapter)
  httpServer.on('close', redis.close)
  forkComponents(Settings, io)

  httpServer.listen(PORT, () => {
    logger.info(`Websocket gateway running at http://${HOST}:${PORT}, pId: ${process.pid}`)
  })
}

start().catch(error => {
  logger.error(error)
  process.exitCode = 1
})
