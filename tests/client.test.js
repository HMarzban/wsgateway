/* eslint-env mocha */
const path = require('path')
const dotEnvPath = path.resolve(__dirname, './')
require('dotenv-flow').config({
  default_node_env: 'test',
  path: dotEnvPath
})

const { SOCKET_URL, PORT, NAMESPACE, USERS } = process.env

const { expect } = require('chai')
const io = require('socket.io-client')
const socketUrl = `${SOCKET_URL}:${PORT}/${NAMESPACE}`

function randomString (len, charSet) {
  charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let randomString = ''
  for (let i = 0; i < len; i++) {
    const randomPoz = Math.floor(Math.random() * charSet.length)
    randomString += charSet.substring(randomPoz, randomPoz + 1)
  }
  return randomString
}

function randomInteger (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

describe('server', function () {
  this.timeout(3000)

  let sockets = []
  beforeEach(() => {
    sockets = []
  })
  afterEach(() => {
    sockets.forEach(e => e.disconnect())
  })

  const makeSocket = (id = 0) => {
    const socket = io.connect(socketUrl, {
      reconnectionDelay: 1000,
      autoConnect: true,
      reconnection: true,
      transports: ['websocket'] // 'polling'
    })
    socket.on('connect', () => {
      // console.log(`[client ${id}] connected`);
    })
    socket.on('disconnect', () => {
      // console.log(`[client ${id}] disconnected`);
    })
    sockets.push(socket)
    return socket
  }

  it('should echo a message to a client', done => {
    const socket = makeSocket()
    socket.emit('message', 'hello world')
    socket.on('message', msg => {
      console.log(`[client] received '${msg}'`)
      expect(msg).to.equal('hello world')
      done()
    })
  })

  it('should echo messages to multiple clients', () => {
    const sockets = [...Array(+USERS)].map((_, i) => makeSocket(i))
    return Promise.all(sockets.map((socket, id) =>
      new Promise((resolve, reject) => {
        const msgs = randomString(randomInteger(200000, 999999))
        socket.emit('message', msgs)
        socket.on('message', msg => {
          expect(msgs).to.equal(msg)
          resolve()
        })
      })
    ))
  }).timeout(950000)
})
