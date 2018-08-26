var message = document.getElementById("message");
var send = document.getElementById("send");
var messageList = document.getElementById("message-list");

var roomName = 'webrtc-room';

var rtcPeerConnection;
var dataChannel;
var dataChannelOptions;

this.iceServers = {
    'iceServers': [{
            url: 'turn:159.65.158.36:3478',
            username: 'frappe',
            credential: 'frappe'
        },
    ]
};

var isCaller;

var socket = io();

initiateCall();

function initiateCall() {

    dataChannelOptions = {
        ordered: false, // do not guarantee order
        maxRetransmitTime: 3000, // in milliseconds
    };

    socket.emit('create or join', roomName);
}

socket.on('created', function (room) {
    isCaller = true;
    console.log("Caller joined");
});

socket.on('joined', function (room) {
    socket.emit('ready', roomName);
    console.log("Receiver joined");
});

socket.on('candidate', function (event) {
    var candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate
    });
    rtcPeerConnection.addIceCandidate(candidate);
});

socket.on('ready', function () {
    if (isCaller) {
        createPeerConnection();

        createDataChannel();

        rtcPeerConnection.createOffer()
            .then(desc => setLocalAndOffer(desc))
            .catch(e => console.log(e));
    }
});


socket.on('offer', function (event) {
    if (!isCaller) {
        createPeerConnection();
        createDataChannel();
        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
        rtcPeerConnection.createAnswer()
            .then(desc => setLocalAndAnswer(desc))
            .catch(e => console.log(e));
    }
});


function createPeerConnection() {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
}

function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate');
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            room: roomName
        })
    }
}

function createDataChannel(){

    dataChannel = rtcPeerConnection.createDataChannel("myLabel", dataChannelOptions);

    dataChannel.onerror = function (error) {
        console.log("Data Channel Error:", error);
    };
    
    dataChannel.onopen = function () {
        console.log("The Data Channel is Open");
    };
    
    dataChannel.onclose = function () {
        console.log("The Data Channel is Closed");
    };

    rtcPeerConnection.ondatachannel = receiveChannelCallback;
}

function receiveChannelCallback(event) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = handleReceiveMessage;
}

function handleReceiveMessage(event){
    console.log(event.data);

    var div = document.createElement("div");
    div.setAttribute("style","border:0.5px solid grey; margin:1%; padding:1%");
    var data = document.createTextNode("Sender : "+event.data);
    div.appendChild(data);
    messageList.appendChild(div);
}

function setLocalAndOffer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit('offer', {
        type: 'offer',
        sdp: sessionDescription,
        room: roomName
    });
}

function setLocalAndAnswer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit('answer', {
        type: 'answer',
        sdp: sessionDescription,
        room: roomName
    });
}

socket.on('answer', function (event) {
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
})

send.onclick = function(){
    var text = message.value;
    dataChannel.send(text);

    var div = document.createElement("div");
    div.setAttribute("style","border:0.5px solid grey; margin:1%; padding:1%");
    var data = document.createTextNode("You : "+text);
    div.appendChild(data);
    messageList.appendChild(div);
}