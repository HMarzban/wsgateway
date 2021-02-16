require('dotenv-flow').config({
	silent: true
})
const cluster = require('cluster')
const http = require('http')
const { Server } = require('socket.io')
const redisAdapter = require('socket.io-redis')
const { setupMaster, setupWorker } = require('@socket.io/sticky')
const Settings = require('./settings.json')
const { validateSettings, healthCheckRouter, forkComponents } = require('./common')
const { PORT, HOST, REDIS_URL, REDIS_PORT } = process.env


// cluster mode
let numCPUs = require('os').cpus().length
if (Settings.cluster && Settings.instances) numCPUs = Settings.instances

validateSettings(Settings)

const preservedNamespace = new Set()

/**
 * Validate namespaces
*/
Settings.components.forEach(component => {
  if (preservedNamespace.has(component.namespace)) { throw new Error(`Socket namespace [${component.namespace}] has already existed, choose another name!`) }
  preservedNamespace.add(component.namespace)
})

const initHttpService = () => {
  return new Promise(resolve => {
    const httpServer = http.createServer(healthCheckRouter)
    httpServer.listen(PORT, HOST, () => {
      console.info(`Websocket gateway running at http://${HOST}:${PORT}`)
      resolve(httpServer)
    })
  })
}

const runSocketWorker = (httpServer) => {
  console.info(`Socket ${process.pid} started`)
  httpServer = httpServer || http.createServer()
  const io = new Server(httpServer)

  io.adapter(redisAdapter({
		host: REDIS_URL,
		port: REDIS_PORT
	}))

  if (Settings.cluster) {
    setupWorker(io)
  }

  forkComponents(Settings, io)
}

;(async () => {
  if (!Settings.cluster) {
    const httpServer = await initHttpService()
    runSocketWorker(httpServer)
    return
  }

  if (cluster.isMaster) {
    console.info(`Master ${process.pid} is running`)

    const httpServer = await initHttpService()

    setupMaster(httpServer, {
      loadBalancingMethod: Settings.loadBalancingMethod
    })

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork()
    }

    cluster.on('exit', (worker) => {
      console.error(`Worker ${worker.process.pid} died`)
      cluster.fork()
    })
  } else {
    runSocketWorker()
  }
})()
