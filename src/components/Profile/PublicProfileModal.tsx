import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Post, Profile } from '../../types';
import { PostItem } from '../Feed/PostItem';
import {
  formatBirthday,
  formatGender,
  canViewField,
  formatWebsiteDisplay,
  sanitizeWebsiteUrl,
} from '../../utils/profile';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  CheckCircle2,
  Mail,
  UserPlus,
  UserCheck,
  Loader2,
  X,
  Cake,
  User as UserIcon,
  Briefcase,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PublicProfileModalProps {
  user: Profile | null;
  isOpen: boolean;
  onClose: () => void;
  onStartMessage?: (targetUser: Profile) => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onStartMessage,
}) => {
  const { profile: currentUser } = useAuth();
  const { isFollowing, toggleFollow, getFollowerCount, getFollowingCount, fetchUserFollowStats } = useFollow();
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'replies' | 'media' | 'likes'>('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt?: string } | null>(null);

  // Sync follow counts from Supabase follows table for this user
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchUserFollowStats(user.id);
    }
  }, [isOpen, user?.id, fetchUserFollowStats]);

  // Fetch posts of this specific user
  useEffect(() => {
    if (!isOpen || !user?.id) {
      setUserPosts([]);
      return;
    }

    let isMounted = true;

    const fetchTargetUserPosts = async () => {
      if (!isSupabaseConfigured) return;
      setIsLoadingPosts(true);
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id,
            user_id,
            content,
            image_url,
            created_at,
            profiles:user_id (*)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (isMounted && !error && data) {
          const formatted: Post[] = (data as unknown as any[]).map((p) => ({
            ...p,
            profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles || user,
            likes_count: 0,
            user_has_liked: false,
            replies_count: 0,
            reposts_count: 0,
            views_count: 1,
          }));
          setUserPosts(formatted);
        } else if (isMounted) {
          setUserPosts([]);
        }
      } catch (err) {
        console.warn('Error fetching user posts:', err);
        if (isMounted) setUserPosts([]);
      } finally {
        if (isMounted) setIsLoadingPosts(false);
      }
    };

    fetchTargetUserPosts();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id]);

  if (!isOpen || !user) return null;

  const isSelf = currentUser?.id === user.id;
  const isFollowed = isFollowing(user.id);
  const followerCount = getFollowerCount(user.id);
  const followingCount = getFollowingCount(user.id);

  const handleDeletePost = (postId: string) => {
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handlePostUpdated = (updated: Post) => {
    setUserPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="bg-black border border-[#201f1f] w-full max-w-[600px] min-h-screen sm:min-h-0 sm:max-h-[90vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
        >
          {/* Top Sticky Header */}
          <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-[#201f1f] flex items-center justify-between px-4 h-14 shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b] transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-bold text-[#e5e2e1] leading-tight truncate">
                    {user.display_name || user.username}
                  </h1>
                  {user.verified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#89919d] leading-none">
                  {userPosts.length} {userPosts.length === 1 ? 'post' : 'posts'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Banner Cover Photo */}
            <div className="h-36 sm:h-44 w-full bg-gradient-to-br from-[#121212] via-[#1c1c28] to-[#0a0a0f] relative overflow-hidden border-b border-[#201f1f]">
              {user.cover_url ? (
                <img
                  src={user.cover_url}
                  alt="Cover photo"
                  onClick={() => setLightboxImage({ url: user.cover_url!, alt: `${user.display_name || user.username}'s cover` })}
                  className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                />
              ) : (
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
              )}
            </div>

            {/* Profile Avatar & Actions Header */}
            <div className="px-4 pb-4">
              <div className="flex justify-between items-end -mt-14 sm:-mt-16 mb-4">
                <div className="relative">
                  <img
                    src={
                      user.avatar_url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
                    }
                    alt={user.username}
                    onClick={() =>
                      setLightboxImage({
                        url:
                          user.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
                        alt: `${user.display_name || user.username}'s avatar`,
                      })
                    }
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-black bg-black shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                    title="Click to preview avatar"
                  />
                </div>

                {/* Profile Actions: Follow & Message */}
                <div className="flex items-center gap-2">
                  {!isSelf && (
                    <>
                      {onStartMessage && (
                        <button
                          onClick={() => {
                            onStartMessage(user);
                            onClose();
                          }}
                          className="p-2.5 border border-[#3f3f46] hover:border-white text-[#e5e2e1] hover:text-white rounded-full transition-all active:scale-95 cursor-pointer bg-[#121212] hover:bg-[#18181b]"
                          title={`Message @${user.username}`}
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleFollow(user)}
                        className={`px-5 py-2 rounded-full font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 group ${
                          isFollowed
                            ? 'bg-transparent border border-[#536471] text-[#e7e9ea] hover:border-red-500 hover:text-red-500 hover:bg-red-950/20'
                            : 'bg-[#eff3f4] text-black hover:bg-white'
                        }`}
                      >
                        {isFollowed ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 group-hover:hidden text-[#1d9bf0]" />
                            <span className="group-hover:hidden">Following</span>
                            <span className="hidden group-hover:inline">Unfollow</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                  {isSelf && (
                    <span className="px-4 py-1.5 border border-[#3f3f46] text-[#89919d] text-xs font-bold rounded-full">
                      Your Profile
                    </span>
                  )}
                </div>
              </div>

              {/* User Names */}
              <div className="mb-3">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#e5e2e1]">
                    {user.display_name || user.username}
                  </h2>
                  {user.verified && (
                    <CheckCircle2 className="w-4 h-4 text-[#1d9bf0] fill-[#1d9bf0]" />
                  )}
                </div>
                <p className="text-sm text-[#89919d]">@{user.username}</p>
              </div>

              {/* Bio */}
              {user.bio ? (
                <p className="text-sm text-[#e5e2e1] leading-relaxed mb-4 whitespace-pre-wrap">
                  {user.bio}
                </p>
              ) : (
                <p className="text-sm text-[#71767b] italic mb-4">No bio provided yet.</p>
              )}

              {/* Meta details (occupation, education, birthday, gender, location, website, joined) */}
              <div className="flex flex-col gap-2.5 text-xs sm:text-sm text-[#89919d] mb-4">
                {/* 1. Occupation / Work */}
                {user.occupation && (
                  <div className="flex items-start gap-2.5 text-[#e5e2e1]">
                    <Briefcase className="w-4 h-4 text-[#1d9bf0] shrink-0 mt-0.5" />
                    <span className="break-words leading-relaxed">{user.occupation}</span>
                  </div>
                )}

                {/* 2. Education */}
                {user.education && (
                  <div className="flex items-start gap-2.5 text-[#e5e2e1]">
                    <GraduationCap className="w-4 h-4 text-[#1d9bf0] shrink-0 mt-0.5" />
                    <span className="break-words leading-relaxed">{user.education}</span>
                  </div>
                )}

                {/* 3. Privacy-aware Birthday */}
                {user.date_of_birth &&
                  canViewField(user.birthday_visibility, isSelf, isFollowed) &&
                  user.birthday_display !== 'hidden' && (
                    <div className="flex items-start gap-2.5">
                      <Cake className="w-4 h-4 text-[#89919d] shrink-0 mt-0.5" />
                      <span className="break-words leading-relaxed">
                        {formatBirthday(user.date_of_birth, user.birthday_display || 'month_day')}
                      </span>
                    </div>
                  )}

                {/* 4. Privacy-aware Gender */}
                {user.gender &&
                  user.gender !== 'prefer_not_to_say' &&
                  canViewField(user.gender_visibility, isSelf, isFollowed) && (
                    <div className="flex items-start gap-2.5">
                      <UserIcon className="w-4 h-4 text-[#89919d] shrink-0 mt-0.5" />
                      <span className="break-words leading-relaxed">
                        {formatGender(user.gender, user.gender_custom)}
                      </span>
                    </div>
                  )}

                {/* 5. Location */}
                {user.location && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#89919d] shrink-0 mt-0.5" />
                    <span className="break-words leading-relaxed">{user.location}</span>
                  </div>
                )}

                {/* 6. Website */}
                {user.website && (
                  <div className="flex items-start gap-2.5">
                    <LinkIcon className="w-4 h-4 text-[#89919d] shrink-0 mt-0.5" />
                    <a
                      href={sanitizeWebsiteUrl(user.website)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1d9bf0] hover:underline break-all leading-relaxed"
                    >
                      {formatWebsiteDisplay(user.website)}
                    </a>
                  </div>
                )}

                {/* 7. Joined Date */}
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-[#89919d] shrink-0 mt-0.5" />
                  <span className="break-words leading-relaxed">
                    Joined {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently'}
                  </span>
                </div>
              </div>

              {/* Interests Tags Cloud */}
              {user.interests && user.interests.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {user.interests.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 bg-[#18181c] text-[#1d9bf0] border border-[#27272a] rounded-full text-xs font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Following & Follower stats (Strict dynamic follows query) */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 text-[#89919d]">
                  <span className="font-bold text-[#e5e2e1]">{followingCount}</span>
                  <span>Following</span>
                </div>
                <div className="flex items-center gap-1 text-[#89919d]">
                  <span className="font-bold text-[#e5e2e1]">{followerCount}</span>
                  <span>Followers</span>
                </div>
              </div>
            </div>

            {/* Profile Sub-Tabs */}
            <div className="flex border-b border-[#201f1f] sticky top-0 bg-black z-20">
              {(['posts', 'replies', 'media', 'likes'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSubTab(tab)}
                  className={`flex-1 py-3 text-xs font-bold transition-all relative capitalize cursor-pointer ${
                    activeSubTab === tab ? 'text-[#e5e2e1]' : 'text-[#89919d] hover:text-[#e5e2e1]'
                  }`}
                >
                  {tab}
                  {activeSubTab === tab && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-[#1d9bf0]" />
                  )}
                </button>
              ))}
            </div>

            {/* Posts / Content List (Using shared PostItem) */}
            <div className="divide-y divide-[#201f1f]">
              {isLoadingPosts ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#71767b]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#1d9bf0]" />
                  <span>Loading posts...</span>
                </div>
              ) : activeSubTab !== 'posts' ? (
                <div className="py-16 text-center text-xs text-[#71767b]">
                  <p className="font-semibold text-[#e5e2e1] mb-1 capitalize">No {activeSubTab} yet</p>
                  <p>When @{user.username} shares {activeSubTab}, they will appear here.</p>
                </div>
              ) : userPosts.length === 0 ? (
                <div className="py-16 text-center text-xs text-[#71767b]">
                  <p className="font-semibold text-[#e5e2e1] mb-1">No posts from @{user.username} yet</p>
                  <p>Follow @{user.username} to get notified when they post updates.</p>
                </div>
              ) : (
                userPosts.map((post) => (
                  <PostItem
                    key={post.id}
                    post={post}
                    onDeletePost={handleDeletePost}
                    onPostUpdated={handlePostUpdated}
                  />
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* Fullscreen Image Lightbox Preview */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setLightboxImage(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2.5 bg-black/60 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer z-10"
              aria-label="Close image preview"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.alt || 'Full preview'}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
            />
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
