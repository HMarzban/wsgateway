const path = require('path')
const Ajv = require('ajv').default
const redis = require('redis')
const log4js = require('log4js')
const logger = log4js.getLogger()

const configSchema = require('./settings.schema.json')

const client = redis.createClient()
const ajValidator = new Ajv({ allErrors: true, async: true })
logger.level = 'debug'

exports.healthCheckRouter = (req, res) => {
  const url = req.url
  if (url === '/healthcheck') {
    res.setHeader('Content-Type', 'application/json')
    res.write(JSON.stringify({ status: true, pId: process.pid }))
    res.end()
  }
}

exports.validateSettings = settings => {
  const validate = ajValidator.compile(configSchema)
  const result = validate(settings)
  if (!result) {
    logger.error(validate.errors)
    throw new Error('Configuration verification error!')
  }
}

exports.validateNamespace = settings => {
  const preservedNamespace = new Set()
  settings.components.forEach(component => {
    if (preservedNamespace.has(component.namespace)) { throw new Error(`Socket namespace [${component.namespace}] has already existed, choose another name!`) }
    preservedNamespace.add(component.namespace)
  })
  return preservedNamespace
}

exports.forkComponents = (settings, io) => {
  try {
    const preservedNamespace = exports.validateNamespace(settings)

    settings.components.forEach(component => {
      // create io namespace
      const newIo = io.of(component.namespace)
      const cpdir = path.join('../', component.path)

      // check if the path is exists
      if (!path.resolve(cpdir)) { throw new Error(`Component [${component.namespace}] path does not exist; path: ${component.path} `) }

      const reqComponent = require(cpdir)

      if (!Object.prototype.hasOwnProperty.call(reqComponent, component.exc)) { throw new Error(`Component initial function[${component.exc}] not found!`) }

      if (typeof reqComponent[component.exc] !== 'function') { throw new Error(`The [${component.exc}] is not function!`) }

      // require component and excute it
      reqComponent[component.exc](newIo, { pid: process.pid, ...component, preservedNamespace })
    })
  } catch (error) {
    logger.error(error)
  }
}

exports.redisCheckConnection = () => {
  client.on('error', function (error) {
    if (error.code === 'ECONNREFUSED') { throw new Error(`Redis connection failed, error: ${error.code}`) }
  })
}
