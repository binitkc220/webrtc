import { useEffect, useRef, useState } from "react";
import io from 'socket.io-client'

const socket = io('/webRTCPeers', { path: '/webrtc' })

//Silent Audio Stream
// let silence = () => {
//   let ctx = new AudioContext(), oscillator = ctx.createOscillator();
//   let dst = oscillator.connect(ctx.createMediaStreamDestination());
//   oscillator.start();
//   return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
// }

//Black Canvs Video Stream
let blackVideo = ({ width = 640, height = 480 } = {}) => {
  let canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d");
  setInterval(() => ctx.clearRect(0, 0, 1, 1), 500);
  ctx.clearRect(0, 0, 1, 1);
  const canvas_stream = canvas.captureStream();
  return Object.assign(canvas_stream.getVideoTracks()[0], { enabled: false });
}

function App() {
  //Audio call or video call
  const callType = 'audio'

  //Set Local and Remote Video streams
  const [localVideoRef, setLocalVideoRef] = useState()
  const [localAudio, setLocalAudio] = useState()
  const [remoteStream, setRemoteStream] = useState()

  //Local and remote video and audio muted or not
  const [localVideoMuted, setLocalVideoMuted] = useState(true)
  const [localAudioMuted, setLocalAudioMuted] = useState(false)
  const [remoteVideoMuted, setRemoteVideoMuted] = useState(true)
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(true)

  const dataChannelRef = useRef()
  const pc = useRef(new RTCPeerConnection(null))
  const candidates = useRef([])


  const [offerVisible, setOfferVisible] = useState(true)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [hangupVisible, setHangupVisible] = useState(false)
  const [status, setStatus] = useState("Call Now !")

  const [dataChannelConnectionStatus, setDataChannelConnectionStatus] = useState()


  //Get User video and microphone
  useEffect(() => {

    socket.on('connection-success', success => {
      // console.log(success)
    })
    socket.on('sdp', data => {
      console.log(JSON.stringify(data.sdp))
      pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp))
      if (data.sdp.type === 'offer') {
        setOfferVisible(false)
        setAnswerVisible(true)
        setStatus("Incoming Call...")
      } else {
        setStatus("Call established")
        setHangupVisible(true)
      }
    })
    socket.on('candidate', candidate => {
      console.log(candidate)
      // candidates.current = [ ...candidates.current, candidate ]
      pc.current.addIceCandidate(new RTCIceCandidate(candidate))
    })
    socket.on('hangup', _ => {
      console.log('Ending call');
      setHangupVisible(false)
      hangup()
    })

    //peer connections
    var peerConfiguration = {
      "iceServers": [{ "url": "stun:stun.1.google.com:19302" }]
    };
    const _pc = new RTCPeerConnection(peerConfiguration)

    _pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log(JSON.stringify(e.candidate))
        socket.emit('candidate', e.candidate)
      }
    }
    _pc.oniceconnectionstatechange = (e) => {
      console.log(e)
    }
    _pc.ontrack = (e) => {
      //we got stream
      console.log(e.streams[0].getTracks())
      setRemoteStream(e.streams[0])
    }
    //setup data channel
    const dataChannel = _pc.createDataChannel("data")
    _pc.addEventListener(
      "datachannel",
      (ev) => {
        let receiveChannel = ev.channel;
        receiveChannel.onmessage = dataChannelMessage;
        setDataChannelConnectionStatus(receiveChannel.readyState);
      },
      false,
    );

    //Initial Device setup
    if (callType === 'audio') {
      navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        .then(stream => {
          let videoTrack = new MediaStream([blackVideo()])
          videoTrack.getVideoTracks()[0].enabled = false;
          let initialBlackVideo = new MediaStream([...videoTrack.getVideoTracks(), ...stream.getAudioTracks()])
          setLocalAudio(new MediaStream([stream.getAudioTracks()[0]]))
          initialBlackVideo.getTracks().forEach(track => {
            _pc.addTrack(track, initialBlackVideo)
          })
          setLocalAudioMuted(false)
        })
        .catch(e => {
          console.log("Get user media error ", e)
          setLocalAudioMuted(true)
        })
    }
    else {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          // setLocalStream(stream)
          setLocalAudio(new MediaStream([stream.getAudioTracks()[0]]))
          setLocalVideoRef(new MediaStream([stream.getVideoTracks()[0]]))
          stream.getTracks().forEach(track => {
            _pc.addTrack(track, stream)
          })
          setLocalAudioMuted(false)
          setLocalVideoMuted(false)
        })
        .catch(e => {
          setLocalAudioMuted(true)
          setLocalVideoMuted(true)
          console.log("Get user media error ", e)
        })
    }

    pc.current = _pc
    dataChannelRef.current = dataChannel
  }, [])

  const sendToPeer = (eventType, payload) => {
    socket.emit(eventType, payload)
  }

  const processSDP = (sdp) => {
    console.log(JSON.stringify(sdp))
    pc.current.setLocalDescription(sdp)
    sendToPeer('sdp', { sdp })
  }

  const createOffer = () => {
    pc.current.createOffer({
      offerToReceiveVideo: 1,
      offerToReceiveAudio: 1
    })
      .then(sdp => {
        setOfferVisible(false)
        setStatus("calling...")
        processSDP(sdp)
      })
      .catch(e => console.log(e))
  }

  const createAnswer = () => {
    pc.current.createAnswer({
      offerToReceiveVideo: 1,
      offerToReceiveAudio: 1
    })
      .then(ans => {
        setAnswerVisible(false)
        setStatus("call established")
        setHangupVisible(true)
        processSDP(ans)

      })
      .catch(e => console.log(e))
  }

  // const setRemoteDescription = () => {
  //   const sdp = JSON.parse(textRef.current.value)
  //   console.log(sdp)

  //   pc.current.setRemoteDescription(new RTCSessionDescription(sdp))
  // }

  // const addCandidate = () => {
  //   // const candidate = JSON.parse(textRef.current.value)
  //   // console.log("Adding ice canditate : ", candidate)
  //   candidates.forEach(candidate => {
  //     console.log(candidate)
  //   })
  //   // pc.current.addIceCandidate(new RTCIceCandidate(candidate))
  // }

  function dataChannelMessage(e) {
    //on receing message on data channel
    console.log("datatatatata", JSON.parse(e.data))
    const remoteStreamData = JSON.parse(e.data)
    setRemoteAudioMuted(remoteStreamData.audioMuted)
    setRemoteVideoMuted(remoteStreamData.videoMuted)
  }
  useEffect(() => {
    // console.log("ready state", dataChannelConnectionStatus)
    if (dataChannelConnectionStatus === 'open') {
      let data = { audioMuted: localAudioMuted, videoMuted: localVideoMuted }
      dataChannelRef.current.send(JSON.stringify(data))
      // console.log("audio : ", localAudioMuted)
      // console.log("video : ", localVideoMuted)
    }
  }, [localAudioMuted, localVideoMuted, dataChannelConnectionStatus])

  const hangup = () => {
    pc.current.getSenders().forEach(sender => sender.track.stop())
    pc.current.close()
    pc.current = null;
    if (localAudio) {
      localAudio.getAudioTracks().forEach(track => track.stop())
    }
    if (localVideoRef) {
      localVideoRef.getVideoTracks().forEach(track => track.stop())
    }
  }

  const toggleAudio = () => {
    if (localAudio) {
      if (localAudio.getAudioTracks()[0].enabled) {
        localAudio.getAudioTracks().forEach(track => track.stop())
        localAudio.getAudioTracks()[0].enabled = false;
        setLocalAudioMuted(true)
      }
      else {
        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          .then(stream => {
            setLocalAudio(stream)
            const AudioSender = pc.current.getSenders().find(sender => sender.track.kind === "audio");
            AudioSender.replaceTrack(stream.getAudioTracks()[0]);
            setLocalAudioMuted(false)
          })
          .catch(e => {
            console.log("Get user media error ", e)
            setLocalAudioMuted(true)
          })
      }
    }
  };

  const toggleVideo = () => {
    if (localVideoRef) {
      if (localVideoRef.getVideoTracks()[0].enabled) {
        //then mute video
        localVideoRef.getVideoTracks().forEach(track => track.stop())
        localVideoRef.getVideoTracks()[0].enabled = false;
        // console.log(localVideoRef.getVideoTracks())
        setLocalVideoMuted(true)
      }
      else {
        //then unmute video
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then(stream => {
            setLocalVideoRef(stream)
            const videoSender = pc.current.getSenders().find(sender => sender.track.kind === "video");
            videoSender.replaceTrack(stream.getVideoTracks()[0]);
            setLocalVideoMuted(false)
          })
          .catch(e => {
            console.log("Get user media error ", e)
            setLocalVideoMuted(true)
          })
      }
    }
    else {
      //if audio call is upgraded to video call
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          setLocalVideoRef(stream)
          const videoSender = pc.current.getSenders().find(sender => sender.track.kind === "video");
          videoSender.replaceTrack(stream.getVideoTracks()[0]);
          setLocalVideoMuted(false)
        })
        .catch(e => {
          console.log("Get user media error ", e)
          setLocalVideoMuted(true)
        })
    }
  };

  const onHangup = () => {
    console.log('Ending call');
    socket.emit('hangup')
    setHangupVisible(false)
    hangup()
  }

  const printTrack = () => {
    const tracks = pc.current.getSenders().map(sender => sender.track);
    console.log(tracks);
  }
  const printRemoteTrack = () => {
    console.log(remoteStream.getTracks())
  }

  const showHideButtons = () => {
    if (offerVisible) {
      return (
        <button onClick={createOffer}>Call</button>
      )
    }
    else if (answerVisible) {
      return (
        <button onClick={createAnswer}>Answer</button>
      )
    }
    else if (hangupVisible) {
      return (
        <>
          <button onClick={toggleVideo}>{localVideoMuted ? 'Enable Video' : 'Disable Video'}</button>
          <button onClick={toggleAudio}>{localAudioMuted ? 'Unmute Mic' : 'Mute Mic'}</button><br />
          <button onClick={onHangup}>Hangup</button>
        </>
      )
    }
  }

  return (
    <div style={{ margin: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ margin: 5, width: 240, height: 240, backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {localVideoMuted ?
            <p style={{ color: 'white' }}>Video off</p> :
            <video
              ref={(ref) => (ref ? (ref.srcObject = localVideoRef) : null)}
              autoPlay
              muted
              width="100%"
            />
          }
        </div>
        <div style={{ margin: 5, width: 240, height: 240, backgroundColor: 'black', display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'white' }}>{remoteAudioMuted?'Mic Off':''}</p>
          {remoteVideoMuted && <p style={{ color: 'white' }}>Video off</p>}
          <video
            ref={(ref) => (ref ? (ref.srcObject = remoteStream) : null)}
            autoPlay
            width={`${remoteVideoMuted?'0%':'100%'}`}
          />
        </div>
      </div>
      <br />
      {showHideButtons()}
      <div>{status}</div>

      {/* <button onClick={printTrack}>Print Track</button>
      <button onClick={printRemoteTrack}>Print Incoming Track</button> */}

      {/* <button onClick={createOffer}>Creater Offer</button>
      <button onClick={createAnswer}>Creater Answer</button>
      <br/> */}

      {/* <textarea ref={textRef} />
      <br/>
      <button onClick={setRemoteDescription}>Set Remote Description</button>
      <button onClick={addCandidate}>Add Candidate</button> */}

    </div>
  );
}

export default App;
