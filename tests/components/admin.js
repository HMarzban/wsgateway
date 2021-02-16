exports.init = (io, { pid, namespace, preservedNamespace }) => {
  io.on('connection', (socket) => {
    console.log('client connected ..' + socket.id + '..cluster' + process.pid)
    socket.on('message', (data) => {
      // console.log(
      // `msg: ${data}, pid: ${(data, process.pid)}, socketId: ${socket.id}`
      // )
      socket.emit('message', data)
    })
  })
}
