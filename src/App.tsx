import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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

  // Unread badge indicators
  const [unreadMessages, setUnreadMessages] = useState(1);
  const [unreadNotifications, setUnreadNotifications] = useState(2);

  // Clear badges when visiting respective tabs
  useEffect(() => {
    if (activeTab === 'messages') setUnreadMessages(0);
    if (activeTab === 'notifications') setUnreadNotifications(0);
  }, [activeTab]);

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
          onOpenSQLHelper={() => setIsSQLModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          unreadMessagesCount={unreadMessages}
          unreadNotificationsCount={unreadNotifications}
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
              onOpenSQLHelper={() => setIsSQLModalOpen(true)}
            />
          )}

          {/* Right Sidebar (Hidden on messages tab or small screens) */}
          {activeTab !== 'messages' && (
            <RightSidebar onSearch={handleSearchFromRightBar} />
          )}
        </div>

        {/* Mobile Bottom Fixed Navigation Bar: [Feed] [Messages] [+] [Notifications] [Profile] */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenCompose={() => setIsComposeOpen(true)}
          unreadMessagesCount={unreadMessages}
          unreadNotificationsCount={unreadNotifications}
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

        {/* Settings & Credentials Modal */}
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
      <MainApp />
    </AuthProvider>
  );
}
