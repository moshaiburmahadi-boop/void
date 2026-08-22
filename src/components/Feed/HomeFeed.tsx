import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Post, Profile } from '../../types';
import { INITIAL_POSTS } from '../../data/mockData';
import { MobileSearchModal } from '../Search/MobileSearchModal';
import { PostItem } from './PostItem';
import {
  Image as ImageIcon,
  Smile,
  Sparkles,
  RotateCw,
  Search,
  Users,
} from 'lucide-react';

interface HomeFeedProps {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  onOpenCompose: () => void;
  onViewProfile?: (user: Profile) => void;
}

export const HomeFeed: React.FC<HomeFeedProps> = ({
  posts,
  setPosts,
  onOpenCompose,
  onViewProfile,
}) => {
  const { profile } = useAuth();
  const { isFollowing } = useFollow();
  const [feedTab, setFeedTab] = useState<'for_you' | 'following'>('for_you');
  const [composeText, setComposeText] = useState('');
  const [composeImage, setComposeImage] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

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
          views_count: 1,
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
          const newPost = payload.new as Post;
          // Fetch author details for the newly inserted post
          const { data: authorData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newPost.user_id)
            .single();

          const postWithAuthor: Post = {
            ...newPost,
            profiles: authorData || undefined,
            likes_count: 0,
            user_has_liked: false,
            replies_count: 0,
            reposts_count: 0,
            views_count: 1,
          };

          setPosts((prev) => {
            if (prev.some((p) => p.id === postWithAuthor.id)) return prev;
            return [postWithAuthor, ...prev];
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
          const deletedId = (payload.old as { id: string })?.id;
          if (deletedId) {
            setPosts((prev) => prev.filter((p) => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleInlineCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeText.trim() || isSubmitting) return;

    setIsSubmitting(true);

    const newPostItem: Post = {
      id: `local-${Date.now()}`,
      user_id: profile?.id || 'demo-user',
      content: composeText.trim(),
      image_url: composeImage.trim() || undefined,
      created_at: new Date().toISOString(),
      profiles: profile || undefined,
      likes_count: 0,
      user_has_liked: false,
      replies_count: 0,
      reposts_count: 0,
      views_count: 1,
      user_has_bookmarked: false,
    };

    if (isSupabaseConfigured && profile?.id) {
      try {
        const { data, error } = await supabase
          .from('posts')
          .insert({
            user_id: profile.id,
            content: composeText.trim(),
            image_url: composeImage.trim() || null,
          })
          .select(`
            id,
            user_id,
            content,
            image_url,
            created_at,
            profiles:user_id (*)
          `)
          .single();

        if (error) {
          console.error('Supabase post insert failed, using local:', error);
          setPosts((prev) => [newPostItem, ...prev]);
        } else if (data) {
          const insertedPost: Post = {
            ...data,
            profiles: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles,
            likes_count: 0,
            user_has_liked: false,
            replies_count: 0,
            reposts_count: 0,
            views_count: 1,
          };
          setPosts((prev) => {
            const filtered = prev.filter((p) => p.id !== insertedPost.id);
            return [insertedPost, ...filtered];
          });
        }
      } catch (err) {
        console.error('Post creation error:', err);
        setPosts((prev) => [newPostItem, ...prev]);
      }
    } else {
      setPosts((prev) => [newPostItem, ...prev]);
    }

    setComposeText('');
    setComposeImage('');
    setShowImageInput(false);
    setIsSubmitting(false);
  };

  const handleDeletePost = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (isSupabaseConfigured) {
      try {
        await supabase.from('posts').delete().eq('id', postId);
      } catch (err) {
        console.error('Delete post error:', err);
      }
    }
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
  };

  // Filter posts based on active tab
  const displayedPosts = posts.filter((post) => {
    if (feedTab === 'for_you') return true;
    if (feedTab === 'following') {
      return post.user_id ? isFollowing(post.user_id) : false;
    }
    return true;
  });

  return (
    <main className="w-full max-w-[600px] shrink-0 min-h-screen border-r border-[#201f1f] relative pb-20 lg:pb-8 select-none">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-[#201f1f] flex md:hidden items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <img
            src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
            alt={profile?.username || 'avatar'}
            onClick={() => {
              if (onViewProfile && profile) {
                onViewProfile(profile);
              }
            }}
            className="w-8 h-8 rounded-full object-cover border border-[#27272a] cursor-pointer"
          />
          <div className="flex items-center gap-2">
            <img
              src="/favicon.png"
              alt="Void Logo"
              className="w-6 h-6 object-contain rounded-lg"
            />
            <h1 className="text-base font-extrabold tracking-tight text-[#e5e2e1]">Home</h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMobileSearchOpen(true)}
            className="text-[#89919d] hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors md:hidden cursor-pointer"
            title="Search Void"
            aria-label="Search Void"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={fetchPosts}
            className="text-[#89919d] hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Refresh Feed"
            aria-label="Refresh Feed"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full text-xs cursor-pointer"
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
                className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors cursor-pointer"
                title="Add Image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setComposeText((prev) => prev + ' 🚀')}
                className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors cursor-pointer"
                title="Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setComposeText((prev) => prev + ' #Glassmorphism')}
                className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors cursor-pointer"
                title="Hashtag"
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

      {/* Feed Posts List (Using shared PostItem component) */}
      <div className="divide-y divide-[#201f1f]">
        {displayedPosts.length === 0 ? (
          feedTab === 'following' ? (
            <div className="py-16 px-6 text-center text-[#89919d] flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#16181c] border border-[#2f3336] flex items-center justify-center mb-3 text-[#1d9bf0]">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-[#e5e2e1] mb-1">No posts yet</p>
              <p className="text-xs text-[#71767b] max-w-xs">
                No posts yet. Follow people to see their posts here!
              </p>
            </div>
          ) : (
            <div className="p-12 text-center text-[#89919d]">
              <p className="text-base font-semibold text-[#e5e2e1] mb-1">No posts yet</p>
              <p className="text-xs mb-4">Be the first to share an update on Void!</p>
              <button
                onClick={onOpenCompose}
                className="px-5 py-2 bg-[#1d9bf0] text-white text-xs font-bold rounded-full hover:bg-[#1a8cd8] cursor-pointer"
              >
                Create Post
              </button>
            </div>
          )
        ) : (
          displayedPosts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              onDeletePost={handleDeletePost}
              onViewProfile={onViewProfile}
              onPostUpdated={handlePostUpdated}
            />
          ))
        )}
      </div>

      {/* Mobile Search Modal */}
      <MobileSearchModal
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
        onViewProfile={onViewProfile}
      />
    </main>
  );
};
