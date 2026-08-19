import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Post } from '../../types';
import { INITIAL_POSTS } from '../../data/mockData';
import {
  MessageCircle,
  Repeat2,
  Heart,
  BarChart3,
  Bookmark,
  CheckCircle2,
  Image as ImageIcon,
  Smile,
  Sparkles,
  Loader2,
  Trash2,
  RotateCw,
} from 'lucide-react';

interface HomeFeedProps {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  onOpenCompose: () => void;
}

export const HomeFeed: React.FC<HomeFeedProps> = ({ posts, setPosts, onOpenCompose }) => {
  const { profile } = useAuth();
  const { isFollowing } = useFollow();
  const [feedTab, setFeedTab] = useState<'for_you' | 'following'>('for_you');
  const [composeText, setComposeText] = useState('');
  const [composeImage, setComposeImage] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch posts from Supabase on mount
  const fetchPosts = async () => {
    if (!isSupabaseConfigured) return;
    setIsRefreshing(true);
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
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching posts from Supabase:', error);
      } else if (data) {
        // Also fetch user's likes
        let userLikes = new Set<string>();
        if (profile?.id) {
          const { data: likesData } = await supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', profile.id);
          if (likesData) {
            userLikes = new Set(likesData.map((l) => l.post_id));
          }
        }

        const formattedPosts: Post[] = (data as unknown as any[]).map((p) => ({
          ...p,
          profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
          likes_count: userLikes.has(p.id) ? 1 : 0,
          user_has_liked: userLikes.has(p.id),
          replies_count: 0,
          reposts_count: 0,
          views_count: '0',
        }));
        setPosts(formattedPosts);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [profile?.id]);

  // Realtime subscription: broadcast all posts to all users instantly
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('public_global_posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          const newPost = payload.new as any;
          let authorProfile = null;
          try {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newPost.user_id)
              .single();
            authorProfile = data;
          } catch (e) {
            console.warn(e);
          }

          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) {
              return prev;
            }
            return [
              {
                ...newPost,
                profiles: authorProfile || {
                  id: newPost.user_id,
                  username: 'member',
                  display_name: 'Member',
                  avatar_url:
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
                  created_at: newPost.created_at,
                },
                likes_count: 0,
                user_has_liked: false,
                replies_count: 0,
                reposts_count: 0,
                views_count: '0',
              },
              ...prev,
            ];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleInlineCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeText.trim() || !profile) return;

    setIsSubmitting(true);

    const newPostPayload = {
      user_id: profile.id,
      content: composeText.trim(),
      image_url: composeImage.trim() || null,
      created_at: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('posts')
          .insert(newPostPayload)
          .select('*, profiles:user_id(*)')
          .single();

        if (!error && data) {
          setPosts((prev) => [
            {
              ...data,
              likes_count: 0,
              user_has_liked: false,
              replies_count: 0,
              reposts_count: 0,
              views_count: '1',
            },
            ...prev,
          ]);
        } else {
          // Fallback optimistic
          const fallbackPost: Post = {
            id: `post-${Date.now()}`,
            ...newPostPayload,
            profiles: profile,
            likes_count: 0,
            user_has_liked: false,
            replies_count: 0,
            reposts_count: 0,
            views_count: '1',
          };
          setPosts((prev) => [fallbackPost, ...prev]);
        }
      } else {
        const fallbackPost: Post = {
          id: `post-${Date.now()}`,
          ...newPostPayload,
          profiles: profile,
          likes_count: 0,
          user_has_liked: false,
          replies_count: 0,
          reposts_count: 0,
          views_count: '1',
        };
        setPosts((prev) => [fallbackPost, ...prev]);
      }

      setComposeText('');
      setComposeImage('');
      setShowImageInput(false);
    } catch (err) {
      console.error('Error creating post:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!profile) return;

    const target = posts.find((p) => p.id === postId);
    if (!target) return;

    const currentlyLiked = Boolean(target.user_has_liked);
    const newLikedState = !currentlyLiked;
    const currentCount = Number(target.likes_count) || 0;
    const newCount = newLikedState ? currentCount + 1 : Math.max(0, currentCount - 1);

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              user_has_liked: newLikedState,
              likes_count: newCount,
            }
          : p
      )
    );

    // Supabase sync
    if (isSupabaseConfigured) {
      try {
        if (newLikedState) {
          await supabase.from('likes').insert({
            post_id: postId,
            user_id: profile.id,
          });

          // Also trigger notification for post author
          if (target.user_id !== profile.id) {
            await supabase.from('notifications').insert({
              user_id: target.user_id,
              actor_id: profile.id,
              type: 'like',
              post_id: postId,
            });
          }
        } else {
          await supabase
            .from('likes')
            .delete()
            .match({ post_id: postId, user_id: profile.id });
        }
      } catch (err) {
        console.warn('Like sync warning:', err);
      }
    }
  };

  const handleToggleRepost = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isReposted = !p.user_has_reposted;
          const count = Number(p.reposts_count) || 0;
          return {
            ...p,
            user_has_reposted: isReposted,
            reposts_count: isReposted ? count + 1 : Math.max(0, count - 1),
          };
        }
        return p;
      })
    );
  };

  const handleToggleBookmark = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, user_has_bookmarked: !p.user_has_bookmarked }
          : p
      )
    );
  };

  const handleDeletePost = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (isSupabaseConfigured) {
      try {
        await supabase.from('posts').delete().eq('id', postId);
      } catch (err) {
        console.warn('Error deleting post:', err);
      }
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diff / 60000);
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

  // Filter based on tab: 'for_you' shows all posts from all users, 'following' shows followed users + self
  const displayedPosts =
    feedTab === 'following'
      ? posts.filter((p) => p.user_id === profile?.id || isFollowing(p.user_id))
      : posts;

  return (
    <main className="w-full max-w-[600px] lg:ml-[275px] min-h-screen border-r border-[#201f1f] relative pb-20 lg:pb-8">
      {/* Mobile Top Header */}
      <header className="docked full-width top-0 sticky z-30 border-b border-[#201f1f] flex justify-between items-center w-full px-4 max-w-[600px] mx-auto bg-black/85 backdrop-blur-md h-14 md:hidden">
        <span className="text-xl font-black tracking-tight text-[#e5e2e1]">Void</span>
        <button
          onClick={fetchPosts}
          className="text-[#89919d] hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          title="Refresh Feed"
        >
          <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Sticky Header Tabs: For You / Following */}
      <div className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-[#201f1f] flex h-[53px]">
        <button
          id="tab-for-you"
          onClick={() => setFeedTab('for_you')}
          className="flex-1 flex justify-center items-center hover:bg-[#131313] transition-colors cursor-pointer relative"
        >
          <div className="h-full flex items-center justify-center text-sm font-bold text-[#e5e2e1] relative">
            For You
            {feedTab === 'for_you' && (
              <div className="absolute bottom-0 w-12 h-1 rounded-full bg-[#1d9bf0]" />
            )}
          </div>
        </button>
        <button
          id="tab-following"
          onClick={() => setFeedTab('following')}
          className="flex-1 flex justify-center items-center hover:bg-[#131313] transition-colors cursor-pointer relative"
        >
          <div className="h-full flex items-center justify-center text-sm font-semibold text-[#89919d] hover:text-[#e5e2e1] relative">
            Following
            {feedTab === 'following' && (
              <div className="absolute bottom-0 w-16 h-1 rounded-full bg-[#1d9bf0]" />
            )}
          </div>
        </button>
      </div>

      {/* Desktop Post Compose Box */}
      <div className="hidden md:flex p-4 border-b border-[#201f1f] gap-3">
        <img
          src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
          alt={profile?.username || 'avatar'}
          className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#27272a]"
        />
        <form onSubmit={handleInlineCompose} className="flex-1">
          <textarea
            rows={2}
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder="What is happening?!"
            className="w-full bg-transparent border-none text-[#e5e2e1] placeholder-[#89919d] text-lg outline-none resize-none focus:ring-0 px-0"
          />

          {composeImage && (
            <div className="relative mt-2 rounded-2xl overflow-hidden border border-[#27272a] max-h-56">
              <img src={composeImage} alt="preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setComposeImage('')}
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {showImageInput && !composeImage && (
            <div className="mt-2 p-2 bg-[#18181b] rounded-xl border border-[#27272a]">
              <input
                type="url"
                placeholder="Image URL..."
                value={composeImage}
                onChange={(e) => setComposeImage(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-[#e5e2e1] outline-none"
              />
            </div>
          )}

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#201f1f]">
            <div className="flex gap-1 text-[#1d9bf0]">
              <button
                type="button"
                onClick={() => setShowImageInput((prev) => !prev)}
                className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors"
                title="Add Image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setComposeText((prev) => prev + ' 🚀')}
                className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors"
                title="Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setComposeText((prev) => prev + ' #Glassmorphism')}
                className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors"
                title="Trend Tag"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!composeText.trim() || isSubmitting}
              className={`font-bold text-xs rounded-full py-1.5 px-4 transition-all ${
                composeText.trim()
                  ? 'bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white cursor-pointer shadow-md'
                  : 'bg-[#1d9bf0]/50 text-white/60 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Feed Posts List */}
      <div className="divide-y divide-[#201f1f]">
        {displayedPosts.length === 0 ? (
          <div className="p-12 text-center text-[#89919d]">
            <p className="text-base font-semibold text-[#e5e2e1] mb-1">No posts yet</p>
            <p className="text-xs mb-4">Be the first to share an update on Void!</p>
            <button
              onClick={onOpenCompose}
              className="px-5 py-2 bg-[#1d9bf0] text-white text-xs font-bold rounded-full hover:bg-[#1a8cd8]"
            >
              Create Post
            </button>
          </div>
        ) : (
          displayedPosts.map((post) => {
            const author = post.profiles || {
              username: 'user',
              display_name: 'Void Member',
              avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
              verified: false,
            };
            const isAuthor = profile && (post.user_id === profile.id || author.username === profile.username);

            return (
              <article
                key={post.id}
                className="p-4 hover:bg-[#080808] transition-colors cursor-pointer flex gap-3 group"
              >
                {/* Author Avatar */}
                <img
                  src={author.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                  alt={author.display_name || author.username}
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#27272a]"
                />

                <div className="flex-1 min-w-0">
                  {/* Author Header */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="font-bold text-sm text-[#e5e2e1] truncate group-hover:underline">
                        {author.display_name || author.username}
                      </span>
                      {author.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                      )}
                      <span className="text-xs text-[#89919d] truncate">
                        @{author.username}
                      </span>
                      <span className="text-[#89919d]">·</span>
                      <span className="text-xs text-[#89919d] hover:underline">
                        {formatRelativeTime(post.created_at)}
                      </span>
                    </div>

                    {isAuthor && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePost(post.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[#89919d] hover:text-red-400 p-1 rounded-full hover:bg-[#18181b] transition-all"
                        title="Delete Post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Post Content */}
                  <p className="text-sm text-[#e5e2e1] leading-relaxed mb-3 break-words whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {/* Media Attachment */}
                  {post.image_url && (
                    <div className="rounded-2xl border border-[#201f1f] overflow-hidden mb-3 max-h-[340px] bg-[#0e0e0e]">
                      <img
                        src={post.image_url}
                        alt="Post media"
                        className="w-full h-full object-cover max-h-[340px]"
                      />
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex justify-between text-[#89919d] max-w-[425px] pt-1">
                    {/* Replies */}
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 hover:text-[#1d9bf0] group/btn transition-colors"
                    >
                      <div className="p-2 rounded-full group-hover/btn:bg-[#1d9bf0]/10 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium">
                        {post.replies_count || 0}
                      </span>
                    </button>

                    {/* Reposts */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleRepost(post.id);
                      }}
                      className={`flex items-center gap-1.5 group/repost transition-colors ${
                        post.user_has_reposted ? 'text-emerald-500' : 'hover:text-emerald-500'
                      }`}
                    >
                      <div className="p-2 rounded-full group-hover/repost:bg-emerald-500/10 transition-colors">
                        <Repeat2 className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium">
                        {post.reposts_count || 0}
                      </span>
                    </button>

                    {/* Likes */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLike(post.id);
                      }}
                      className={`flex items-center gap-1.5 group/like transition-colors ${
                        post.user_has_liked ? 'text-pink-500 font-bold' : 'hover:text-pink-500'
                      }`}
                    >
                      <div className="p-2 rounded-full group-hover/like:bg-pink-500/10 transition-colors">
                        <Heart
                          className={`w-4 h-4 ${
                            post.user_has_liked ? 'fill-pink-500 text-pink-500 scale-110' : ''
                          } transition-transform`}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {post.likes_count || 0}
                      </span>
                    </button>

                    {/* Views */}
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 hover:text-[#1d9bf0] group/view transition-colors"
                    >
                      <div className="p-2 rounded-full group-hover/view:bg-[#1d9bf0]/10 transition-colors">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium">
                        {post.views_count || 0}
                      </span>
                    </button>

                    {/* Bookmark */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBookmark(post.id);
                      }}
                      className={`p-2 rounded-full hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0] transition-colors ${
                        post.user_has_bookmarked ? 'text-[#1d9bf0]' : ''
                      }`}
                    >
                      <Bookmark
                        className={`w-4 h-4 ${post.user_has_bookmarked ? 'fill-[#1d9bf0]' : ''}`}
                      />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
};
