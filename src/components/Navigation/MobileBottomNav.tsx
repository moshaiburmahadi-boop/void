import React from 'react';
import { ActiveTab } from '../../types';
import { Home, Mail, Plus, Bell, User } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenCompose: () => void;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenCompose,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
}) => {
  return (
    <nav
      id="mobile-bottom-navbar"
      className="fixed bottom-0 left-0 right-0 w-full z-50 lg:hidden border-t border-[#201f1f] bg-black/90 backdrop-blur-md flex justify-around items-center h-16 px-2 select-none"
    >
      {/* 1. [Feed] */}
      <button
        id="tab-mobile-feed"
        onClick={() => setActiveTab('feed')}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-transform active:scale-90 cursor-pointer"
        aria-label="Home Feed"
      >
        <Home
          className={`w-6 h-6 transition-colors ${
            activeTab === 'feed' ? 'text-white stroke-[2.5px]' : 'text-[#89919d]'
          }`}
        />
        <span className="sr-only">Feed</span>
      </button>

      {/* 2. [Messages] */}
      <button
        id="tab-mobile-messages"
        onClick={() => setActiveTab('messages')}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-transform active:scale-90 relative cursor-pointer"
        aria-label="Direct Messages"
      >
        <div className="relative">
          <Mail
            className={`w-6 h-6 transition-colors ${
              activeTab === 'messages' ? 'text-white stroke-[2.5px]' : 'text-[#89919d]'
            }`}
          />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#1d9bf0] rounded-full ring-2 ring-black" />
          )}
        </div>
        <span className="sr-only">Messages</span>
      </button>

      {/* 3. [+] Floating Action Button / Modal Opener */}
      <button
        id="btn-mobile-compose"
        onClick={onOpenCompose}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-transform active:scale-90 cursor-pointer group"
        aria-label="Create Post"
      >
        <div className="w-11 h-11 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#1d9bf0]/20 transition-all group-active:scale-95">
          <Plus className="w-6 h-6 stroke-[3px]" />
        </div>
        <span className="sr-only">Compose Post</span>
      </button>

      {/* 4. [Notifications] */}
      <button
        id="tab-mobile-notifications"
        onClick={() => setActiveTab('notifications')}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-transform active:scale-90 relative cursor-pointer"
        aria-label="Notifications"
      >
        <div className="relative">
          <Bell
            className={`w-6 h-6 transition-colors ${
              activeTab === 'notifications' ? 'text-white stroke-[2.5px]' : 'text-[#89919d]'
            }`}
          />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#1d9bf0] rounded-full ring-2 ring-black" />
          )}
        </div>
        <span className="sr-only">Notifications</span>
      </button>

      {/* 5. [Profile] */}
      <button
        id="tab-mobile-profile"
        onClick={() => setActiveTab('profile')}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-transform active:scale-90 cursor-pointer"
        aria-label="User Profile"
      >
        <User
          className={`w-6 h-6 transition-colors ${
            activeTab === 'profile' ? 'text-white stroke-[2.5px]' : 'text-[#89919d]'
          }`}
        />
        <span className="sr-only">Profile</span>
      </button>
    </nav>
  );
};
