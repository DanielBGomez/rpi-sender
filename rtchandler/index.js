/**
 * Custom framework for WebRTC Communication and streaming
 * 
 * @class WebRTCHandler
 * @version 1.0.0-alpha
 * @author Daniel B Gomez <contact@danielbgomez.com>
 * @author Owl Digital Design <contact@owldigitaldesign.com>
 * 
 * @requires socket     Socket.io instance to signaler server
 * @requires stream     MediaStream instance with video/audio to send if so
 */

// WebRTC Classes
var RTCPeerConnectionClass
var MediaStreamClass

// Main class
class WebRTCHandler {
    constructor(params = {}){
        // Local Description
        this.sdp
        this.remoteSdp
        this.stream
        this.remoteStreams

        this.localIP = params.localIP || false

        this._prefix = params.prefix || "WebRTC"
        this._socketEvent = params.socketEvent || "p2p:msg"

        try {
            RTCPeerConnectionClass = RTCPeerConnection
        } catch (err) {
            RTCPeerConnectionClass = params.RTCPeerConnection || false
        }

        // Offer options
        this.offerOptions = params.offerOptions
        // Sender or receiver?
        this.type = params.type || "create"
        // Debug flag
        this.debug = params.debug || false
        // Socket IO
        this.socket = params.socket || socket || false
        // New RTCPeerConnection 
        this.pc = new RTCPeerConnectionClass(params.iceServers || { urls: [ "stun:stun.l.google.com:19302" ] } )

        // Set OnIceCandidate
        this.pc.onicecandidate = e => this.onIceCandidate(e)
        // Set On Ice Connection State Change [Temp solution]
        this.pc.oniceconnectionstatechange = e => console.log(e)
        this.pc.ontrack = e => this._ontrack(e)

        // User defined functions
        this.gotStream

        // Sockets msg
        this.socket.on(this._socketEvent, res => this._p2pmsg(res))
    }
    /**
     * Add new stream to current RTCPeerConnection
     * 
     * @param {MediaStream} stream 
     */
    addStream(stream){
        return new Promise((resolve, reject) => {
            // if(!(stream instanceof MediaStreamClass)) return reject(this._error('The Stream is not an instance of MediaStream!', stream))
            // Store stream
            this.stream = stream
            try {
                // Add tracks to RTCPeerConnection
                stream.getTracks().forEach(track => {
                    this.pc.addTrack(track, stream)
                    this._log('Track added at the RTCPeerConnection!', track)
                })
                resolve(stream)
            } catch(err){
                reject(this._error('Error adding tracks!', err))
            }
        })
    }
    /**
     * Emits new ICE Candidates through signaling server
     * 
     * @param {Event} e  Event
     */
    onIceCandidate(e){
        try {
            this._log('Sending ICE Candidate', e.candidate)
            this.socket.emit('p2p:msg', {event:'ice', data: e.candidate})
        } catch(err){
            this._log('Error sending ICE Candidate!', err)
        }
    }
    /**
     * Creates an Offer with given offerOptions to generate a RTCSessionDescription, then set as Local description to current RTCPeerConnection and send through signaling server

     * Alias of @see WebRTCHandler._createAndSendDescription with @param type = 'Answer'
     * 
     * @param {RTCOfferOptions} offerOptions    Offer Options
     */
    createAndSendOffer(offerOptions){
        // Just an alias ¯\_(ツ)_/¯
        return this._createAndSendDescription('Offer', offerOptions)
    }
    /**
     * Creates an Answer with given offerOptions to generate a RTCSessionDescription, then set as Local description to current RTCPeerConnection and send through signaling server

     * Alias of @see WebRTCHandler._createAndSendDescription with @param type = 'Answer'
     * 
     * @param {RTCOfferOptions} offerOptions    Offer Options
     */
    createAndSendAnswer(offerOptions){
        // Just an alias ¯\_(ツ)_/¯
        return this._createAndSendDescription('Answer', offerOptions)
    }
    /**
     * Add new ICE Candidate to current RTCPeerConnection
     * 
     * @param {RTCIceCandidate} ice ICE Candidate 
     */
    addIceCandidate(ice){
        return new Promise((resolve, reject) => {
            try {
                this._log('ICE received', ice)
                this.pc.addIceCandidate(ice)
                    .then(() => resolve(this._log(`ICE Added!`, ice))) // Success
                    .catch(err => reject(this._error(`Error adding ICE!`, err))) // Fails
            } catch(err){
                reject('catch Error adding ICE!', err)
            }
        })
    }
    /**
     * Set a Local RTCSessionDescription at the current RTCPeerConnection

     * Alias of @see WebRTCHandler._setDescription with @param type = 'Local'
     * 
     * @param {RTCSessionDescription} sdp Session Description
     */
    setLocalDescription(sdp){
        // Just an alias ¯\_(ツ)_/¯
        return this._setDescription('Local', sdp)
    }
    /**
     * Set a Remote RTCSessionDescription at the current RTCPeerConnection.
     * 
     * Alias of @see WebRTCHandler._setDescription with @param type = 'Remote'
     * 
     * @param {RTCSessionDescription} sdp Session Description
     */
    setRemoteDescription(sdp){
        // Just an alias ¯\_(ツ)_/¯
        return this._setDescription('Remote', sdp)
    }
    /**
     * Close current RTCPeerConnection if not closed
     */
    close(){
        if(this.pc.signalingState == "closed") return this._log('Signaling state is already closed!')
        this._log('Closing signaling')
        return this.pc.close()
    }
    /**
     * Reset RTCPeerConnection params to null 
     */
    reset(){
        // Close connection
        this.close()
        // Reset params
        this.sdp = null
        this.remoteSdp = null
        this.remoteStreams = null
    }
    // Private functions <3

