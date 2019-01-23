var socket = require('socket.io-client')('https://webrtc.owldigitaldesign.com')
var wrtc = require('wrtc')
var WebRTC = require('./rtchandler')

var _stream

var webrtc = WebRTC({
    type : 'create',
    debug : true,
    // localIP : '10.10.15.103',
    RTCPeerConnection : wrtc.RTCPeerConnection,
    MediaStream : wrtc.MediaStream,
    socket,
    offerOptions : {
        offerToReceiveVideo : 1
    }
})

const userMediaConstraints = {
    video : true
}
wrtc.getUserMedia(userMediaConstraints)
    .then( stream => {
        // video.srcObject = stream
        webrtc.addStream(stream)
        _stream = stream
        console.log(stream)
    })

socket.on('p2p:init', () => {
    webrtc.createAndSendOffer()
})