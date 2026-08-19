import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Post, Profile } from '../../types';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  CheckCircle2,
  Mail,
  UserPlus,
  UserCheck,
  Heart,
  MessageCircle,
  Repeat2,
  BarChart3,
  Bookmark,
  Loader2,
  X,
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
  const { isFollowing, toggleFollow, getFollowerCount, getFollowingCount } = useFollow();
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'replies' | 'media' | 'likes'>('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Fetch posts of this specific user
  useEffect(() => {
    if (!isOpen || !user?.id) {
      setUserPosts([]);
      return;
    }

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

        if (!error && data) {
          // Fetch likes by current user
          let userLikes = new Set<string>();
          if (currentUser?.id) {
            const { data: likesData } = await supabase
              .from('likes')
              .select('post_id')
              .eq('user_id', currentUser.id);
            if (likesData) {
              userLikes = new Set(likesData.map((l) => l.post_id));
            }
          }

          const formatted: Post[] = (data as unknown as any[]).map((p) => ({
            ...p,
            profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles || user,
            likes_count: userLikes.has(p.id) ? 1 : 0,
            user_has_liked: userLikes.has(p.id),
            replies_count: 0,
            reposts_count: 0,
            views_count: '0',
          }));
          setUserPosts(formatted);
        } else {
          setUserPosts([]);
        }
      } catch (err) {
        console.warn('Error fetching user posts:', err);
        setUserPosts([]);
      } finally {
        setIsLoadingPosts(false);
      }
    };

    fetchTargetUserPosts();
  }, [isOpen, user?.id, currentUser?.id]);

  if (!isOpen || !user) return null;

  const isSelf = currentUser?.id === user.id;
  const isFollowed = isFollowing(user.id);
  const followerCount = getFollowerCount(user.id, user.follower_count || 0);
  const followingCount = getFollowingCount(user.id, user.following_count || 0);

  const handleToggleLike = async (postId: string) => {
    if (!currentUser) return;
    setUserPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextLiked = !p.user_has_liked;
          return {
            ...p,
            user_has_liked: nextLiked,
            likes_count: (p.likes_count || 0) + (nextLiked ? 1 : -1),
          };
        }
        return p;
      })
    );

    if (isSupabaseConfigured) {
      try {
        const post = userPosts.find((p) => p.id === postId);
        const wasLiked = post?.user_has_liked;
        if (!wasLiked) {
          await supabase.from('likes').insert({
            post_id: postId,
            user_id: currentUser.id,
            created_at: new Date().toISOString(),
          });
        } else {
          await supabase
            .from('likes')
            .delete()
            .match({ post_id: postId, user_id: currentUser.id });
        }
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const handleToggleBookmark = (postId: string) => {
    setUserPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, user_has_bookmarked: !p.user_has_bookmarked } : p
      )
    );
  };

  const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return 'now';
    try {
      const now = new Date();
      const postDate = new Date(timestamp);
      const diffMs = now.getTime() - postDate.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'now';
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      return `${days}d`;
    } catch {
      return '2h';
    }
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
                  {userPosts.length} posts
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Banner Cover Photo */}
            <div className="h-36 sm:h-44 w-full bg-gradient-to-br from-[#121212] via-[#1c1c28] to-[#0a0a0f] relative overflow-hidden border-b border-[#201f1f]">
              <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>

            {/* Profile Avatar & Actions Header */}
            <div className="px-4 pb-4">
              <div className="flex justify-between items-end -mt-14 sm:-mt-16 mb-4">
                <div className="relative">
                  <img
                    src={
                      user.avatar_url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
                    }
                    alt={user.username}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-black bg-black shrink-0"
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

              {/* Meta details */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#89919d] mb-4">
                {user.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#89919d]" />
                    <span>{user.location}</span>
                  </div>
                )}
                {user.website && (
                  <div className="flex items-center gap-1">
                    <LinkIcon className="w-3.5 h-3.5 text-[#89919d]" />
                    <a
                      href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#1d9bf0] hover:underline truncate max-w-xs"
                    >
                      {user.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#89919d]" />
                  <span>
                    Joined {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'recently'}
                  </span>
                </div>
              </div>

              {/* Following & Follower stats */}
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

            {/* Posts / Content List */}
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
                  <article
                    key={post.id}
                    className="p-4 hover:bg-[#080808] transition-colors flex gap-3"
                  >
                    <img
                      src={
                        user.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                      }
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#27272a]"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 truncate">
                        <span className="font-bold text-sm text-[#e5e2e1] truncate">
                          {user.display_name || user.username}
                        </span>
                        {user.verified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                        )}
                        <span className="text-xs text-[#89919d] truncate">
                          @{user.username}
                        </span>
                        <span className="text-[#89919d]">·</span>
                        <span className="text-xs text-[#89919d]">
                          {formatRelativeTime(post.created_at)}
                        </span>
                      </div>

                      <p className="text-sm text-[#e5e2e1] leading-relaxed mb-3 break-words whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {post.image_url && (
                        <div className="rounded-2xl border border-[#201f1f] overflow-hidden mb-3 max-h-[300px] bg-[#0e0e0e]">
                          <img
                            src={post.image_url}
                            alt="Post media"
                            className="w-full h-full object-cover max-h-[300px]"
                          />
                        </div>
                      )}

                      {/* Interactive Post Actions */}
                      <div className="flex justify-between text-[#89919d] max-w-[400px] pt-1">
                        <button
                          className="flex items-center gap-1.5 hover:text-[#1d9bf0] transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-xs">{post.replies_count || 0}</span>
                        </button>
                        <button
                          className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors"
                        >
                          <Repeat2 className="w-4 h-4" />
                          <span className="text-xs">{post.reposts_count || 0}</span>
                        </button>
                        <button
                          onClick={() => handleToggleLike(post.id)}
                          className={`flex items-center gap-1.5 transition-colors ${
                            post.user_has_liked ? 'text-pink-500 font-bold' : 'hover:text-pink-500'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              post.user_has_liked ? 'fill-pink-500 text-pink-500' : ''
                            }`}
                          />
                          <span className="text-xs">{post.likes_count || 0}</span>
                        </button>
                        <button
                          className="flex items-center gap-1.5 hover:text-[#1d9bf0] transition-colors"
                        >
                          <BarChart3 className="w-4 h-4" />
                          <span className="text-xs">{post.views_count || 0}</span>
                        </button>
                        <button
                          onClick={() => handleToggleBookmark(post.id)}
                          className={`hover:text-[#1d9bf0] transition-colors ${
                            post.user_has_bookmarked ? 'text-[#1d9bf0]' : ''
                          }`}
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              post.user_has_bookmarked ? 'fill-[#1d9bf0]' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
