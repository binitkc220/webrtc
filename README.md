# WebRTC - Audio/Video Call - ReactJS

This project demonstrates the use of webRTC for realtime video and audio call between two peers. A signlaing server is used using express and socket.io to transmit sdp among peers and establish a connection. A data channel of webRTC is also used to trasmit information about webcam/microphone on/off. You can mute or umute yourself as well as turn on or off your video.

**Note: During audio call while turning video on, it is not working for chrome.**

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## To run this project locally

In the project directory, you can run:

### `node server.js`

Starts the signaling server.

### `npm start`

Runs the app in the development mode.


Now, run app in two different tabs. Start Call from one app and Receive call from another app. And that's it, the connection is now estalibshed between two peers.
