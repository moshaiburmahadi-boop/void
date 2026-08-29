import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FollowProvider } from './context/FollowContext';
import { PWAProvider } from './context/PWAContext';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { ActiveTab, Post, Profile } from './types';
import { INITIAL_POSTS } from './data/mockData';
import { DesktopSidebar } from './components/Navigation/DesktopSidebar';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav';
import { RightSidebar } from './components/Navigation/RightSidebar';
import { HomeFeed } from './components/Feed/HomeFeed';
import { ExploreView } from './components/Explore/ExploreView';
import { NotificationsView } from './components/Notifications/NotificationsView';
import { MessagesView } from './components/Chat/MessagesView';
import { ProfileView } from './components/Profile/ProfileView';
import { PublicProfileModal } from './components/Profile/PublicProfileModal';
import { PostComposeModal } from './components/Feed/PostComposeModal';
import { SQLModal } from './components/SQLModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/Auth/AuthModal';
import { OfflineBanner } from './components/PWA/OfflineBanner';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, profile, loading, isDemoMode } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSQLModalOpen, setIsSQLModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Public profile modal state
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<Profile | null>(null);
  const [directMessageUser, setDirectMessageUser] = useState<Profile | null>(null);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Unread badge indicators (red dot & counts)
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Clear badges when visiting respective tabs
  useEffect(() => {
    if (activeTab === 'messages') {
      setHasUnreadMessages(false);
      setUnreadMessages(0);
    }
    if (activeTab === 'notifications') {
      setHasUnreadNotifications(false);
      setUnreadNotifications(0);
    }
  }, [activeTab]);

  // Realtime subscription for incoming direct messages and notifications
  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured) return;

    // 1. Listen for new direct messages targeting current user
    const messagesChannel = supabase
      .channel(`unread_msgs_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${profile.id}`,
        },
        (payload) => {
          if (activeTab !== 'messages') {
            setHasUnreadMessages(true);
            setUnreadMessages((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    // 2. Listen for new notifications targeting current user
    const notifsChannel = supabase
      .channel(`unread_notifs_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          if (activeTab !== 'notifications') {
            setHasUnreadNotifications(true);
            setUnreadNotifications((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(notifsChannel);
    };
  }, [profile?.id, activeTab]);

  // Open public profile modal or switch to self profile
  const handleViewProfile = (targetUser: Profile) => {
    if (profile && targetUser.id === profile.id) {
      setActiveTab('profile');
    } else {
      setSelectedPublicProfile(targetUser);
    }
  };

  // Start message from public profile
  const handleStartMessage = (targetUser: Profile) => {
    setDirectMessageUser(targetUser);
    setSelectedPublicProfile(null);
    setActiveTab('messages');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#e5e2e1]">
        <div className="w-12 h-12 rounded-full border-2 border-[#1d9bf0] border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wider text-[#89919d]">Loading Void...</p>
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return <AuthModal />;
  }

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts]);
  };

  const handleSearchFromRightBar = (query: string) => {
    setSearchQuery(query);
    setActiveTab('explore');
  };

  return (
    <div className="min-h-screen bg-black text-[#e5e2e1] flex justify-center font-sans antialiased selection:bg-[#1d9bf0]/30 selection:text-white">
      <div className="w-full max-w-[1265px] flex relative min-h-screen">
        {/* Left Desktop Sidebar */}
        <DesktopSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCompose={() => setIsComposeOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          unreadMessagesCount={unreadMessages}
          unreadNotificationsCount={unreadNotifications}
          hasUnreadMessages={hasUnreadMessages}
          hasUnreadNotifications={hasUnreadNotifications}
        />

        {/* Center Main Content (Responsive Feed / Messages / Explore / Notifications / Profile) */}
        <div className="flex-1 flex justify-start min-h-screen w-full">
          {activeTab === 'feed' && (
            <HomeFeed
              posts={posts}
              setPosts={setPosts}
              onOpenCompose={() => setIsComposeOpen(true)}
              onViewProfile={handleViewProfile}
            />
          )}

          {activeTab === 'explore' && (
            <ExploreView
              initialSearchQuery={searchQuery}
              onViewProfile={handleViewProfile}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView onViewProfile={handleViewProfile} />
          )}

          {activeTab === 'messages' && (
            <MessagesView
              initialPartner={directMessageUser}
              onUnreadChange={setUnreadMessages}
              onViewProfile={handleViewProfile}
              onMobileChatToggle={setIsMobileChatOpen}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              posts={posts}
              onBackToFeed={() => setActiveTab('feed')}
              onOpenSQLHelper={() => setIsSQLModalOpen(true)}
              onDeletePost={(postId) => setPosts((prev) => prev.filter((p) => p.id !== postId))}
              onViewProfile={handleViewProfile}
            />
          )}

          {/* Right Sidebar (Hidden on messages tab or small screens) */}
          {activeTab !== 'messages' && (
            <RightSidebar
              onSearch={handleSearchFromRightBar}
              onViewProfile={handleViewProfile}
            />
          )}
        </div>

        {/* Mobile Bottom Fixed Navigation Bar */}
        {!(activeTab === 'messages' && isMobileChatOpen) && (
          <MobileBottomNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenCompose={() => setIsComposeOpen(true)}
            unreadMessagesCount={unreadMessages}
            unreadNotificationsCount={unreadNotifications}
            hasUnreadMessages={hasUnreadMessages}
            hasUnreadNotifications={hasUnreadNotifications}
          />
        )}

        {/* Public Profile View Modal */}
        <PublicProfileModal
          user={selectedPublicProfile}
          isOpen={Boolean(selectedPublicProfile)}
          onClose={() => setSelectedPublicProfile(null)}
          onStartMessage={handleStartMessage}
        />

        {/* Compose Post Modal */}
        <PostComposeModal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          onPostCreated={handlePostCreated}
        />

        {/* SQL Schema & Migration Helper Modal */}
        <SQLModal
          isOpen={isSQLModalOpen}
          onClose={() => setIsSQLModalOpen(false)}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          onOpenSQLHelper={() => setIsSQLModalOpen(true)}
        />

        {/* Offline & Update Status Banner */}
        <OfflineBanner />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <PWAProvider>
      <AuthProvider>
        <FollowProvider>
          <MainApp />
        </FollowProvider>
      </AuthProvider>
    </PWAProvider>
  );
}
