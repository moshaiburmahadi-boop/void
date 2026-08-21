import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { Post, Profile } from '../../types';
import { PostItem } from '../Feed/PostItem';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  CheckCircle2,
  Edit2,
  LogOut,
  X,
  Code2,
} from 'lucide-react';

interface ProfileViewProps {
  posts: Post[];
  onBackToFeed: () => void;
  onOpenSQLHelper?: () => void;
  onDeletePost?: (postId: string) => void;
  onViewProfile?: (profile: Profile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  posts,
  onBackToFeed,
  onOpenSQLHelper,
  onDeletePost,
  onViewProfile,
}) => {
  const { profile, signOut, updateProfile } = useAuth();
  const { fetchUserFollowStats, getFollowerCount, getFollowingCount } = useFollow();
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'replies' | 'highlights' | 'media' | 'likes'>('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  // Dynamic follow counts directly from Supabase follows table
  useEffect(() => {
    if (profile?.id) {
      fetchUserFollowStats(profile.id);
    }
  }, [profile?.id, fetchUserFollowStats]);

  const userPosts = posts.filter(
    (p) => p.user_id === profile?.id || p.profiles?.username === profile?.username
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      display_name: displayName,
      bio,
      location,
      website,
      avatar_url: avatarUrl,
    });
    setIsEditing(false);
  };

  const followersNum = profile?.id ? getFollowerCount(profile.id) : 0;
  const followingNum = profile?.id ? getFollowingCount(profile.id) : 0;

  return (
    <main className="w-full max-w-[600px] shrink-0 min-h-screen border-r border-[#201f1f] relative pb-20 lg:pb-8 select-none">
      {/* Top sticky bar */}
      <header className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-[#201f1f] flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToFeed}
            className="p-2 -ml-2 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b] transition-colors cursor-pointer"
            aria-label="Back to Feed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-[#e5e2e1] leading-tight">
                {profile?.display_name || profile?.username}
              </h1>
              {profile?.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
              )}
            </div>
            <p className="text-xs text-[#89919d] leading-none">
              {userPosts.length} {userPosts.length === 1 ? 'post' : 'posts'}
            </p>
          </div>
        </div>

        {onOpenSQLHelper && (
          <button
            onClick={onOpenSQLHelper}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16181c] hover:bg-[#202227] border border-[#2f3336] text-[#89919d] hover:text-[#1d9bf0] text-xs font-semibold rounded-full transition-colors"
            title="Database Setup SQL"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Database SQL</span>
          </button>
        )}
      </header>

      {/* Banner */}
      <div className="h-44 sm:h-52 w-full bg-gradient-to-br from-[#121212] via-[#1a1a24] to-[#0a0a0f] relative overflow-hidden border-b border-[#201f1f]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
      </div>

      {/* Profile Info Header */}
      <div className="px-4 pb-4">
        {/* Avatar & Action Button Row */}
        <div className="flex justify-between items-end -mt-16 sm:-mt-20 mb-4">
          <div className="relative">
            <img
              src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
              alt="Profile avatar"
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-black bg-black"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDisplayName(profile?.display_name || '');
                setBio(profile?.bio || '');
                setLocation(profile?.location || '');
                setWebsite(profile?.website || '');
                setAvatarUrl(profile?.avatar_url || '');
                setIsEditing(true);
              }}
              className="px-4 py-2 border border-[#3f3f46] hover:border-white text-[#e5e2e1] hover:text-white rounded-full font-bold text-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
            <button
              onClick={signOut}
              title="Logout"
              className="p-2 border border-[#3f3f46] hover:border-red-500 text-[#89919d] hover:text-red-400 rounded-full transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Name and Handle */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#e5e2e1]">
              {profile?.display_name || profile?.username}
            </h2>
            {profile?.verified && (
              <CheckCircle2 className="w-5 h-5 text-[#1d9bf0] fill-[#1d9bf0]" />
            )}
          </div>
          <p className="text-sm text-[#89919d]">@{profile?.username}</p>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="text-sm text-[#e5e2e1] leading-relaxed mb-4 whitespace-pre-wrap">
            {profile.bio}
          </p>
        )}

        {/* Meta details (location, website, joined) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#89919d] mb-4">
          {profile?.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-[#89919d]" />
              <span>{profile.location}</span>
            </div>
          )}

          {profile?.website && (
            <div className="flex items-center gap-1">
              <LinkIcon className="w-4 h-4 text-[#89919d]" />
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#1d9bf0] hover:underline"
              >
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-[#89919d]" />
            <span>
              {profile?.created_at
                ? `Joined ${new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}`
                : 'Joined recently'}
            </span>
          </div>
        </div>

        {/* Following / Followers count (Dynamic from Supabase follows table) */}
        <div className="flex gap-5 text-sm">
          <div className="cursor-pointer hover:underline flex items-center gap-1">
            <span className="font-bold text-[#e5e2e1]">{followingNum}</span>
            <span className="text-[#89919d]">Following</span>
          </div>
          <div className="cursor-pointer hover:underline flex items-center gap-1">
            <span className="font-bold text-[#e5e2e1]">{followersNum}</span>
            <span className="text-[#89919d]">Followers</span>
          </div>
        </div>
      </div>

      {/* Profile Sub Tabs */}
      <div className="flex border-b border-[#201f1f] text-sm font-semibold text-[#89919d] overflow-x-auto scrollbar-none">
        {(['posts', 'replies', 'highlights', 'media', 'likes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveSubTab(t)}
            className={`flex-1 min-w-[70px] py-3.5 text-center capitalize transition-colors relative hover:bg-[#121212] cursor-pointer ${
              activeSubTab === t ? 'text-[#e5e2e1] font-bold' : 'hover:text-[#e5e2e1]'
            }`}
          >
            {t}
            {activeSubTab === t && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-[#1d9bf0]" />
            )}
          </button>
        ))}
      </div>

      {/* User's Posts list (Using Shared PostItem component with Dynamic Reactions & Timestamps) */}
      <div className="divide-y divide-[#201f1f]">
        {userPosts.length === 0 ? (
          <div className="p-12 text-center text-[#89919d]">
            <p className="text-sm font-semibold text-[#e5e2e1] mb-1">No posts found</p>
            <p className="text-xs">Posts you publish will appear here on your profile feed.</p>
          </div>
        ) : (
          userPosts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              onDeletePost={onDeletePost}
              onViewProfile={onViewProfile}
            />
          ))
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#121212] border border-[#27272a] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#201f1f] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 hover:bg-[#201f1f] rounded-full text-[#89919d] hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="font-bold text-base text-[#e5e2e1]">Edit profile</h3>
              </div>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-1.5 bg-[#e5e2e1] text-black hover:bg-white font-bold text-xs rounded-full transition-all cursor-pointer"
              >
                Save
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#89919d] mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#89919d] mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the world about yourself..."
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#89919d] mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#89919d] mb-1">Website</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#89919d] mb-1">Avatar Image URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0]"
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
