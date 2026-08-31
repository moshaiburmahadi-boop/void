import React, { useState, useEffect } from 'react';
import { Post, Profile, Comment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatRelativeTime } from '../../utils/date';
import {
  Heart,
  Repeat2,
  MessageCircle,
  Bookmark,
  BarChart3,
  CheckCircle2,
  Trash2,
  Send,
  Loader2,
} from 'lucide-react';

interface PostItemProps {
  post: Post;
  onDeletePost?: (postId: string) => void;
  onViewProfile?: (profile: Profile) => void;
  onPostUpdated?: (updatedPost: Post) => void;
}

const PostItemComponent: React.FC<PostItemProps> = ({
  post,
  onDeletePost,
  onViewProfile,
  onPostUpdated,
}) => {
  const { profile } = useAuth();

  // Initialize local interactive states from post data without redundant network queries on mount
  const [likesCount, setLikesCount] = useState<number>(post.likes_count ?? 0);
  const [hasLiked, setHasLiked] = useState<boolean>(Boolean(post.user_has_liked));
  const [repliesCount, setRepliesCount] = useState<number>(post.replies_count ?? 0);
  const [repostsCount, setRepostsCount] = useState<number>(post.reposts_count ?? 0);
  const [hasReposted, setHasReposted] = useState<boolean>(Boolean(post.user_has_reposted));
  const [hasBookmarked, setHasBookmarked] = useState<boolean>(Boolean(post.user_has_bookmarked));
  const [viewsCount] = useState<number>(post.views_count ?? 1);

  // Comments interactive drawer state
  const [showComments, setShowComments] = useState<boolean>(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);

  const author = post.profiles || {
    id: post.user_id,
    username: 'user',
    display_name: 'Void Member',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    verified: false,
    created_at: post.created_at,
  };

  const isAuthor = profile && (post.user_id === profile.id || author.username === profile.username);

  // Sync state if post prop changes
  useEffect(() => {
    if (typeof post.likes_count === 'number') setLikesCount(post.likes_count);
    if (typeof post.user_has_liked === 'boolean') setHasLiked(post.user_has_liked);
    if (typeof post.replies_count === 'number') setRepliesCount(post.replies_count);
    if (typeof post.reposts_count === 'number') setRepostsCount(post.reposts_count);
    if (typeof post.user_has_reposted === 'boolean') setHasReposted(post.user_has_reposted);
    if (typeof post.user_has_bookmarked === 'boolean') setHasBookmarked(post.user_has_bookmarked);
  }, [post.likes_count, post.user_has_liked, post.replies_count, post.reposts_count, post.user_has_reposted, post.user_has_bookmarked]);

  // Load comments when drawer is opened
  useEffect(() => {
    if (!showComments || !isSupabaseConfigured || !post.id) return;

    let isMounted = true;
    setIsLoadingComments(true);

    const loadComments = async () => {
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*, profiles:user_id(id, username, display_name, avatar_url, verified)')
          .eq('post_id', post.id)
          .order('created_at', { ascending: true });

        if (isMounted && !error && data) {
          setComments(data as Comment[]);
          setRepliesCount(data.length);
        }
      } catch (e) {
        console.warn('Failed to load comments:', e);
      } finally {
        if (isMounted) setIsLoadingComments(false);
      }
    };

    loadComments();

    return () => {
      isMounted = false;
    };
  }, [showComments, post.id]);

  // Handle Like Toggle
  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;

    const nextHasLiked = !hasLiked;
    const nextCount = Math.max(0, likesCount + (nextHasLiked ? 1 : -1));

    // Optimistic update
    setHasLiked(nextHasLiked);
    setLikesCount(nextCount);

    if (onPostUpdated) {
      onPostUpdated({
        ...post,
        likes_count: nextCount,
        user_has_liked: nextHasLiked,
      });
    }

    if (!isSupabaseConfigured) return;

    try {
      if (nextHasLiked) {
        await supabase.from('likes').insert({
          post_id: post.id,
          user_id: profile.id,
        });

        // Add notification for author if not self
        if (post.user_id !== profile.id) {
          try {
            await supabase.from('notifications').insert({
              user_id: post.user_id,
              actor_id: profile.id,
              type: 'like',
              post_id: post.id,
              created_at: new Date().toISOString(),
            });
          } catch (e) {
            console.warn(e);
          }
        }
      } else {
        await supabase
          .from('likes')
          .delete()
          .match({ post_id: post.id, user_id: profile.id });
      }
    } catch (err) {
      console.warn('Like toggle sync error:', err);
    }
  };

  // Handle Repost Toggle
  const handleToggleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextReposted = !hasReposted;
    const nextCount = Math.max(0, repostsCount + (nextReposted ? 1 : -1));
    setHasReposted(nextReposted);
    setRepostsCount(nextCount);

    if (onPostUpdated) {
      onPostUpdated({
        ...post,
        reposts_count: nextCount,
        user_has_reposted: nextReposted,
      });
    }
  };

  // Handle Bookmark Toggle
  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextBookmarked = !hasBookmarked;
    setHasBookmarked(nextBookmarked);

    if (onPostUpdated) {
      onPostUpdated({
        ...post,
        user_has_bookmarked: nextBookmarked,
      });
    }
  };

  // Submit a new Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !profile || isSubmittingComment) return;

    const commentText = newCommentText.trim();
    setIsSubmittingComment(true);

    const tempComment: Comment = {
      id: `temp-${Date.now()}`,
      post_id: post.id,
      user_id: profile.id,
      content: commentText,
      created_at: new Date().toISOString(),
      profiles: profile,
    };

    // Optimistic update
    setComments((prev) => [...prev, tempComment]);
    setNewCommentText('');
    setRepliesCount((prev) => prev + 1);

    if (!isSupabaseConfigured) {
      setIsSubmittingComment(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          user_id: profile.id,
          content: commentText,
          created_at: new Date().toISOString(),
        })
        .select('*, profiles:user_id(id, username, display_name, avatar_url, verified)')
        .single();

      if (!error && data) {
        setComments((prev) => prev.map((c) => (c.id === tempComment.id ? (data as Comment) : c)));
      }

      // Add notification for author
      if (post.user_id !== profile.id) {
        try {
          await supabase.from('notifications').insert({
            user_id: post.user_id,
            actor_id: profile.id,
            type: 'reply',
            post_id: post.id,
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn(e);
        }
      }
    } catch (err) {
      console.warn('Comment post error:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <article
      id={`post-${post.id}`}
      className="p-4 hover:bg-[#080808] transition-colors flex gap-3 group border-b border-[#201f1f] last:border-b-0"
    >
      {/* Author Avatar */}
      <img
        src={author.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
        alt={author.display_name || author.username}
        loading="lazy"
        decoding="async"
        onClick={(e) => {
          e.stopPropagation();
          if (onViewProfile && post.profiles) {
            onViewProfile(post.profiles);
          }
        }}
        className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#27272a] hover:opacity-80 transition-opacity cursor-pointer"
      />

      <div className="flex-1 min-w-0">
        {/* Author Header & Timestamp */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onViewProfile && post.profiles) {
                onViewProfile(post.profiles);
              }
            }}
            className="flex items-center gap-1.5 min-w-0 truncate cursor-pointer group/author"
          >
            <span className="font-bold text-sm text-[#e5e2e1] truncate group-hover/author:underline">
              {author.display_name || author.username}
            </span>
            {author.verified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
            )}
            <span className="text-xs text-[#89919d] truncate">@{author.username}</span>
            <span className="text-[#89919d]">·</span>
            <span className="text-xs text-[#89919d] hover:underline" title={post.created_at}>
              {formatRelativeTime(post.created_at)}
            </span>
          </div>

          {/* Delete button (Author only) */}
          {isAuthor && onDeletePost && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeletePost(post.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-[#89919d] hover:text-red-400 p-1.5 rounded-full hover:bg-[#18181b] transition-all cursor-pointer"
              title="Delete Post"
              aria-label="Delete Post"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Post Text Content */}
        <p className="text-sm text-[#e5e2e1] leading-relaxed mb-3 break-words whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Attached Media */}
        {post.image_url && (
          <div className="rounded-2xl border border-[#201f1f] overflow-hidden mb-3 max-h-[340px] bg-[#0e0e0e]">
            <img
              src={post.image_url}
              alt="Post media"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover max-h-[340px]"
            />
          </div>
        )}

        {/* Action Bar with Real Dynamic Counts */}
        <div className="flex justify-between text-[#89919d] max-w-[425px] pt-1">
          {/* Comments / Replies */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComments((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 group/btn transition-colors cursor-pointer ${
              showComments ? 'text-[#1d9bf0]' : 'hover:text-[#1d9bf0]'
            }`}
            title="Comments"
          >
            <div className="p-2 rounded-full group-hover/btn:bg-[#1d9bf0]/10 transition-colors">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium">{repliesCount}</span>
          </button>

          {/* Reposts */}
          <button
            onClick={handleToggleRepost}
            className={`flex items-center gap-1.5 group/repost transition-colors cursor-pointer ${
              hasReposted ? 'text-emerald-500 font-bold' : 'hover:text-emerald-500'
            }`}
            title="Repost"
          >
            <div className="p-2 rounded-full group-hover/repost:bg-emerald-500/10 transition-colors">
              <Repeat2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium">{repostsCount}</span>
          </button>

          {/* Likes (Dynamic Supabase Sync) */}
          <button
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 group/like transition-colors cursor-pointer ${
              hasLiked ? 'text-pink-500 font-bold' : 'hover:text-pink-500'
            }`}
            title="Like"
          >
            <div className="p-2 rounded-full group-hover/like:bg-pink-500/10 transition-colors">
              <Heart
                className={`w-4 h-4 ${
                  hasLiked ? 'fill-pink-500 text-pink-500 scale-110' : ''
                } transition-transform`}
              />
            </div>
            <span className="text-xs font-medium">{likesCount}</span>
          </button>

          {/* Views */}
          <div
            className="flex items-center gap-1.5 hover:text-[#1d9bf0] group/view transition-colors"
            title="Views"
          >
            <div className="p-2 rounded-full group-hover/view:bg-[#1d9bf0]/10 transition-colors">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium">{viewsCount}</span>
          </div>

          {/* Bookmark */}
          <button
            onClick={handleToggleBookmark}
            className={`p-2 rounded-full hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0] transition-colors cursor-pointer ${
              hasBookmarked ? 'text-[#1d9bf0]' : ''
            }`}
            title="Bookmark"
          >
            <Bookmark className={`w-4 h-4 ${hasBookmarked ? 'fill-[#1d9bf0]' : ''}`} />
          </button>
        </div>

        {/* Expandable Real Comments Section */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-[#201f1f] space-y-3">
            {/* New Comment Input */}
            {profile && (
              <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <img
                  src={profile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                  alt={profile.username}
                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#27272a]"
                />
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Post your reply..."
                  className="flex-1 bg-[#16181c] border border-[#2f3336] rounded-full px-3 py-1.5 text-xs text-[#e5e2e1] placeholder-[#71767b] outline-none focus:border-[#1d9bf0]"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim() || isSubmittingComment}
                  className="p-1.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-40 text-white rounded-full transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* Comments List */}
            {isLoadingComments ? (
              <div className="py-3 flex items-center justify-center gap-2 text-xs text-[#71767b]">
                <Loader2 className="w-4 h-4 animate-spin text-[#1d9bf0]" />
                <span>Loading comments...</span>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-[#71767b] py-2 text-center">
                No comments yet. Start the conversation!
              </p>
            ) : (
              <div className="space-y-2 pt-1 max-h-56 overflow-y-auto pr-1">
                {comments.map((comment) => {
                  const commentAuthor = comment.profiles || {
                    username: 'user',
                    display_name: 'Member',
                    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
                    verified: false,
                  };
                  return (
                    <div key={comment.id} className="flex gap-2 text-xs bg-[#111] p-2.5 rounded-xl border border-[#201f1f]">
                      <img
                        src={commentAuthor.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                        alt={commentAuthor.username}
                        onClick={() => {
                          if (onViewProfile && comment.profiles) {
                            onViewProfile(comment.profiles);
                          }
                        }}
                        className="w-6 h-6 rounded-full object-cover shrink-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="font-semibold text-[#e5e2e1] truncate">
                            {commentAuthor.display_name || commentAuthor.username}
                          </span>
                          {commentAuthor.verified && (
                            <CheckCircle2 className="w-3 h-3 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                          )}
                          <span className="text-[#71767b]">@{commentAuthor.username}</span>
                          <span className="text-[#71767b]">·</span>
                          <span className="text-[#71767b]">{formatRelativeTime(comment.created_at)}</span>
                        </div>
                        <p className="text-[#d1d5db] break-words">{comment.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export const PostItem = React.memo(PostItemComponent);
