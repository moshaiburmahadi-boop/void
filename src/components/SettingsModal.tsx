import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabaseUrl, updateSupabaseCredentials, isSupabaseConfigured } from '../lib/supabase';
import { X, KeyRound, Database, Shield, Check, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSQLHelper: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenSQLHelper,
}) => {
  const { isDemoMode, signOut, enterDemoMode } = useAuth();
  const [urlInput, setUrlInput] = useState(
    supabaseUrl === 'https://demo-placeholder.supabase.co' ? '' : supabaseUrl
  );
  const [keyInput, setKeyInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput || !keyInput) return;
    updateSupabaseCredentials(urlInput, keyInput);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121212] border border-[#27272a] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#201f1f] flex items-center justify-between bg-[#18181b]">
          <h2 className="text-base font-bold text-[#e5e2e1]">Application Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#89919d] hover:text-white rounded-full hover:bg-[#27272a]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Supabase Connection Status */}
          <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#89919d]">Supabase Backend Status</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSupabaseConfigured
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {isSupabaseConfigured ? 'Connected' : 'Demo / Standby'}
              </span>
            </div>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              {isSupabaseConfigured
                ? 'Your app is directly communicating with Supabase PostgreSQL and Realtime WebSockets.'
                : 'Running in instant sandbox mode. You can connect your live Supabase project below anytime.'}
            </p>
          </div>

          {/* Quick SQL Migration Button */}
          <div className="flex items-center justify-between p-4 bg-[#18181b] border border-[#27272a] rounded-2xl">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-[#1d9bf0]" />
              <div>
                <p className="text-sm font-bold text-[#e5e2e1]">SQL Migration Script</p>
                <p className="text-xs text-[#89919d]">View 5 tables & RLS security rules</p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenSQLHelper();
              }}
              className="px-3 py-1.5 bg-[#1d9bf0] text-white text-xs font-bold rounded-full hover:bg-[#1a8cd8]"
            >
              Open SQL
            </button>
          </div>

          {/* Connect Keys Form */}
          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <h3 className="text-xs font-bold text-[#89919d] uppercase tracking-wider">
              Supabase Project Keys
            </h3>

            {savedSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Credentials saved! Reloading connection...</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Project URL (VITE_SUPABASE_URL)
              </label>
              <input
                type="url"
                required
                placeholder="https://xyzproject.supabase.co"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] text-[#e5e2e1] placeholder-[#52525b] rounded-xl px-3 py-2 text-xs focus:border-[#1d9bf0] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Anon Public Key (VITE_SUPABASE_ANON_KEY)
              </label>
              <input
                type="password"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] text-[#e5e2e1] placeholder-[#52525b] rounded-xl px-3 py-2 text-xs focus:border-[#1d9bf0] outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#e5e2e1] text-black font-bold text-xs rounded-full hover:bg-white transition-all cursor-pointer"
            >
              Update Credentials
            </button>
          </form>

          {/* Session / Account Reset */}
          <div className="pt-4 border-t border-[#201f1f] flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-[#e5e2e1]">Sign Out</p>
              <p className="text-[11px] text-[#89919d]">End the current session</p>
            </div>
            <button
              onClick={() => {
                signOut();
                onClose();
              }}
              className="px-4 py-1.5 bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60 rounded-full text-xs font-bold transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
