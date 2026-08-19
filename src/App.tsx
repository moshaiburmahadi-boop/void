import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FollowProvider } from './context/FollowContext';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { ActiveTab, Post } from './types';
import { INITIAL_POSTS } from './data/mockData';
import { DesktopSidebar } from './components/Navigation/DesktopSidebar';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav';
import { RightSidebar } from './components/Navigation/RightSidebar';
import { HomeFeed } from './components/Feed/HomeFeed';
import { ExploreView } from './components/Explore/ExploreView';
import { NotificationsView } from './components/Notifications/NotificationsView';
import { MessagesView } from './components/Chat/MessagesView';
import { ProfileView } from './components/Profile/ProfileView';
import { PostComposeModal } from './components/Feed/PostComposeModal';
import { SQLModal } from './components/SQLModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/Auth/AuthModal';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, profile, loading, isDemoMode } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSQLModalOpen, setIsSQLModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        () => {
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
        () => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#e5e2e1] gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Void</h1>
        <Loader2 className="w-6 h-6 animate-spin text-[#1d9bf0]" />
      </div>
    );
  }

  // If user is not authenticated and not in demo mode, show AuthModal
  if (!user && !isDemoMode) {
    return (
      <>
        <AuthModal onOpenSQLHelper={() => setIsSQLModalOpen(true)} />
        <SQLModal isOpen={isSQLModalOpen} onClose={() => setIsSQLModalOpen(false)} />
      </>
    );
  }

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    setActiveTab('feed');
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
            />
          )}

          {activeTab === 'explore' && (
            <ExploreView initialSearchQuery={searchQuery} />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView />
          )}

          {activeTab === 'messages' && (
            <MessagesView onUnreadChange={setUnreadMessages} />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              posts={posts}
              onBackToFeed={() => setActiveTab('feed')}
            />
          )}

          {/* Right Sidebar (Hidden on messages tab or small screens) */}
          {activeTab !== 'messages' && (
            <RightSidebar onSearch={handleSearchFromRightBar} />
          )}
        </div>

        {/* Mobile Bottom Fixed Navigation Bar */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCompose={() => setIsComposeOpen(true)}
          unreadMessagesCount={unreadMessages}
          unreadNotificationsCount={unreadNotifications}
          hasUnreadMessages={hasUnreadMessages}
          hasUnreadNotifications={hasUnreadNotifications}
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
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <FollowProvider>
        <MainApp />
      </FollowProvider>
    </AuthProvider>
  );
}
