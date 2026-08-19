import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ActiveTab } from '../../types';
import {
  Home,
  Search,
  Bell,
  Mail,
  User as UserIcon,
  Settings,
  HelpCircle,
  Database,
  LogOut,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface DesktopSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenCompose: () => void;
  onOpenSQLHelper: () => void;
  onOpenSettings: () => void;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCompose,
  onOpenSQLHelper,
  onOpenSettings,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
}) => {
  const { profile, signOut, isDemoMode, isConfigured } = useAuth();

  return (
    <nav className="fixed left-0 top-0 h-screen w-[275px] hidden lg:flex flex-col border-r border-[#201f1f] bg-[#000000] py-5 px-4 z-40 select-none">
      {/* Brand Header */}
      <div className="mb-4 pl-3 flex items-center justify-between">
        <div
          onClick={() => setActiveTab('feed')}
          className="cursor-pointer flex items-center gap-2 group"
        >
          <span className="text-3xl font-black tracking-tight text-[#e5e2e1] group-hover:text-white transition-colors">
            Void
          </span>
          {isDemoMode && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#18181b] border border-[#27272a] text-[#89919d] font-mono">
              Demo
            </span>
          )}
          {isConfigured && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected to Supabase" />
          )}
        </div>
      </div>

      {/* Nav List */}
      <div className="flex flex-col gap-1.5 flex-grow">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-4 py-3 px-4 rounded-full transition-all text-left cursor-pointer active:scale-98 ${
            activeTab === 'feed'
              ? 'bg-[#18181b] text-white font-bold'
              : 'text-[#89919d] hover:bg-[#131313] hover:text-[#e5e2e1]'
          }`}
        >
          <Home className={`w-7 h-7 ${activeTab === 'feed' ? 'stroke-[2.5px] text-white' : ''}`} />
          <span className="text-lg">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('explore')}
          className={`flex items-center gap-4 py-3 px-4 rounded-full transition-all text-left cursor-pointer active:scale-98 ${
            activeTab === 'explore'
              ? 'bg-[#18181b] text-white font-bold'
              : 'text-[#89919d] hover:bg-[#131313] hover:text-[#e5e2e1]'
          }`}
        >
          <Search className={`w-7 h-7 ${activeTab === 'explore' ? 'stroke-[2.5px] text-white' : ''}`} />
          <span className="text-lg">Explore</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center justify-between py-3 px-4 rounded-full transition-all text-left cursor-pointer active:scale-98 ${
            activeTab === 'notifications'
              ? 'bg-[#18181b] text-white font-bold'
              : 'text-[#89919d] hover:bg-[#131313] hover:text-[#e5e2e1]'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell className={`w-7 h-7 ${activeTab === 'notifications' ? 'stroke-[2.5px] text-white' : ''}`} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#1d9bf0] rounded-full ring-2 ring-black" />
              )}
            </div>
            <span className="text-lg">Notifications</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`flex items-center justify-between py-3 px-4 rounded-full transition-all text-left cursor-pointer active:scale-98 ${
            activeTab === 'messages'
              ? 'bg-[#18181b] text-white font-bold'
              : 'text-[#89919d] hover:bg-[#131313] hover:text-[#e5e2e1]'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <Mail className={`w-7 h-7 ${activeTab === 'messages' ? 'stroke-[2.5px] text-white' : ''}`} />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#1d9bf0] rounded-full ring-2 ring-black" />
              )}
            </div>
            <span className="text-lg">Messages</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-4 py-3 px-4 rounded-full transition-all text-left cursor-pointer active:scale-98 ${
            activeTab === 'profile'
              ? 'bg-[#18181b] text-white font-bold'
              : 'text-[#89919d] hover:bg-[#131313] hover:text-[#e5e2e1]'
          }`}
        >
          <UserIcon className={`w-7 h-7 ${activeTab === 'profile' ? 'stroke-[2.5px] text-white' : ''}`} />
          <span className="text-lg">Profile</span>
        </button>

        {/* Big Post CTA Button */}
        <button
          id="btn-sidebar-post"
          onClick={onOpenCompose}
          className="mt-4 bg-[#e5e2e1] hover:bg-white text-[#000000] font-bold text-base rounded-full py-3.5 w-full transition-all shadow-lg active:scale-98 cursor-pointer flex items-center justify-center gap-2"
        >
          Post
        </button>
      </div>

      {/* Footer / Utilities */}
      <div className="mt-auto flex flex-col gap-1.5 pt-4 border-t border-[#201f1f]">
        <button
          onClick={onOpenSQLHelper}
          className="flex items-center gap-3 py-2 px-3 text-[#89919d] hover:text-[#1d9bf0] hover:bg-[#131313] rounded-full text-xs font-semibold transition-colors cursor-pointer"
        >
          <Database className="w-4 h-4 text-[#1d9bf0]" />
          <span>SQL Schema & RLS</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-3 py-2 px-3 text-[#89919d] hover:text-[#e5e2e1] hover:bg-[#131313] rounded-full text-xs font-medium transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        {/* User Card */}
        {profile && (
          <div className="flex items-center justify-between p-2 mt-2 rounded-full hover:bg-[#18181b] transition-colors group cursor-pointer">
            <div
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-3 min-w-0 flex-1"
            >
              <img
                src={profile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                alt={profile.display_name || profile.username}
                className="w-10 h-10 rounded-full object-cover border border-[#27272a] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-bold text-[#e5e2e1] truncate">
                    {profile.display_name || profile.username}
                  </p>
                  {profile.verified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
                  )}
                </div>
                <p className="text-xs text-[#89919d] truncate">@{profile.username}</p>
              </div>
            </div>

            <button
              onClick={signOut}
              title="Sign Out"
              className="p-2 text-[#89919d] hover:text-red-400 hover:bg-[#27272a] rounded-full transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
