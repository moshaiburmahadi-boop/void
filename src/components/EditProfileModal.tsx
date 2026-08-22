import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Profile } from '../types';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updated: Partial<Profile>) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { profile, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setWebsite(profile.website || '');
      setAvatarUrl(profile.avatar_url || '');
      setCoverUrl(profile.cover_url || '');
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updatedData: Partial<Profile> = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        avatar_url: avatarUrl.trim() || null,
        cover_url: coverUrl.trim() || null,
      };

      const result = await updateProfile(updatedData);
      if (result.error) {
        console.error('Error saving profile:', result.error);
      } else {
        if (onSaved) onSaved(updatedData);
        onClose();
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#121212] border border-[#27272a] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#201f1f] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-[#201f1f] rounded-full text-[#89919d] hover:text-white cursor-pointer transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-base text-[#e5e2e1]">Edit profile</h3>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#e5e2e1] text-black hover:bg-white font-bold text-xs rounded-full transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Live Visual Header Preview */}
            <div className="rounded-2xl overflow-hidden border border-[#27272a] mb-2 relative bg-[#18181b]">
              <div className="h-28 w-full relative bg-neutral-900 overflow-hidden">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#18181b] via-[#20202a] to-[#121215] flex items-center justify-center text-xs text-[#89919d]">
                    <span className="flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" /> No cover photo set
                    </span>
                  </div>
                )}
              </div>
              <div className="px-4 pb-3 flex justify-between items-end -mt-10">
                <img
                  src={
                    avatarUrl ||
                    profile?.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                  }
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-full object-cover border-2 border-black bg-black shrink-0"
                />
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-[#89919d] mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-semibold text-[#89919d] mb-1">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the world about yourself..."
                className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] resize-none transition-colors"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-[#89919d] mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA"
                className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-xs font-semibold text-[#89919d] mb-1">Website</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
              />
            </div>

            {/* Avatar Image URL */}
            <div>
              <label className="block text-xs font-semibold text-[#89919d] mb-1">Avatar Image URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
              />
            </div>

            {/* Cover Photo URL */}
            <div>
              <label className="block text-xs font-semibold text-[#89919d] mb-1">Cover Photo URL</label>
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
              />
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
