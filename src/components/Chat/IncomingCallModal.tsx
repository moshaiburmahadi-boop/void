import React, { useEffect } from 'react';
import { Profile } from '../../types';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { callSounds } from '../../utils/callSounds';

interface IncomingCallModalProps {
  isOpen: boolean;
  caller: Profile;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  caller,
  callType,
  onAccept,
  onDecline,
}) => {
  useEffect(() => {
    if (isOpen) {
      callSounds.playIncomingRing();
    } else {
      callSounds.stop();
    }
    return () => {
      callSounds.stop();
    };
  }, [isOpen]);

  const handleAccept = () => {
    callSounds.stop();
    onAccept();
  };

  const handleDecline = () => {
    callSounds.stop();
    callSounds.playEndCallTone();
    onDecline();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-sm bg-[#121216] border border-[#27272a] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#1d9bf0]/20 rounded-full blur-3xl pointer-events-none" />

            {/* Caller Avatar with Pulsing Rings */}
            <div className="relative my-4 flex items-center justify-center">
              <span className="absolute w-28 h-28 rounded-full bg-[#1d9bf0]/25 animate-ping [animation-duration:2s]" />
              <span className="absolute w-32 h-32 rounded-full border-2 border-[#1d9bf0]/30 animate-pulse" />
              <img
                src={
                  caller.avatar_url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
                }
                alt={caller.username}
                className="w-24 h-24 rounded-full object-cover border-2 border-[#1d9bf0] relative z-10 shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 z-20 p-2 rounded-full bg-[#18181b] border border-[#27272a] shadow-md">
                {callType === 'video' ? (
                  <Video className="w-4 h-4 text-[#1d9bf0]" />
                ) : (
                  <Phone className="w-4 h-4 text-[#1d9bf0]" />
                )}
              </div>
            </div>

            {/* Call Info */}
            <div className="mb-8 z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1d9bf0]/15 text-[#1d9bf0] mb-2 border border-[#1d9bf0]/30">
                {callType === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call'}
              </span>
              <h3 className="text-xl font-bold text-white mb-0.5 truncate max-w-[260px]">
                {caller.display_name || caller.username}
              </h3>
              <p className="text-xs text-[#89919d]">@{caller.username}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 w-full z-10">
              {/* Decline Button */}
              <button
                onClick={handleDecline}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all transform active:scale-95 group-hover:shadow-red-600/40">
                  <PhoneOff className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-neutral-400 group-hover:text-red-400">
                  Decline
                </span>
              </button>

              {/* Accept Button */}
              <button
                onClick={handleAccept}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition-all transform active:scale-95 group-hover:shadow-emerald-600/40 animate-pulse">
                  {callType === 'video' ? (
                    <Video className="w-6 h-6" />
                  ) : (
                    <Phone className="w-6 h-6" />
                  )}
                </div>
                <span className="text-xs font-semibold text-neutral-400 group-hover:text-emerald-400">
                  Accept
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
