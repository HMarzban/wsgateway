/* eslint-env mocha */
const path = require('path')
const dotEnvPath = path.resolve(__dirname, './')
require('dotenv-flow').config({
  default_node_env: 'test',
  path: dotEnvPath,
  silent: true
})

const { SOCKET_URL, PORT, NAMESPACE, USERS, MIN_MSG_LENGTH, MAX_MSG_LENGTH } = process.env

const SERVER_ADDRESS = PORT ? `${SOCKET_URL}:${PORT}` : `${SOCKET_URL}`

const { expect } = require('chai')
const axios = require('axios').default
const io = require('socket.io-client')
const socketUrl = `${SERVER_ADDRESS}/${NAMESPACE}`

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

axios.defaults.baseURL = SERVER_ADDRESS

const getHealthCheck = () => {
  return axios.get('/healthcheck')
    .then(res => res.data)
    .catch(error => console.log(error.message))
}

describe('server', function () {
  this.timeout(3000)

  let sockets = []
  beforeEach(() => {
    sockets = []
  })
  afterEach(() => {
    // sockets.forEach(e => e.disconnect())
  })

  const makeSocket = (id = 0) => {
    return new Promise((resolve) => {
      const socket = io.connect(socketUrl, {
        reconnectionDelay: 1000,
        autoConnect: true,
        reconnection: true,
        transports: ['websocket'] // 'polling'
      })
      socket.on('connect', () => {
        // console.log(`[client ${id}] connected`);
        resolve(socket)
      })
      socket.on('disconnect', () => {
        console.log(`[client ${id}] disconnected`)
      })
      sockets.push(socket)
      // return socket
    })
  }

  it('Server healthcheck', function () {
    return new Promise(async resolve => {
      const res = await getHealthCheck()
      expect(typeof res).to.equal('object')
      expect(res.status).to.be.true
      expect(res.pId).to.be.a('number')
      resolve()
    })
  }).timeout(9000)

  // it('Server healthcheck, cluster check, each pId request must be different', function () {
  //   const pdids = []
  //   return Promise.all([...Array(2)].map(() => {
  //     return new Promise(async resolve => {
  //       const res = await getHealthCheck()
  //       pdids.push(res.pId)
  //       expect(typeof res).to.equal('object')
  //       expect(res.status).to.be.true
  //       expect(res.pId).to.be.a('number')
  //       expect(pdids.filter(x => x === res.pId)).to.have.lengthOf(1)
  //       resolve()
  //     })
  //   }))
  // }).timeout(9000)

  it('should echo a message to a client', () => {
    return makeSocket().then(socket => {
      return new Promise(resolve => {
        console.log('alksdkjalksjdlkjlajsd')
        socket.emit('message', 'hello world')
        socket.on('message', msg => {
          expect(msg).to.equal('hello world')
          resolve()
        })
      })
    })
  }).timeout(1000 * 60 * 3) // 3 min

  it(`should echo messages to multiple clients -${USERS}-`, () => {
    Promise.all([...Array(+USERS)].map((_, i) => makeSocket(i)))
      .then(sockets => {
        return Promise.all(sockets.map((socket, id) =>
          new Promise((resolve, reject) => {
            const msgs = randomString(randomInteger(+MIN_MSG_LENGTH, +MAX_MSG_LENGTH)) + '_U' + id
            socket.emit('message', msgs)
            socket.on('message', msg => {
              expect(msgs).to.equal(msg)
              resolve()
            })
          })
        ))
      })
  }).timeout(1000 * 60 * 3) // 3 min

  it(`Users join with a delay then wait for 30 sec, then a random client broadcast a message -${USERS}-`, function (done) {
    let count = 0
    const listenGroup = sockets => {
      sockets.map((socket, id) => {
        return new Promise((resolve, reject) => {
          socket.on('broadCastMessage', (msg) => {
            count++
            expect(msg).to.equal('the game will start soon')
            resolve()
          })
        })
      })
    }

    Promise.all(
      [...Array(+USERS)].map((_, i) => {
        return new Promise(resolve => {
          setTimeout(async () => {
            makeSocket(i).then(socket => {
              resolve(socket)
            })
          }, randomInteger(1000, 7000))
        })
      })
    ).then(async sockets => {
      await listenGroup(sockets)
      return sockets
    }).then(sockets => {
      return new Promise(resolve => {
        const user = sockets[randomInteger(0, sockets.length)]
        // wait for all users event message set
        setTimeout(() => {
          user.emit('broadCastMessage', 'First user acknowledge')
          resolve()
        }, 500)
      })
    }).then(() => {
      setTimeout(() => {
        expect(count).to.equal(+USERS)
        done()
      }, 2000)
    })
  }).timeout(1000 * 60 * 6) // 6 min

  // 1/ All users connecting to socket
  // 2/ A random user send message to server
  // 3/ The server must send a message to all users connected to the server
  // it(`A client should broadcast a message to all users -${USERS}-`, async function(done) {
  //   const sockets = await Promise.all([...Array(+USERS)].map(async (_, i) =>  makeSocket(i)))
  //   let count = 0
  //   const sendACK = () => {
  //     return new Promise(resolve => {
  //       // select random user
  //       const user = sockets[randomInteger(0, sockets.length)]
  //       // wait for all users event message set
  //       setTimeout(() => {
  //         user.emit('broadCastMessage', 'First user acknowledge')
  //         resolve()
  //       }, 300)
  //     })
  //   }

  //   const listenGroup = sockets.map((socket, id) => {
  //     return new Promise((resolve, reject) => {
  //       socket.on('broadCastMessage', (msg) => {
  //         count++
  //         expect(msg).to.equal('the game will start soon')
  //         resolve()
  //       })
  //     })
  //   })

  //   const totalMessage = () => {
  //     return new Promise(resolve => {
  //       expect(count).to.equal(+USERS)
  //       resolve()
  //     })
  //   }

  //   return Promise.all([
  //     ...listenGroup,
  //     sendACK()
  //   ]).then(()=>{
  // 		totalMessage()
  // 	})
  // }).timeout(1000 * 60 * 3) // 3 min
})
