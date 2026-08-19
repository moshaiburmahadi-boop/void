import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  User,
  Shield,
  Bell,
  Palette,
  LogOut,
  Check,
  Lock,
  Moon,
  Sparkles,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSQLHelper?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'privacy' | 'notifications' | 'display'>('account');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [directMessagesFromAnyone, setDirectMessagesFromAnyone] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSavePreferences = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-[#121212] border border-[#27272a] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#201f1f] flex items-center justify-between bg-[#18181b]">
          <h2 className="text-base font-bold text-[#e5e2e1]">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#89919d] hover:text-white rounded-full hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex border-b border-[#201f1f] bg-[#0d0d0d] px-2 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('account')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'account'
                ? 'border-[#1d9bf0] text-[#1d9bf0]'
                : 'border-transparent text-[#89919d] hover:text-[#e5e2e1]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Your Account
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-[#1d9bf0] text-[#1d9bf0]'
                : 'border-transparent text-[#89919d] hover:text-[#e5e2e1]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Privacy & Safety
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'notifications'
                ? 'border-[#1d9bf0] text-[#1d9bf0]'
                : 'border-transparent text-[#89919d] hover:text-[#e5e2e1]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('display')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'display'
                ? 'border-[#1d9bf0] text-[#1d9bf0]'
                : 'border-transparent text-[#89919d] hover:text-[#e5e2e1]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Display
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {savedToast && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Preferences saved successfully!</span>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-[#18181b] border border-[#27272a] rounded-2xl">
                <img
                  src={
                    profile?.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                  }
                  alt="Profile"
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#3f3f46]"
                />
                <div>
                  <h3 className="text-base font-bold text-[#e5e2e1]">
                    {profile?.display_name || profile?.username || 'User'}
                  </h3>
                  <p className="text-xs text-[#89919d]">@{profile?.username || 'user'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                    Active Member
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-[#89919d] uppercase tracking-wider">
                  Account Details
                </h4>
                <div className="flex justify-between items-center py-1 text-xs border-b border-[#27272a]/60">
                  <span className="text-[#89919d]">Username</span>
                  <span className="font-semibold text-[#e5e2e1]">@{profile?.username}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-xs border-b border-[#27272a]/60">
                  <span className="text-[#89919d]">Account Status</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Verified & Connected
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 text-xs">
                  <span className="text-[#89919d]">Member Since</span>
                  <span className="text-[#e5e2e1]">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Recent'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-4">
                <h4 className="text-xs font-bold text-[#89919d] uppercase tracking-wider">
                  Direct Messages
                </h4>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-[#e5e2e1]">Allow message requests</p>
                    <p className="text-xs text-[#89919d]">Let anyone on Void send you direct messages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={directMessagesFromAnyone}
                    onChange={(e) => {
                      setDirectMessagesFromAnyone(e.target.checked);
                      handleSavePreferences();
                    }}
                    className="w-4 h-4 accent-[#1d9bf0] cursor-pointer"
                  />
                </label>
              </div>

              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-4">
                <h4 className="text-xs font-bold text-[#89919d] uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#1d9bf0]" /> Audience & Tagging
                </h4>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#89919d]">Post Visibility</span>
                  <span className="text-[#e5e2e1] font-semibold">Public (All Void members)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#89919d]">Photo Tagging</span>
                  <span className="text-[#e5e2e1] font-semibold">Allowed</span>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-4">
                <h4 className="text-xs font-bold text-[#89919d] uppercase tracking-wider">
                  Notification Preferences
                </h4>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-[#e5e2e1]">Follow alerts</p>
                    <p className="text-xs text-[#89919d]">Get notified immediately when someone follows you</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => {
                      setNotificationsEnabled(e.target.checked);
                      handleSavePreferences();
                    }}
                    className="w-4 h-4 accent-[#1d9bf0] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-[#27272a]">
                  <div>
                    <p className="text-sm font-semibold text-[#e5e2e1]">Sound effects</p>
                    <p className="text-xs text-[#89919d]">Play subtle sound on new direct messages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEffects}
                    onChange={(e) => {
                      setSoundEffects(e.target.checked);
                      handleSavePreferences();
                    }}
                    className="w-4 h-4 accent-[#1d9bf0] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-[#89919d] uppercase tracking-wider flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-[#1d9bf0]" /> Theme
                </h4>
                <p className="text-xs text-[#89919d]">
                  Void is styled with high-contrast Midnight Dark theme.
                </p>
                <div className="p-3 bg-black border border-[#27272a] rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-[#e5e2e1]">Lights Out (OLED Black)</span>
                  <span className="text-[10px] bg-[#1d9bf0]/20 text-[#1d9bf0] px-2 py-0.5 rounded-full font-bold">
                    Active
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sign Out Section */}
          <div className="pt-4 border-t border-[#201f1f] flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-[#e5e2e1]">Sign Out</p>
              <p className="text-[11px] text-[#89919d]">End current session</p>
            </div>
            <button
              onClick={() => {
                signOut();
                onClose();
              }}
              className="px-4 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
