let APP_ID = "a674f2ab39804f0daf8fd479cfd63996" //this is the id of agora signaling
let token = null;   //this is the token which is used for authentication with agora . in this project we will be not using it.
let userId = Math.floor(Math.random()*10000).toString()   // this is the unique userId for each user.

//variables for agora server
let client; //client who is using the agora server
let channel;    // the communication link or tunnel where both the users can talk

//room query
let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers : [
        {
            urls:['stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']
        }
        
    ]
}

const constraints = {
    video:{
        width:{min:640,ideal:1920,max:1920},
        height:{min:480,ideal:1080,max:1080}
    },
    audio:true
}


const init = async () => {
    //creating the Agora instance in client and login in that client using its userID
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid:userId,token})
    console.log("my MemberID"+userId)

    //index.html?room=12345 , the main can be replaced by the roomID later
    channel =  client.createChannel(roomId)
    await channel.join()

    //if any other user is joined then we can listen to that event using MemberJoined event
    channel.on('MemberJoined', handleUserJoined)

    channel.on('MemberLeft', handleUserLeft)

    //this event listener is to listen to message given by other client
    client.on('MessageFromPeer', handleMessageFromPeer)

    //getting the access to user media devices
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    //assigning it to user-1 video player
    document.getElementById('user-1').srcObject = localStream;
}

let handleUserJoined = async (MemberId) => {
    console.log("A new user Joined the channel: ",MemberId)
    //generate offer
    createOffer(MemberId);
}

let handleUserLeft = async (MemberId) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-2').classList.remove('smallFrame');
}

let handleMessageFromPeer = async (message,MemberId) => {
    message = JSON.parse(message.text)

    if(message.type === 'offer'){
        createAnswer(MemberId,message.offer)
    }
    if(message.type === 'answer'){
        addAnswer(message.answer)
    }
    if(message.type === 'candidate'){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate)
        }
    }
}

const createPeerConnection = async (MemberId) => {
    //initializing all the RTC connection methods in peerConnection
    peerConnection = new RTCPeerConnection(servers);

    //creating a general mediastream and providing it to user-2.after we get the real remotestream we will replace it.
    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';
    document.getElementById('user-2').classList.add('smallFrame')

    if(!localStream) {//if local stream is not available then create it 
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('user-1').srcObject = localStream;
    }

    //adding the local video tracks to peerconnection and making it ready to send over peerconenction to user-2 
    localStream.getTracks().forEach( track => {
        peerConnection.addTrack(track,localStream)
    })

    //listening to event of peer connection to gett the remote tracks when they are ready. we receive the remote track and pass it on to remotestream.
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach( (track) => {
            remoteStream.addTrack(track)
        })
    }

    //this is a event listener which listenes to the new candidates created by stun servers just after we set the localDescription in the offer
    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            //sending the candidates to other use as sonn as it is generated
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate','candidate':event.candidate})},MemberId)
        }
    }
}

const createOffer = async (MemberId) => {
    
    await createPeerConnection(MemberId);

    //creating the offer and setting the local description of user-1 in offer
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    //setLocalDescription fires the stun servers to create new ice candidates and we need to listen to stun servers
    //for whaterver ice candidates are created and that is done by listening to onicecandidates event.

    console.log("offer : ",offer);

    //now we are going to send this offer to peer
    client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId)
    //to listen to this message a event listener of client 'MessagefromPeer' is made at top 
}

const createAnswer = async (MemberId,offer) => {
    await createPeerConnection(MemberId);

    //the offer received by user-2 will be used as his remote description 
    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer','answer':answer})},MemberId)
}

let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

//to on and off camera connections
let toggleCamera = async () => {
    //get the video tracks
    let videoTrack = localStream.getTracks().find( track => track.kind === 'video')

    //if video track is enabled make it unenabled
    if(videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)'
    }
    else{//if it is off then make it on 
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249,0.9)'
    }
}

//to on and off mic connections
let toggleAudio = async () => {
    //get the video tracks
    let audioTrack = localStream.getTracks().find( track => track.kind === 'audio')

    //if video track is enabled make it unenabled
    if(audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255,80,80)'
    }
    else{//if it is off then make it on 
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179,102,249,0.9)'
    }
}

//listening to leavechannel event
window.addEventListener('beforeunload', leaveChannel)
//listening to camera btn click event 
document.getElementById('camera-btn').addEventListener('click',toggleCamera)
//listening to mic btn click event 
document.getElementById('mic-btn').addEventListener('click',toggleAudio)

init();