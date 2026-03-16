export const SIGNALING_MESSAGE_SHAPES = {
  joinSession: {
    sessionId: "string"
  },
  offer: {
    sessionId: "string",
    description: "RTCSessionDescriptionInit"
  },
  answer: {
    sessionId: "string",
    description: "RTCSessionDescriptionInit"
  },
  iceCandidate: {
    sessionId: "string",
    candidate: "RTCIceCandidateInit"
  }
};
