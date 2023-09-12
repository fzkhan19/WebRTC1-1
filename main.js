// Import styles
import "./style.css";

// Import Firebase and Firestore
import firebase from "firebase/app";
import "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "add-config",
  authDomain: "add-config",
  projectId: "add-config",
  storageBucket: "add-config",
  messagingSenderId: "add-config",
  appId: "add-config",
  measurementId: "add-config",
};

// Initialize Firebase if it's not already initialized
if (!firebase.apps.length) {
  console.log("Initialize");
  firebase.initializeApp(firebaseConfig);
} else {
  console.log("Initialization Failed");
}
const firestore = firebase.firestore();

// STUN server configuration
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global state for WebRTC
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById("webcamButton");
const webcamVideo = document.getElementById("webcamVideo");
const callButton = document.getElementById("callButton");
const callInput = document.getElementById("callInput");
const answerButton = document.getElementById("answerButton");
const remoteVideo = document.getElementById("remoteVideo");
const hangupButton = document.getElementById("hangupButton");

// 1. Setup media sources when the "Webcam" button is clicked
webcamButton.onclick = async () => {
  navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;
  // Get user's media stream with video and audio
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  // Create an empty remote stream
  remoteStream = new MediaStream();

  // Add tracks from the local stream to the peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // When remote tracks arrive, add them to the remote stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  // Display the local stream in the webcam video element
  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  // Enable the "Call" and "Answer" buttons, and disable the "Webcam" button
  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// 2. Create an offer when the "Call" button is clicked
callButton.onclick = async () => {
  // Reference Firestore collections for signaling
  const callDoc = firestore.collection("calls").doc();
  const offerCandidates = callDoc.collection("offerCandidates");
  const answerCandidates = callDoc.collection("answerCandidates");

  // Set the call ID input field to the generated call ID
  callInput.value = callDoc.id;

  // Get local ICE candidates and save them to Firestore
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create an offer description and set it as the local description
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  // Store the offer description in Firestore
  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };
  await callDoc.set({ offer });

  // Listen for the remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add ICE candidates to the peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  // Enable the "Hang Up" button
  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID when the "Answer" button is clicked
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection("calls").doc(callId);
  const answerCandidates = callDoc.collection("answerCandidates");
  const offerCandidates = callDoc.collection("offerCandidates");

  // Get local ICE candidates and save them to Firestore
  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  // Get the offer description from Firestore and set it as the remote description
  const callData = (await callDoc.get()).data();
  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  // Create an answer description and set it as the local description
  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  // Store the answer description in Firestore
  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };
  await callDoc.update({ answer });

  // Listen for ICE candidates from the caller and add them to the peer connection
  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};
