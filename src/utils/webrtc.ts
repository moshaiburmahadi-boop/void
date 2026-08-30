// WebRTC configuration and connection helper for Void

export const getIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ];

  // Optional custom TURN servers via environment variables
  const customTurnUrl = (import.meta as any).env?.VITE_TURN_SERVER_URL;
  const customTurnUser = (import.meta as any).env?.VITE_TURN_USERNAME;
  const customTurnCredential = (import.meta as any).env?.VITE_TURN_CREDENTIAL;

  if (customTurnUrl) {
    servers.push({
      urls: customTurnUrl.split(','),
      username: customTurnUser || undefined,
      credential: customTurnCredential || undefined,
    });
  } else {
    // OpenRelay STUN / TURN servers for NAT traversal
    servers.push(
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelay',
        credential: 'openrelay',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelay',
        credential: 'openrelay',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelay',
        credential: 'openrelay',
      }
    );
  }

  return servers;
};

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: getIceServers(),
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Priority audio constraints for clear, echo-free voice calls
export const AUDIO_MEDIA_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  channelCount: { ideal: 1 },
};

// Adaptive video constraints optimized for mobile stability
export const VIDEO_MEDIA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640, max: 854 },
  height: { ideal: 360, max: 480 },
  frameRate: { ideal: 15, max: 24 },
  facingMode: 'user',
};

export const getMediaConstraints = (callType: 'audio' | 'video'): MediaStreamConstraints => {
  return {
    audio: AUDIO_MEDIA_CONSTRAINTS,
    video: callType === 'video' ? VIDEO_MEDIA_CONSTRAINTS : false,
  };
};

/**
 * Limit video sender bitrate on a peer connection to prevent packet drops and buffer bloat
 */
export async function setConnectionVideoBitrate(
  pc: RTCPeerConnection,
  maxBitrateBps: number = 350000
) {
  try {
    const senders = pc.getSenders();
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
    if (videoSender) {
      const parameters = videoSender.getParameters();
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}];
      }
      parameters.encodings[0].maxBitrate = maxBitrateBps;
      parameters.encodings[0].maxFramerate = 20;
      await videoSender.setParameters(parameters);
    }
  } catch (err) {
    console.warn('Could not set video bitrate limit:', err);
  }
}

/**
 * Limit video sender bitrate to prevent packet drops and buffer bloat
 */
export async function setSenderMaxBitrate(
  sender: RTCRtpSender,
  maxBitrateBps: number = 350000
) {
  try {
    if (!sender.track || sender.track.kind !== 'video') return;
    const parameters = sender.getParameters();
    if (!parameters.encodings || parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    }
    parameters.encodings[0].maxBitrate = maxBitrateBps;
    await sender.setParameters(parameters);
  } catch (err) {
    console.warn('Could not set video bitrate limit:', err);
  }
}
