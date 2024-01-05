const express = require('express')

const io = require('socket.io')({
    path:'/webrtc'
})

const app = express()
const port = 8080

app.get('/', (req,res) => res.send("Hello !"))

const server = app.listen(port, ()=>{
    console.log(`WebRTC signaling server is running on port ${port}`)
})

io.listen(server)

const webRTCNamespace = io.of('/webRTCPeers')

webRTCNamespace.on('connection', socket => {
    console.log(socket.id)

    socket.emit('connection-success',{
        status: 'connection-success',
        socketID: socket.id
    })

    socket.on('sdp', data => {
        socket.broadcast.emit('sdp', data)
    })

    socket.on('candidate', data => {
        socket.broadcast.emit('candidate', data)
    })

    socket.on('hangup', _ => {
        console.log("hangup")
        socket.broadcast.emit('hangup')
    })

    socket.on('disconnect', ()=>{
        console.log(`${socket.id} has disconnected.`)
    })
})