    /**
     * Process data received through signaling server
     * 
     * @param {P2PMSG} res Data received
     */
    _p2pmsg(res){
        this._log('Data received through signaling server!', res)
        switch(res.event){
            case 'reconnect':
                if(this.type.toLowerCase() == "create") this.createAndSendOffer(this.offerOptions)
                break
            case 'reset':
                this.reset()
                break
            case 'ice':
                if(res.data != null) this.addIceCandidate(res.data)
                break
            case 'sdp':
                switch(this.type.toLowerCase()){
                    case 'create':
                        // The creator doesn't does anything after receiving the answer (remote SDP) because this is the last step
                        this.setRemoteDescription(res.data)
                        break
                    case 'join':
                        // The one who joins needs to create and send an answer
                        this.setRemoteDescription(res.data)
                            .then(res => {
                                this.createAndSendAnswer(this.offerOptions)
                            })
                }
                break
            case 'connected':
                if(this.type.toLowerCase() == "create") this.createOffer(this.offerOptions)
                break
            default:
                this._error(`Invalid ${this._socketEvent} event!`, res)
        }
    }
    /**
     * Handler of ontrack event to current RTCPeerConnection.
     * Stores remoteStreams and executes this.gotStream method if it's a function
     * 
     * @param {RTCTrackEvent} e Event
     */
    _ontrack(e){
        this.remoteStreams = e.streams
        if(typeof this.gotStream == "function") this.gotStream(e.streams)
    }
    /**
     * Creates an [ offer | answer ] with given offerOptions to generate a RTCSessionDescription
     * 
     * @param {string} type                     Offer | Answer
     * @param {RTCOfferOptions} offerOptions    Offer Options
     */
    _createDescription(type, offerOptions){
        return new Promise((resolve, reject) => {
            try {
                this._log(`Creating ${type}`, offerOptions)   
                // Create [type]
                this.pc[`create${type}`](offerOptions)
                    .then( desc => {
                        // Sometimes when working on a LAN, the IP sets to localhost (127.0.0.1) and this affects the communication between 2 different PCs
                        if(this.localIP) desc.sdp = desc.sdp.replace('127.0.0.1', this.localIP)
                        this._log(`${type} created!`, desc)
                        // <3
                        resolve(desc)
                    })
                    .catch(err => { throw err })
            } catch(err) {
                reject(this._error(`Error creating ${type}`, err))
            }
        })
    }
    /**
     * Send Session Description through signaling server
     * 
     * @param {RTCSessionDescription} sdp Sesion Description
     */
    _sendDescription(sdp){
        try {
            // Send
            this._log('Sending description through signaling server')
            return this.socket.emit(this._socketEvent, {event:'sdp', data: sdp})
        } catch(err){
            this._error('Error sending description through signaling server!', err)
        }
    }
    /**
     * Creates an [ offer | answer ] with given offerOptions to generate a RTCSessionDescription, then set as Local description to current RTCPeerConnection and send through signaling server
     * 
     * @param {string} type                     Offer | Answer
     * @param {RTCOfferOptions} offerOptions    Offer Options
     */
    _createAndSendDescription(type, offerOptions){
        return new Promise((resolve, reject) => {
            this._createDescription(type, offerOptions)
                .then( desc => {
                    this._setDescription('Local', desc) // You can use the setLocalDescription method as well
                        .then(e => {
                            // Store current SDP
                            this.sdp = desc
                            // Send
                            this._sendDescription(desc)
                            // <3
                            resolve(desc)
                        })
                })
        })
    }
    /**
     * Set a [ Remote | Local ] RTCSessionDescription to current RTCPeerConnection
     * 
     * @param {string} type                 Remote | Local
     * @param {RTCSessionDescription} sdp   Sesion Description
     */
    _setDescription(type, sdp){
        return new Promise((resolve, reject) => {
            try {
                this._log(`Setting ${type} description`, sdp)   
                // Set [type] description
                this.pc[`set${type}Description`](sdp)
                    .then(() => resolve(this._log(`${type} SDP set!`))) // Success
                    .catch(err => reject(this._error(`Error setting ${type} SDP!`, err))) // Fails
            } catch(err){
                reject(this._error(`Error setting '${type}' SDP!`, err))
            }
        })
    }
    /**
     * Alias to _consoledebug method with a 'log' type
     * 
     * @param {string} msg  Log message 
     * @param {*} data      Log data
     */
    _log(msg, data){
        this._consoledebug('log', `${this._prefix}: ${msg}`, data)
        return { msg, data }
    }
    /**
     * Alias to _consoledebug method with an 'error' type
     * 
     * @param {string} msg  Error message 
     * @param {*} data      Error data
     */
    _error(msg, data){
        this._consoledebug('error', `${this._prefix}: ${msg}`, data)
        return { msg, data }
    }
    /**
     * Executes Console's ${type} method if ${this.debug} is true (or similar)
     * @param {string} type     Console's method               
     * @param  {...any} params  Params to be applied
     */
    _consoledebug(type, ...params){
        if(this.debug){
            params.forEach(msg => {
                if(typeof msg == "string") console[type](msg)
            })
        }
    }
}


module.exports = params => new WebRTCHandler(params)