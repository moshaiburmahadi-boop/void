import React from 'react';
import { usePWA } from '../../context/PWAContext';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { isOnline, swUpdateAvailable, reloadToUpdate } = usePWA();

  return (
    <>
      {/* 1. Offline Indicator */}
      {!isOnline && (
        <div
          id="offline-indicator-banner"
          className="fixed top-0 left-0 right-0 z-50 bg-[#1c1917] border-b border-amber-500/40 text-amber-300 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top-2"
        >
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>You are currently offline. Viewing cached Void content.</span>
        </div>
      )}

      {/* 2. Service Worker Update Notification Toast */}
      {swUpdateAvailable && (
        <div
          id="pwa-update-toast"
          className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-[#18181b] border border-[#1d9bf0]/50 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3.5 max-w-sm animate-in slide-in-from-bottom-5"
        >
          <div className="w-9 h-9 rounded-xl bg-[#1d9bf0]/15 text-[#1d9bf0] flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white leading-tight">Update Available</p>
            <p className="text-[11px] text-[#89919d] mt-0.5">A new version of Void is ready.</p>
          </div>
          <button
            type="button"
            onClick={reloadToUpdate}
            className="px-3 py-1.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] active:scale-95 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0"
          >
            Update
          </button>
        </div>
      )}
    </>
  );
};
