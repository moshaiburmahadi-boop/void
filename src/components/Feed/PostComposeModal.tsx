import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Post } from '../../types';
import { X, Image, Smile, Loader2, Sparkles } from 'lucide-react';

interface PostComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (newPost: Post) => void;
}

export const PostComposeModal: React.FC<PostComposeModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !profile) return;

    setLoading(true);
    setError(null);

    const postPayload = {
      user_id: profile.id,
      content: content.trim(),
      image_url: imageUrl.trim() || null,
      created_at: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured) {
        const { data, error: insertError } = await supabase
          .from('posts')
          .insert(postPayload)
          .select('*, profiles:user_id(*)')
          .single();

        if (insertError) {
          console.warn('Supabase post insert failed, falling back:', insertError);
          // Fallback creation
          const localPost: Post = {
            id: `post-${Date.now()}`,
            user_id: profile.id,
            content: content.trim(),
            image_url: imageUrl.trim() || null,
            created_at: new Date().toISOString(),
            profiles: profile,
            likes_count: 0,
            user_has_liked: false,
            replies_count: 0,
            reposts_count: 0,
            views_count: '1',
          };
          onPostCreated(localPost);
        } else if (data) {
          onPostCreated({
            ...data,
            likes_count: 0,
            user_has_liked: false,
            replies_count: 0,
            reposts_count: 0,
            views_count: '1',
          });
        }
      } else {
        // Local mode
        const localPost: Post = {
          id: `post-${Date.now()}`,
          user_id: profile.id,
          content: content.trim(),
          image_url: imageUrl.trim() || null,
          created_at: new Date().toISOString(),
          profiles: profile,
          likes_count: 0,
          user_has_liked: false,
          replies_count: 0,
          reposts_count: 0,
          views_count: '1',
        };
        onPostCreated(localPost);
      }

      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to publish post.');
    } finally {
      setLoading(false);
    }
  };

  const sampleImages = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 pt-12 sm:pt-4">
      <div className="bg-[#121212] border border-[#27272a] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#201f1f] flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 text-[#89919d] hover:text-[#e5e2e1] hover:bg-[#201f1f] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-[#89919d]">New Void Post</span>
          <div className="w-9" />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="flex gap-3">
            <img
              src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
              alt={profile?.username || 'avatar'}
              className="w-11 h-11 rounded-full object-cover shrink-0 border border-[#27272a]"
            />
            <div className="flex-1">
              <textarea
                autoFocus
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What is happening?!"
                className="w-full bg-transparent border-none text-[#e5e2e1] placeholder-[#89919d] text-lg outline-none resize-none focus:ring-0"
              />

              {/* Attached Image Preview */}
              {imageUrl && (
                <div className="relative mt-2 rounded-2xl overflow-hidden border border-[#27272a] max-h-60">
                  <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Optional Image URL Input */}
              {showImageInput && !imageUrl && (
                <div className="mt-3 p-3 bg-[#18181b] rounded-2xl border border-[#27272a] space-y-2">
                  <input
                    type="url"
                    placeholder="Paste image URL (https://...)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-[#121212] border border-[#27272a] text-xs text-[#e5e2e1] rounded-xl px-3 py-2 outline-none focus:border-[#1d9bf0]"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#89919d]">Quick presets:</span>
                    {sampleImages.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setImageUrl(src)}
                        className="text-[10px] px-2 py-0.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#cfe5ff] rounded-md transition-colors"
                      >
                        Sample #{i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 p-2 rounded-xl border border-red-900/50">
              {error}
            </p>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-[#201f1f]">
            <div className="flex items-center gap-1 text-[#1d9bf0]">
              <button
                type="button"
                onClick={() => setShowImageInput((prev) => !prev)}
                className={`p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors ${
                  showImageInput || imageUrl ? 'bg-[#1d9bf0]/20' : ''
                }`}
                title="Add Image"
              >
                <Image className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setContent((prev) => prev + ' 🚀')}
                className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors"
                title="Add Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setContent((prev) => prev + ' #Glassmorphism')}
                className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors text-xs font-bold"
                title="Add Tag"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs ${content.length > 250 ? 'text-amber-400' : 'text-[#89919d]'}`}>
                {280 - content.length}
              </span>
              <button
                type="submit"
                disabled={!content.trim() || loading}
                className="px-5 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold text-sm rounded-full transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Post
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
