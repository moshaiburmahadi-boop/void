import React, { useState, useEffect, useRef } from 'react';
import { Profile, Message } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { callSounds } from '../../utils/callSounds';
import {
  RTC_CONFIG,
  AUDIO_MEDIA_CONSTRAINTS,
  VIDEO_MEDIA_CONSTRAINTS,
  getMediaConstraints,
  setConnectionVideoBitrate,
} from '../../utils/webrtc';

export type CallStatus =
  | 'initiating'
  | 'calling'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'rejected'
  | 'missed'
  | 'failed';

interface CallModalProps {
  isOpen: boolean;
  isCaller: boolean; // True if current user initiated the call
  callType: 'audio' | 'video';
  currentUser: Profile;
  remoteUser: Profile;
  incomingOffer?: any; // RTCSessionDescriptionInit if incoming call
  callId?: string;
  onEndCall: () => void;
  onLogCall?: (callLog: Message) => void;
}

export const formatCallDurationText = (seconds: number, type: 'audio' | 'video', isMissed: boolean): string => {
  const typeLabel = type === 'video' ? 'Video Call' : 'Audio Call';
  if (isMissed || seconds <= 0) {
    return `Missed ${typeLabel}`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${typeLabel} • ${secs}s`;
  }
  return `${typeLabel} • ${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
};

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  isCaller,
  callType,
  currentUser,
  remoteUser,
  incomingOffer,
  callId: initialCallId,
  onEndCall,
  onLogCall,
}) => {
  const [callStatus, setCallStatus] = useState<CallStatus>(isCaller ? 'calling' : 'connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === 'audio');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const signalingChannelRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callIdRef = useRef<string>(initialCallId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  // Call history logging state refs
  const startTimeRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);
  const hasLoggedRef = useRef<boolean>(false);
  const callStatusRef = useRef<CallStatus>(callStatus);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Format Call Duration Seconds -> MM:SS
  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Record and persist call log & notification
  const recordCallLog = async (overrideStatus?: CallStatus) => {
    if (hasLoggedRef.current) return;
    hasLoggedRef.current = true;

    const currentDuration =
      durationRef.current > 0
        ? durationRef.current
        : startTimeRef.current
        ? Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000))
        : 0;

    const statusToCheck = overrideStatus || callStatusRef.current;
    const isConnected = statusToCheck === 'connected' || currentDuration > 0;
    const finalStatus = isConnected ? 'completed' : 'missed';
    const content = formatCallLogContentText(currentDuration, callType, !isConnected);

    const callLog: Message = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender_id: currentUser.id,
      receiver_id: remoteUser.id,
      content,
      created_at: new Date().toISOString(),
      message_type: 'call',
      call_status: finalStatus,
      call_type: callType,
      duration_seconds: isConnected ? currentDuration : null,
      sender_profile: currentUser,
      receiver_profile: remoteUser,
    };

    if (onLogCall) {
      onLogCall(callLog);
    }

    // Caller persists the call log in messages & call_sessions & notifications if missed
    if (isCaller && isSupabaseConfigured) {
      try {
        // 1. Insert chat call log message
        await supabase.from('messages').insert({
          sender_id: currentUser.id,
          receiver_id: remoteUser.id,
          content,
          message_type: 'call',
          call_status: finalStatus,
          call_type: callType,
          duration_seconds: isConnected ? currentDuration : null,
        });

        // 2. Update call_sessions table
        await supabase.from('call_sessions').upsert({
          id: callIdRef.current,
          caller_id: currentUser.id,
          receiver_id: remoteUser.id,
          call_type: callType,
          status: isConnected ? 'ended' : 'missed',
          duration_seconds: currentDuration,
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // 3. If call was missed/unanswered, create a persistent notification in notifications table
        if (!isConnected) {
          await supabase.from('notifications').insert({
            user_id: remoteUser.id,
            actor_id: currentUser.id,
            type: callType === 'video' ? 'missed_video_call' : 'missed_audio_call',
          });
        }
      } catch (err) {
        console.warn('Call logging error in Supabase:', err);
      }
    }
  };

  // Helper function for log text formatting
  function formatCallLogContentText(secs: number, type: 'audio' | 'video', isMissed: boolean): string {
    const typeLabel = type === 'video' ? 'Video Call' : 'Audio Call';
    if (isMissed || secs <= 0) {
      return `Missed ${typeLabel}`;
    }
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    if (mins === 0) {
      return `${typeLabel} • ${remainderSecs}s`;
    }
    return `${typeLabel} • ${mins}m ${remainderSecs > 0 ? `${remainderSecs}s` : '00s'}`;
  }

  // Timer counter when call is connected
  useEffect(() => {
    if (callStatus === 'connected') {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      callSounds.stop();
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStatus]);

  // Outgoing ringing audio effect & 30-second ring timeout
  useEffect(() => {
    if (isOpen && isCaller && (callStatus === 'calling' || callStatus === 'initiating')) {
      callSounds.playOutgoingRing();

      // 30-second Ringing Timeout
      ringTimeoutRef.current = setTimeout(() => {
        if (callStatusRef.current === 'calling' || callStatusRef.current === 'initiating') {
          console.log('Call timed out with no answer (30s)');
          setErrorMessage('No answer');
          setCallStatus('ended');
          recordCallLog('missed');
          callSounds.playEndCallTone();
          if (signalingChannelRef.current) {
            signalingChannelRef.current.send({
              type: 'broadcast',
              event: 'call-ended',
              payload: {
                callId: callIdRef.current,
                senderId: currentUser.id,
                reason: 'timeout',
              },
            });
          }
          setTimeout(() => {
            onEndCall();
          }, 1500);
        }
      }, 30000);
    } else {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    }
    return () => {
      callSounds.stop();
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, [isOpen, isCaller, callStatus]);

  // WebRTC & Media Initialization Flow
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const setupSignalingAndMedia = async () => {
      try {
        setErrorMessage(null);

        // 1. Request Local Media Stream with Low-Latency Mobile-Optimized Constraints
        const constraints = getMediaConstraints(callType);

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaErr: any) {
          console.warn('Primary media constraints failed, falling back to basic audio:', mediaErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_MEDIA_CONSTRAINTS });
            setIsVideoDisabled(true);
          } catch (audioErr: any) {
            console.error('Microphone/Camera permission denied:', audioErr);
            if (isMounted) {
              setErrorMessage('Microphone or Camera access was denied. Please allow permissions.');
              setCallStatus('failed');
            }
            return;
          }
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Initialize RTCPeerConnection with Open-Relay TURN and Pool Size
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Add local tracks to RTCPeerConnection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Cap video bitrate at 350kbps to eliminate packet jitter & mobile bufferbloat
        setConnectionVideoBitrate(pc, 350000);

        // Remote Stream Setup
        const remoteStream = new MediaStream();
        remoteStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }

        pc.ontrack = (event) => {
          event.streams[0]?.getTracks().forEach((track) => {
            if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
              remoteStream.addTrack(track);
            }
          });

          const hasVideo = remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled;
          setHasRemoteVideo(hasVideo);

          if (isMounted) {
            setCallStatus('connected');
          }
        };

        // ICE Candidate handler
        pc.onicecandidate = (event) => {
          if (event.candidate && signalingChannelRef.current) {
            signalingChannelRef.current.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: {
                callId: callIdRef.current,
                candidate: event.candidate,
                senderId: currentUser.id,
              },
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (!isMounted) return;
          if (pc.connectionState === 'connected') {
            setCallStatus('connected');
            setConnectionVideoBitrate(pc, 350000);
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            handleHangUp(false);
          }
        };

        // 3. Supabase Signaling Channels
        // Channel for remote target user to receive our events
        const remoteTargetChannel = supabase.channel(`call_room_${remoteUser.id}`);
        // Channel for current user to receive response events
        const myReceiveChannel = supabase.channel(`call_room_${currentUser.id}`);
        signalingChannelRef.current = remoteTargetChannel;

        // Subscribe to incoming signaling events on my channel
        myReceiveChannel
          .on('broadcast', { event: 'call-accepted' }, async (eventPayload) => {
            const { callId, answer } = eventPayload?.payload || {};
            if (callId === callIdRef.current && pcRef.current && answer) {
              try {
                if (pcRef.current.signalingState !== 'stable') {
                  await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                  // Flush queued ICE candidates
                  while (queuedCandidatesRef.current.length > 0) {
                    const candidate = queuedCandidatesRef.current.shift();
                    if (candidate) {
                      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                  }
                }
                setCallStatus('connected');
              } catch (err) {
                console.error('Error setting remote description on caller:', err);
              }
            }
          })
          .on('broadcast', { event: 'call-rejected' }, (eventPayload) => {
            const { callId } = eventPayload?.payload || {};
            if (callId === callIdRef.current) {
              setCallStatus('rejected');
              recordCallLog('rejected');
              callSounds.playEndCallTone();
              setTimeout(() => {
                onEndCall();
              }, 1500);
            }
          })
          .on('broadcast', { event: 'ice-candidate' }, async (eventPayload) => {
            const { callId, candidate } = eventPayload?.payload || {};
            if (callId === callIdRef.current && candidate) {
              try {
                if (pcRef.current && pcRef.current.remoteDescription) {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                  queuedCandidatesRef.current.push(candidate);
                }
              } catch (err) {
                console.warn('Failed to add received ICE candidate:', err);
              }
            }
          })
          .on('broadcast', { event: 'call-ended' }, (eventPayload) => {
            const { callId } = eventPayload?.payload || {};
            if (callId === callIdRef.current) {
              const prev = callStatusRef.current;
              setCallStatus('ended');
              recordCallLog(prev);
              callSounds.playEndCallTone();
              setTimeout(() => {
                onEndCall();
              }, 1200);
            }
          })
          .subscribe();

        // 4. Offer / Answer Execution
        if (isCaller) {
          // Send call offer
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video',
          });
          await pc.setLocalDescription(offer);

          // Wait a short moment for remote channel subscription readiness
          setTimeout(() => {
            if (signalingChannelRef.current && isMounted) {
              signalingChannelRef.current.send({
                type: 'broadcast',
                event: 'call-request',
                payload: {
                  callId: callIdRef.current,
                  callType,
                  senderProfile: currentUser,
                  receiverId: remoteUser.id,
                  offer,
                },
              });
            }
          }, 300);
        } else if (incomingOffer) {
          // Receiver: set remote description from incoming offer and send answer
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));

          // Flush any queued candidates
          while (queuedCandidatesRef.current.length > 0) {
            const candidate = queuedCandidatesRef.current.shift();
            if (candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          setTimeout(() => {
            if (signalingChannelRef.current && isMounted) {
              signalingChannelRef.current.send({
                type: 'broadcast',
                event: 'call-accepted',
                payload: {
                  callId: callIdRef.current,
                  answer,
                  receiverProfile: currentUser,
                },
              });
            }
          }, 200);
        }
      } catch (err: any) {
        console.error('Call initialization error:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to establish call connection.');
          setCallStatus('failed');
        }
      }
    };

    setupSignalingAndMedia();

    return () => {
      isMounted = false;
      recordCallLog();
      cleanupMediaAndPeer();
    };
  }, [isOpen]);

  // Clean up WebRTC tracks and channel resources
  const cleanupMediaAndPeer = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (signalingChannelRef.current) {
      signalingChannelRef.current = null;
    }
    callSounds.stop();
  };

  // Toggle Microphone Mute
  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !isMuted;
        audioTracks.forEach((track) => {
          track.enabled = !nextState;
        });
        setIsMuted(nextState);
      }
    }
  };

  // Toggle Video Camera
  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !isVideoDisabled;
        videoTracks.forEach((track) => {
          track.enabled = !nextState;
        });
        setIsVideoDisabled(nextState);
      } else if (isVideoDisabled) {
        // Upgrade to video dynamically if device allows
        navigator.mediaDevices
          ?.getUserMedia({
            video: {
              width: { ideal: 640, max: 854 },
              height: { ideal: 360, max: 480 },
              frameRate: { ideal: 15, max: 20 },
              facingMode: 'user',
            },
          })
          .then((videoStream) => {
            const newTrack = videoStream.getVideoTracks()[0];
            if (newTrack && localStreamRef.current && pcRef.current) {
              localStreamRef.current.addTrack(newTrack);
              const sender = pcRef.current.addTrack(newTrack, localStreamRef.current);
              try {
                const parameters = sender.getParameters();
                if (!parameters.encodings || parameters.encodings.length === 0) {
                  parameters.encodings = [{}];
                }
                parameters.encodings[0].maxBitrate = 350000;
                parameters.encodings[0].maxFramerate = 20;
                sender.setParameters(parameters).catch(console.warn);
              } catch (_) {}
              setIsVideoDisabled(false);
            }
          })
          .catch((err) => {
            console.warn('Could not activate camera:', err);
          });
      }
    }
  };

  // Toggle Speaker / Output Audio
  const handleToggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerMuted;
      setIsSpeakerMuted(!isSpeakerMuted);
    }
  };

  // Toggle Fullscreen Mode
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Hang Up Call
  const handleHangUp = (broadcastEnd = true) => {
    callSounds.playEndCallTone();
    const prevStatus = callStatusRef.current;
    setCallStatus('ended');
    recordCallLog(prevStatus);

    if (broadcastEnd && signalingChannelRef.current) {
      signalingChannelRef.current.send({
        type: 'broadcast',
        event: 'call-ended',
        payload: {
          callId: callIdRef.current,
          senderId: currentUser.id,
        },
      });
    }

    cleanupMediaAndPeer();

    setTimeout(() => {
      onEndCall();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between select-none overflow-hidden"
      >
        {/* Header Bar */}
        <header className="absolute top-0 left-0 right-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={
                remoteUser.avatar_url ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
              }
              alt={remoteUser.username}
              className="w-10 h-10 rounded-full object-cover border-2 border-neutral-700 shadow-md"
            />
            <div>
              <h2 className="font-bold text-white text-base sm:text-lg leading-tight truncate max-w-[200px] sm:max-w-xs">
                {remoteUser.display_name || remoteUser.username}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#89919d]">@{remoteUser.username}</span>
                <span className="w-1 h-1 rounded-full bg-neutral-600" />
                <span
                  className={`text-xs font-semibold ${
                    callStatus === 'connected'
                      ? 'text-emerald-400'
                      : callStatus === 'rejected' || callStatus === 'failed'
                      ? 'text-red-400'
                      : 'text-[#1d9bf0] animate-pulse'
                  }`}
                >
                  {callStatus === 'calling' && 'Calling...'}
                  {callStatus === 'connecting' && 'Connecting...'}
                  {callStatus === 'connected' && formatDuration(duration)}
                  {callStatus === 'ended' && 'Call Ended'}
                  {callStatus === 'rejected' && 'Call Declined'}
                  {callStatus === 'failed' && 'Connection Failed'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFullscreen}
              className="p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white border border-neutral-800 transition-colors backdrop-blur-md cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Center Main Stage Area (Remote Video / Audio Avatar Waves) */}
        <div className="relative w-full h-full flex items-center justify-center bg-[#070709] overflow-hidden">
          {/* Main Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              callType === 'video' && hasRemoteVideo && callStatus === 'connected'
                ? 'opacity-100'
                : 'opacity-0 absolute pointer-events-none'
            }`}
          />

          {/* Audio Mode or Video-Off Placeholder Canvas */}
          {(!hasRemoteVideo || callType === 'audio' || callStatus !== 'connected') && (
            <div className="flex flex-col items-center justify-center text-center p-6 z-10">
              {/* Pulsing Concentric Sound Waves Effect */}
              <div className="relative flex items-center justify-center my-6">
                {callStatus === 'connected' && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.45, 1], opacity: [0.35, 0.05, 0.35] }}
                      transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                      className="absolute w-44 h-44 rounded-full bg-[#1d9bf0]/25 blur-sm"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.85, 1], opacity: [0.2, 0.02, 0.2] }}
                      transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut', delay: 0.4 }}
                      className="absolute w-44 h-44 rounded-full border border-[#1d9bf0]/30"
                    />
                  </>
                )}

                {callStatus === 'calling' && (
                  <span className="absolute w-40 h-40 rounded-full bg-[#1d9bf0]/20 animate-ping [animation-duration:2.5s]" />
                )}

                <img
                  src={
                    remoteUser.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'
                  }
                  alt={remoteUser.username}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-neutral-800 shadow-2xl relative z-10"
                />
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                {remoteUser.display_name || remoteUser.username}
              </h3>
              <p className="text-sm text-[#89919d] mb-4">
                {callType === 'video' ? 'Video Call' : 'Encrypted Audio Call'}
              </p>

              {/* Sound Wave Bars Visualizer when Connected */}
              {callStatus === 'connected' && (
                <div className="flex items-center gap-1.5 h-8">
                  {[40, 75, 100, 60, 90, 45, 80, 50].map((height, i) => (
                    <motion.span
                      key={i}
                      animate={{ height: ['20%', `${height}%`, '20%'] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8 + (i % 4) * 0.2,
                        ease: 'easeInOut',
                        repeatType: 'mirror',
                      }}
                      className="w-1.5 rounded-full bg-gradient-to-t from-[#1d9bf0] to-cyan-300 shadow-[0_0_8px_rgba(29,155,240,0.5)]"
                    />
                  ))}
                </div>
              )}

              {/* Error Alert Display */}
              {errorMessage && (
                <div className="mt-4 px-4 py-2 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2 max-w-md">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Floating Picture-in-Picture Box for Local Camera Stream */}
          {callType === 'video' && !isVideoDisabled && (
            <motion.div
              drag
              dragConstraints={containerRef}
              dragElastic={0.1}
              className="absolute right-4 bottom-24 sm:right-6 sm:bottom-28 z-30 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-neutral-700 shadow-2xl bg-neutral-900 cursor-grab active:cursor-grabbing backdrop-blur-md"
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] font-bold text-white/90 backdrop-blur-sm">
                You
              </div>
            </motion.div>
          )}
        </div>

        {/* Bottom Floating Controls Bar */}
        <footer className="absolute bottom-0 left-0 right-0 z-30 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-center">
          <div className="flex items-center gap-3 sm:gap-4 px-5 py-3 rounded-full bg-[#16161a]/90 border border-[#27272a] shadow-2xl backdrop-blur-xl">
            {/* Mic Toggle Button */}
            <button
              onClick={handleToggleMic}
              className={`p-3.5 rounded-full transition-all active:scale-95 cursor-pointer ${
                isMuted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-neutral-800/90 text-white hover:bg-neutral-700'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Camera Toggle (If in video call or audio call) */}
            <button
              onClick={handleToggleVideo}
              className={`p-3.5 rounded-full transition-all active:scale-95 cursor-pointer ${
                isVideoDisabled
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-neutral-800/90 text-white hover:bg-neutral-700'
              }`}
              title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
            </button>

            {/* Speaker Mute/Unmute */}
            <button
              onClick={handleToggleSpeaker}
              className={`p-3.5 rounded-full transition-all active:scale-95 cursor-pointer ${
                isSpeakerMuted
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-neutral-800/90 text-white hover:bg-neutral-700'
              }`}
              title={isSpeakerMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* End Call Button */}
            <button
              onClick={() => handleHangUp(true)}
              className="p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/40 transition-all active:scale-95 cursor-pointer ml-1 sm:ml-2"
              title="End Call"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </footer>
      </div>
    </AnimatePresence>
  );
};
