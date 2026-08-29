import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, Message } from '../types';
import { IncomingCallModal } from '../components/Chat/IncomingCallModal';
import { CallModal } from '../components/Chat/CallModal';
import { dispatchPushNotification, showLocalSystemNotification } from '../utils/pushNotifications';
import { callSounds } from '../utils/callSounds';

interface ActiveCallState {
  isCaller: boolean;
  callType: 'audio' | 'video';
  remoteUser: Profile;
  incomingOffer?: any;
  callId?: string;
}

interface IncomingCallState {
  caller: Profile;
  callType: 'audio' | 'video';
  offer: any;
  callId: string;
}

interface CallContextType {
  activeCall: ActiveCallState | null;
  incomingCall: IncomingCallState | null;
  startCall: (remoteUser: Profile, callType: 'audio' | 'video') => void;
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
  endActiveCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [missedCallNotice, setMissedCallNotice] = useState<{ callerName: string; time: string } | null>(null);

  const activeCallRef = useRef<ActiveCallState | null>(null);
  const incomingCallRef = useRef<IncomingCallState | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // 1. Global listener for incoming calls targeting current user
  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured) return;

    const myCallChannel = supabase.channel(`call_room_${profile.id}`);

    myCallChannel
      .on('broadcast', { event: 'call-request' }, (payload) => {
        const { senderProfile, callType, offer, callId } = payload?.payload || {};
        if (senderProfile && offer && callId) {
          // If already in a call, automatically reject with busy
          if (activeCallRef.current) {
            const rejectChannel = supabase.channel(`call_room_${senderProfile.id}`);
            rejectChannel.send({
              type: 'broadcast',
              event: 'call-rejected',
              payload: { callId, reason: 'busy' },
            });
            return;
          }

          setIncomingCall({
            caller: senderProfile,
            callType: callType || 'video',
            offer,
            callId,
          });

          // If current tab is in background / hidden, show local system notification
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            showLocalSystemNotification(
              callType === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call',
              {
                body: `${senderProfile.display_name || senderProfile.username} is calling you...`,
                tag: `call_${callId}`,
                requireInteraction: true,
                data: {
                  type: 'incoming_call',
                  callId,
                  callType,
                  senderId: senderProfile.id,
                  url: `/call/${callId}`,
                },
                actions: [
                  { action: 'accept-call', title: 'Receive', icon: '/icon-192.png' },
                  { action: 'reject-call', title: 'Reject', icon: '/icon-192.png' },
                ],
              }
            );
          }
        }
      })
      .on('broadcast', { event: 'call-ended' }, (payload) => {
        const { callId } = payload?.payload || {};
        if (incomingCallRef.current && incomingCallRef.current.callId === callId) {
          const caller = incomingCallRef.current.caller;
          setIncomingCall(null);
          callSounds.stop();
          setMissedCallNotice({
            callerName: caller.display_name || caller.username,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          setTimeout(() => setMissedCallNotice(null), 5000);
        }
      })
      .on('broadcast', { event: 'call-rejected' }, (payload) => {
        const { callId } = payload?.payload || {};
        if (incomingCallRef.current && incomingCallRef.current.callId === callId) {
          setIncomingCall(null);
          callSounds.stop();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(myCallChannel);
    };
  }, [profile?.id]);

  // 2. Listen to Service Worker postMessages for Background Action clicks (Accept / Reject)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = async (event: MessageEvent) => {
      const { type, action, data } = event.data || {};

      if (type === 'CALL_REJECTED_BG') {
        if (incomingCallRef.current && incomingCallRef.current.callId === data?.callId) {
          setIncomingCall(null);
          callSounds.stop();
        }
      } else if (type === 'NOTIFICATION_CLICK' || type === 'CALL_ACTION') {
        if (action === 'accept-call' && data?.callId) {
          // Check call status before joining
          try {
            const res = await fetch(`/api/calls/status?callId=${data.callId}`);
            const statusData = await res.json();
            if (statusData.isActive && statusData.session) {
              const session = statusData.session;
              setActiveCall({
                isCaller: false,
                callType: session.call_type || data.callType || 'audio',
                remoteUser: session.caller_profile || {
                  id: session.caller_id || data.senderId,
                  username: data.senderName || 'Caller',
                  display_name: data.senderName || 'Caller',
                  avatar_url: data.senderAvatar,
                  created_at: new Date().toISOString(),
                },
                incomingOffer: session.offer || data.offer,
                callId: data.callId,
              });
              setIncomingCall(null);
            }
          } catch (e) {
            console.warn('Error verifying call on notification click:', e);
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [profile?.id]);

  // 3. Check URL parameters for direct call deep-links (e.g. /call/123 or ?callId=...&autoAccept=true)
  useEffect(() => {
    if (typeof window === 'undefined' || !profile?.id) return;

    const handleUrlCallParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const callId = urlParams.get('callId');
      const autoAccept = urlParams.get('autoAccept') === 'true';

      if (callId) {
        // Clean URL to prevent re-triggering on reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        try {
          const res = await fetch(`/api/calls/status?callId=${callId}`);
          const data = await res.json();

          if (data.isActive && data.session) {
            const session = data.session;
            const isCaller = session.caller_id === profile.id;
            const remoteUser = isCaller ? session.receiver_profile : session.caller_profile;

            if (remoteUser) {
              if (autoAccept || !isCaller) {
                setActiveCall({
                  isCaller: false,
                  callType: session.call_type || 'audio',
                  remoteUser,
                  incomingOffer: session.offer,
                  callId,
                });
              } else {
                setActiveCall({
                  isCaller: true,
                  callType: session.call_type || 'audio',
                  remoteUser,
                  callId,
                });
              }
            }
          } else {
            setMissedCallNotice({
              callerName: 'Call Session',
              time: 'Ended or Expired',
            });
            setTimeout(() => setMissedCallNotice(null), 4000);
          }
        } catch (err) {
          console.warn('Could not verify deep-link call:', err);
        }
      }
    };

    handleUrlCallParams();
  }, [profile?.id]);

  // Call Initiation Handler
  const startCall = async (remoteUser: Profile, callType: 'audio' | 'video') => {
    if (!profile) return;
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Create call session via API/DB
    try {
      await fetch('/api/calls/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: callId,
          callerId: profile.id,
          receiverId: remoteUser.id,
          callType,
        }),
      });
    } catch (e) {
      // Non-blocking
    }

    // 2. Dispatch background push notification to remote user in case app is closed/in background
    dispatchPushNotification({
      targetUserId: remoteUser.id,
      type: 'incoming_call',
      title: callType === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call',
      body: `${profile.display_name || profile.username} is calling you...`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `call_${callId}`,
      requireInteraction: true,
      renotify: true,
      vibrate: [300, 150, 300, 150, 300, 150, 600],
      data: {
        type: 'incoming_call',
        callId,
        callType,
        senderId: profile.id,
        senderName: profile.display_name || profile.username,
        senderAvatar: profile.avatar_url,
        receiverId: remoteUser.id,
        url: `/call/${callId}`,
      },
      actions: [
        { action: 'accept-call', title: 'Receive', icon: '/icon-192.png' },
        { action: 'reject-call', title: 'Reject', icon: '/icon-192.png' },
      ],
    });

    // 3. Set local active call state
    setActiveCall({
      isCaller: true,
      callType,
      remoteUser,
      callId,
    });
  };

  // Accept Incoming Call
  const acceptIncomingCall = () => {
    if (!incomingCall || !profile) return;
    callSounds.stop();

    setActiveCall({
      isCaller: false,
      callType: incomingCall.callType,
      remoteUser: incomingCall.caller,
      incomingOffer: incomingCall.offer,
      callId: incomingCall.callId,
    });

    setIncomingCall(null);
  };

  // Decline Incoming Call
  const declineIncomingCall = async () => {
    if (!incomingCall) return;
    const callId = incomingCall.callId;
    const caller = incomingCall.caller;

    callSounds.stop();
    callSounds.playEndCallTone();

    // 1. Broadcast rejection to caller
    if (isSupabaseConfigured) {
      const targetChannel = supabase.channel(`call_room_${caller.id}`);
      targetChannel.send({
        type: 'broadcast',
        event: 'call-rejected',
        payload: { callId },
      });
    }

    // 2. Inform backend API
    try {
      await fetch('/api/calls/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId,
          callerId: caller.id,
          receiverId: profile?.id,
          reason: 'declined_in_ui',
        }),
      });
    } catch (e) {
      // Non-blocking
    }

    setIncomingCall(null);
  };

  // End Active Call
  const endActiveCall = () => {
    setActiveCall(null);
    callSounds.stop();
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        startCall,
        acceptIncomingCall,
        declineIncomingCall,
        endActiveCall,
      }}
    >
      {children}

      {/* Global Missed Call Banner Toast */}
      {missedCallNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#18181b] border border-red-500/40 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3 text-sm text-white animate-bounce">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span>
            <strong>Missed Call:</strong> {missedCallNotice.callerName} ({missedCallNotice.time})
          </span>
        </div>
      )}

      {/* Global Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          isOpen={Boolean(incomingCall)}
          caller={incomingCall.caller}
          callType={incomingCall.callType}
          onAccept={acceptIncomingCall}
          onDecline={declineIncomingCall}
        />
      )}

      {/* Global Active Call WebRTC Modal */}
      {activeCall && profile && (
        <CallModal
          isOpen={Boolean(activeCall)}
          isCaller={activeCall.isCaller}
          callType={activeCall.callType}
          currentUser={profile}
          remoteUser={activeCall.remoteUser}
          incomingOffer={activeCall.incomingOffer}
          callId={activeCall.callId}
          onEndCall={endActiveCall}
        />
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
