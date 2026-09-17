/* eslint-env mocha */
const path = require('path')
require('dotenv-flow').config({ default_node_env: 'test', path: path.resolve(__dirname), silent: true })
const { expect } = require('chai')
const axios = require('axios').default
const io = require('socket.io-client')
const serverAddress = `${process.env.SOCKET_URL || 'http://127.0.0.1'}:${process.env.PORT || 3000}`
const socketUrl = `${serverAddress}/${process.env.NAMESPACE || 'test'}`
const users = Number(process.env.USERS || 10)
if (!Number.isInteger(users) || users < 2) throw new Error('USERS must be an integer >= 2')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function event (socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for ${name}`)) }, 5000)
    const success = value => { cleanup(); resolve(value) }
    const failure = error => { cleanup(); reject(error) }
    const cleanup = () => {
      clearTimeout(timer)
      socket.off(name, success)
      socket.off('connect_error', failure)
    }
    socket.once(name, success)
    socket.once('connect_error', failure)
  })
}

describe('gateway integration', function () {
  this.timeout(15000)
  let sockets
  beforeEach(() => { sockets = [] })
  afterEach(() => sockets.forEach(socket => socket.disconnect()))
  async function connect () {
    const socket = io(socketUrl, { autoConnect: false, reconnection: false, transports: ['websocket'] })
    sockets.push(socket)
    const connected = event(socket, 'connect')
    socket.connect()
    await connected
    return socket
  }
  async function echo (socket, message) {
    const received = event(socket, 'message')
    socket.emit('message', message)
    expect(await received).to.equal(message)
  }
  async function broadcast (clients) {
    const received = clients.map(socket => event(socket, 'broadCastMessage'))
    clients[0].emit('broadCastMessage', 'start')
    const messages = await Promise.all(received)
    expect(messages).to.have.length(users)
    messages.forEach(message => expect(message).to.equal('the game will start soon'))
  }
  it('reports HTTP health', async () => {
    const { data } = await axios.get(`${serverAddress}/healthcheck`, { timeout: 5000, proxy: false })
    expect(data.status).to.equal(true)
    expect(data.pId).to.be.a('number')
  })
  it('echoes one client message', async () => echo(await connect(), 'hello world'))
  it('awaits every concurrent client echo', async () => {
    const clients = await Promise.all(Array.from({ length: users }, connect))
    await Promise.all(clients.map((socket, id) => echo(socket, `client-${id}`)))
  })
  it('broadcasts to every connected client', async () => {
    await broadcast(await Promise.all(Array.from({ length: users }, connect)))
  })
  it('broadcasts after staggered connections', async () => {
    const clients = await Promise.all(Array.from({ length: users }, async (_, id) => {
      await delay(id * 10)
      return connect()
    }))
    await broadcast(clients)
  })
  it('accepts a client reconnect', async () => {
    const socket = await connect()
    socket.disconnect()
    const connected = event(socket, 'connect')
    socket.connect()
    await connected
    await echo(socket, 'after reconnect')
  })
})
