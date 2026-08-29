import React, { useState } from 'react';
import { usePWA } from '../../context/PWAContext';
import { Download, X, Sparkles } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed, not installable, or dismissed, don't show
  if (!isInstallable || isInstalled || isDismissed) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await installApp();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div
      id="pwa-install-banner"
      className="hidden md:flex items-center justify-between gap-3 p-3.5 mx-3 mb-3 bg-gradient-to-r from-[#111424] via-[#181825] to-[#12121e] border border-[#1d9bf0]/30 rounded-2xl shadow-xl transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-black border border-[#27272a] p-1 flex items-center justify-center shrink-0">
          <img
            src="/icon-192.png"
            alt="Void App"
            className="w-full h-full object-contain rounded-lg"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white tracking-wide">Install Void App</span>
            <Sparkles className="w-3 h-3 text-[#38bdf8]" />
          </div>
          <p className="text-[11px] text-[#89919d] truncate">
            Fast, standalone & offline ready
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleInstall}
          disabled={isInstalling}
          className="px-3 py-1.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] active:scale-95 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-md shadow-[#1d9bf0]/20 transition-all cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isInstalling ? 'Installing...' : 'Install'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 text-[#89919d] hover:text-white hover:bg-[#27272a] rounded-full transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
