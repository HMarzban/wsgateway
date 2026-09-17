/* eslint-env mocha */
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const net = require('node:net')
const path = require('node:path')
const io = require('socket.io-client')

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function unusedPort () {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  await new Promise(resolve => server.close(resolve))
  return port
}

function receive (socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timed out: ${event}`)) }, 5000)
    const cleanup = () => {
      clearTimeout(timer)
      socket.off(event, success)
      socket.off('connect_error', failure)
    }
    const success = value => { cleanup(); resolve(value) }
    const failure = error => { cleanup(); reject(error) }
    socket.once(event, success)
    socket.once('connect_error', failure)
  })
}

describe('Redis adapter migration', function () {
  this.timeout(20000)
  const children = []
  const sockets = []
  let first, second, cluster

  function start (script, port, extra = {}) {
    const child = spawn(process.execPath, [script], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: String(port), CLUSTER: 'false', ...extra },
      // A separate group also lets cleanup stop the sticky-session workers.
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const record = { child, exited: once(child, 'exit'), log: '' }
    children.push(record)
    child.stdout.on('data', chunk => { record.log += chunk })
    child.stderr.on('data', chunk => { record.log += chunk })
    return record
  }

  async function ready (record, port) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (record.child.exitCode !== null) throw new Error(record.log)
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthcheck`, { signal: AbortSignal.timeout(250) })
        if (response.ok) return
      } catch {}
      await delay(50)
    }
    throw new Error(`Gateway failed to start: ${record.log}`)
  }

  async function connect (port, transports = ['websocket']) {
    const socket = io(`http://127.0.0.1:${port}/test`, { transports, forceNew: true, reconnection: false, autoConnect: false })
    sockets.push(socket)
    const connected = receive(socket, 'connect')
    socket.connect()
    await connected
    return socket
  }

  before(async () => {
    first = await unusedPort()
    second = await unusedPort()
    cluster = await unusedPort()
    await ready(start('server/index.pm2.cluster.js', first), first)
    await ready(start('server/index.node.cluster.js', second), second)
    await ready(start('server/index.node.cluster.js', cluster, { CLUSTER: 'true', INSTANCES: '2', LOADBALANCING_METHOD: 'round-robin' }), cluster)
  })

  afterEach(() => {
    sockets.splice(0).forEach(socket => socket.disconnect())
  })
  after(async () => {
    await Promise.all(children.map(async ({ child, exited }) => {
      if (child.exitCode === null) process.kill(-child.pid, 'SIGTERM')
      await exited
    }))
  })

  it('fans out in both directions between two independent gateways through Redis', async () => {
    const clients = await Promise.all([connect(first), connect(second)])
    for (const sender of clients) {
      const messages = clients.map(socket => receive(socket, 'broadCastMessage'))
      sender.emit('broadCastMessage', 'start')
      assert.deepEqual(await Promise.all(messages), ['the game will start soon', 'the game will start soon'])
    }
  })

  it('keeps polling sessions working across two sticky-session workers', async () => {
    const clients = await Promise.all(Array.from({ length: 4 }, () => connect(cluster, ['polling'])))
    const messages = clients.map(socket => receive(socket, 'broadCastMessage'))
    clients[0].emit('broadCastMessage', 'start')
    assert.deepEqual(await Promise.all(messages), Array(4).fill('the game will start soon'))
    for (const socket of clients) {
      const echoed = receive(socket, 'message')
      socket.emit('message', Buffer.from([0, 1, 127, 255]))
      assert.deepEqual(await echoed, Buffer.from([0, 1, 127, 255]))
    }
  })

  it('exits unsuccessfully when Redis cannot be reached at startup', async () => {
    const record = start('server/index.pm2.cluster.js', await unusedPort(), { REDIS_URL: '127.0.0.1', REDIS_PORT: String(await unusedPort()) })
    const [code] = await record.exited
    assert.equal(code, 1)
    assert.match(record.log, /Redis connection error/)
  })
})
