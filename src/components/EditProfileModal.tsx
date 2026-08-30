import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Profile,
  BirthdayVisibility,
  BirthdayDisplay,
  GenderOption,
  GenderVisibility,
} from '../types';
import { supabase, isSupabaseConfigured, uploadProfileAsset } from '../lib/supabase';
import { PRESET_INTERESTS, sanitizeWebsiteUrl, notifyFollowersOfMediaUpdate } from '../utils/profile';
import {
  X,
  Camera,
  Upload,
  Trash2,
  Loader2,
  User,
  Shield,
  Briefcase,
  GraduationCap,
  Sparkles,
  Check,
  AlertCircle,
  Calendar,
  Globe,
  MapPin,
  Lock,
  Eye,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updated: Partial<Profile>) => void;
}

type TabSection = 'profile' | 'personal' | 'about' | 'interests' | 'privacy';

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { profile, user, updateProfile, refreshProfile } = useAuth();

  // Active navigation tab within modal
  const [activeTab, setActiveTab] = useState<TabSection>('profile');

  // Form Fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  // Date of Birth & Privacy
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [birthdayVisibility, setBirthdayVisibility] = useState<BirthdayVisibility>('only_me');
  const [birthdayDisplay, setBirthdayDisplay] = useState<BirthdayDisplay>('month_day');

  // Gender & Privacy
  const [gender, setGender] = useState<GenderOption>('prefer_not_to_say');
  const [genderCustom, setGenderCustom] = useState('');
  const [genderVisibility, setGenderVisibility] = useState<GenderVisibility>('only_me');

  // About Fields
  const [occupation, setOccupation] = useState('');
  const [education, setEducation] = useState('');

  // Interests
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterestInput, setCustomInterestInput] = useState('');

  // Image Upload / Preview States
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Status & Error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state with incoming profile on open
  useEffect(() => {
    if (isOpen && profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setWebsite(profile.website || '');

      setDateOfBirth(profile.date_of_birth ? profile.date_of_birth.split('T')[0] : '');
      setBirthdayVisibility(profile.birthday_visibility || 'only_me');
      setBirthdayDisplay(profile.birthday_display || 'month_day');

      setGender((profile.gender as GenderOption) || 'prefer_not_to_say');
      setGenderCustom(profile.gender_custom || '');
      setGenderVisibility(profile.gender_visibility || 'only_me');

      setOccupation(profile.occupation || '');
      setEducation(profile.education || '');
      setInterests(Array.isArray(profile.interests) ? profile.interests : []);

      setAvatarPreview(profile.avatar_url || null);
      setAvatarFile(null);
      setCoverPreview(profile.cover_url || null);
      setCoverFile(null);

      setErrorMessage(null);
      setSuccessMessage(null);
      setActiveTab('profile');
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  // Handle avatar image selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Avatar image size must be under 5MB.');
      return;
    }

    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setErrorMessage(null);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  // Handle cover image selection
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Cover image size must be under 10MB.');
      return;
    }

    setCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreview(objectUrl);
    setErrorMessage(null);
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  // Interest management
  const handleToggleInterest = (tag: string) => {
    if (interests.includes(tag)) {
      setInterests(interests.filter((i) => i !== tag));
    } else {
      if (interests.length >= 20) {
        setErrorMessage('You can select up to 20 interests.');
        return;
      }
      setInterests([...interests, tag]);
    }
  };

  const handleAddCustomInterest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customInterestInput.trim().replace(/^#/, '');
    if (!clean) return;

    if (clean.length > 25) {
      setErrorMessage('Interest tag must be 25 characters or fewer.');
      return;
    }

    if (interests.some((i) => i.toLowerCase() === clean.toLowerCase())) {
      setErrorMessage(`"${clean}" is already in your interests.`);
      return;
    }

    if (interests.length >= 20) {
      setErrorMessage('You can select up to 20 interests.');
      return;
    }

    setInterests([...interests, clean]);
    setCustomInterestInput('');
    setErrorMessage(null);
  };

  const handleRemoveInterest = (tag: string) => {
    setInterests(interests.filter((i) => i !== tag));
  };

  // Submit and save profile
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Validation
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setErrorMessage('Username is required.');
      setActiveTab('profile');
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setErrorMessage(
        'Username must be 3-20 characters long and contain only letters, numbers, or underscores.'
      );
      setActiveTab('profile');
      return;
    }

    if (displayName.trim().length > 50) {
      setErrorMessage('Display name must be 50 characters or fewer.');
      setActiveTab('profile');
      return;
    }

    if (bio.trim().length > 160) {
      setErrorMessage('Bio must be 160 characters or fewer.');
      setActiveTab('profile');
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Check Username Uniqueness if changed
      if (profile && cleanUsername !== profile.username.toLowerCase() && isSupabaseConfigured) {
        const { data: existingUser, error: checkErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .neq('id', profile.id)
          .maybeSingle();

        if (checkErr) {
          console.warn('Error checking username uniqueness:', checkErr);
        }

        if (existingUser) {
          setErrorMessage(`@${cleanUsername} is already taken. Please choose another username.`);
          setActiveTab('profile');
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Upload avatar image if new file selected
      let finalAvatarUrl: string | null = avatarPreview;
      if (avatarFile && user?.id) {
        const { url: uploadedAvatar, error: avErr } = await uploadProfileAsset(
          avatarFile,
          'avatars',
          user.id,
          'avatar'
        );
        if (avErr) {
          console.warn('Avatar upload note:', avErr.message);
        }
        if (uploadedAvatar) {
          finalAvatarUrl = uploadedAvatar;
        }
      } else if (!avatarPreview) {
        finalAvatarUrl = null;
      }

      // 4. Upload cover image if new file selected
      let finalCoverUrl: string | null = coverPreview;
      if (coverFile && user?.id) {
        const { url: uploadedCover, error: covErr } = await uploadProfileAsset(
          coverFile,
          'avatars',
          user.id,
          'cover'
        );
        if (covErr) {
          console.warn('Cover upload note:', covErr.message);
        }
        if (uploadedCover) {
          finalCoverUrl = uploadedCover;
        }
      } else if (!coverPreview) {
        finalCoverUrl = null;
      }

      // 5. Build full updated profile object
      const formattedWebsite = website.trim() ? sanitizeWebsiteUrl(website.trim()) : null;

      const updatedData: Partial<Profile> = {
        username: cleanUsername,
        display_name: displayName.trim() || cleanUsername,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: formattedWebsite,
        avatar_url: finalAvatarUrl,
        cover_url: finalCoverUrl,
        date_of_birth: dateOfBirth ? dateOfBirth : null,
        birthday_visibility: birthdayVisibility,
        birthday_display: birthdayDisplay,
        gender: gender,
        gender_custom: gender === 'custom' ? genderCustom.trim() || null : null,
        gender_visibility: genderVisibility,
        occupation: occupation.trim() || null,
        education: education.trim() || null,
        interests: interests,
      };

      // 6. Save via AuthContext / Supabase
      const result = await updateProfile(updatedData);

      if (result.error) {
        setErrorMessage(`Failed to update profile: ${result.error.message || 'Unknown error'}`);
        setIsSubmitting(false);
        return;
      }

      // Check if avatar or cover photo was updated to notify all followers
      const avatarUpdated = Boolean(
        finalAvatarUrl &&
        finalAvatarUrl !== (profile?.avatar_url || null)
      );
      const coverUpdated = Boolean(
        finalCoverUrl &&
        finalCoverUrl !== (profile?.cover_url || null)
      );

      const mediaUpdateTypes: ('avatar_update' | 'cover_update')[] = [];
      if (avatarUpdated) mediaUpdateTypes.push('avatar_update');
      if (coverUpdated) mediaUpdateTypes.push('cover_update');

      if (mediaUpdateTypes.length > 0 && profile) {
        const fullUpdatedProfile: Profile = {
          ...profile,
          ...updatedData,
        } as Profile;
        // Broadcast notification to all followers in background
        notifyFollowersOfMediaUpdate(fullUpdatedProfile, mediaUpdateTypes).catch((err) => {
          console.warn('Notification broadcast warning:', err);
        });
      }

      await refreshProfile();

      if (onSaved) {
        onSaved(updatedData);
      }

      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#101012] border border-[#27272a] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Modal Header */}
          <div className="px-5 py-3.5 border-b border-[#201f22] flex items-center justify-between shrink-0 bg-[#141417]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-[#222227] rounded-full text-[#89919d] hover:text-white cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="font-bold text-base text-[#e5e2e1]">Edit profile</h3>
                <p className="text-[11px] text-[#89919d]">Customize your identity, bio, and privacy</p>
              </div>
            </div>

            <button
              type="button"
              id="save-profile-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-1.5 bg-[#e5e2e1] text-black hover:bg-white font-bold text-xs rounded-full transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-[#201f22] bg-[#0c0c0e] px-2 overflow-x-auto scrollbar-none shrink-0">
            {(
              [
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'personal', label: 'Personal', icon: Calendar },
                { id: 'about', label: 'About', icon: Briefcase },
                { id: 'interests', label: 'Interests', icon: Sparkles },
                { id: 'privacy', label: 'Privacy', icon: Shield },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                    isActive
                      ? 'border-[#1d9bf0] text-[#1d9bf0] bg-[#1d9bf0]/5'
                      : 'border-transparent text-[#89919d] hover:text-[#e5e2e1] hover:bg-[#151518]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="mx-5 mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center gap-2.5 text-xs text-red-200 shrink-0 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="flex-1">{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mx-5 mt-4 p-3 bg-green-950/40 border border-green-800/60 rounded-xl flex items-center gap-2.5 text-xs text-green-200 shrink-0">
              <Check className="w-4 h-4 text-green-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Tab Content Panels */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-5">
            {/* SECTION 1: PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                {/* Visual Cover & Avatar Interactive Editor */}
                <div className="rounded-2xl overflow-hidden border border-[#27272a] relative bg-[#18181b]">
                  {/* Cover Photo Area */}
                  <div className="h-32 w-full relative bg-neutral-900 overflow-hidden group">
                    {coverPreview ? (
                      <img
                        src={coverPreview}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#18181b] via-[#202028] to-[#121215] flex items-center justify-center text-xs text-[#89919d]">
                        <span>No cover photo set</span>
                      </div>
                    )}

                    {/* Cover Photo Actions Overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="p-2.5 bg-black/70 hover:bg-black/90 text-white rounded-full transition-all hover:scale-105 cursor-pointer shadow-lg border border-white/10"
                        title="Upload Cover Photo"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      {coverPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveCover}
                          className="p-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 rounded-full transition-all hover:scale-105 cursor-pointer shadow-lg border border-red-700/30"
                          title="Remove Cover Photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="hidden"
                    />
                  </div>

                  {/* Avatar Area */}
                  <div className="px-4 pb-3 flex justify-between items-end -mt-12">
                    <div className="relative group">
                      <img
                        src={
                          avatarPreview ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                        }
                        alt="Avatar preview"
                        className="w-20 h-20 rounded-full object-cover border-4 border-[#101012] bg-[#101012] shrink-0"
                      />
                      {/* Avatar Overlay Controls */}
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-full hover:scale-105 transition-transform cursor-pointer"
                          title="Upload Avatar"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        {avatarPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            className="p-2 bg-red-950/80 hover:bg-red-900 text-red-300 rounded-full hover:scale-105 transition-transform cursor-pointer"
                            title="Remove Avatar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="px-3 py-1.5 bg-[#202025] hover:bg-[#2a2a30] text-[#e5e2e1] text-xs font-semibold rounded-full flex items-center gap-1.5 border border-[#33333a] cursor-pointer transition-colors"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Change Photo</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#89919d]">Display Name</label>
                    <span className="text-[10px] text-[#71767b]">{displayName.length}/50</span>
                  </div>
                  <input
                    type="text"
                    maxLength={50}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Satoshi Nakamoto"
                    className="w-full bg-[#161619] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                  />
                </div>

                {/* Username */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#89919d]">Username</label>
                    <span className="text-[10px] text-[#71767b]">@{username.toLowerCase()}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#71767b]">
                      @
                    </span>
                    <input
                      type="text"
                      maxLength={20}
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                      }
                      placeholder="username"
                      className="w-full bg-[#161619] border border-[#27272a] rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-[#71767b] mt-1">
                    Letters, numbers, and underscores only (3-20 chars). Must be unique.
                  </p>
                </div>

                {/* Bio */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#89919d]">Bio</label>
                    <span className="text-[10px] text-[#71767b]">{bio.length}/160</span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={160}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell the world about yourself..."
                    className="w-full bg-[#161619] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] resize-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* SECTION 2: PERSONAL */}
            {activeTab === 'personal' && (
              <div className="space-y-4">
                {/* Date of Birth & Visibility */}
                <div className="bg-[#141417] p-4 rounded-2xl border border-[#201f22] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#e5e2e1] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#1d9bf0]" />
                      <span>Date of Birth</span>
                    </label>
                    <span className="text-[10px] text-[#89919d] flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#1d9bf0]" /> Private by default
                    </span>
                  </div>

                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full bg-[#1b1b1f] border border-[#2a2a2f] rounded-xl px-3.5 py-2.5 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Birthday Visibility */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#89919d] mb-1">
                        Who can see your birthday
                      </label>
                      <select
                        value={birthdayVisibility}
                        onChange={(e) =>
                          setBirthdayVisibility(e.target.value as BirthdayVisibility)
                        }
                        className="w-full bg-[#1b1b1f] border border-[#2a2a2f] rounded-xl px-3 py-2 text-xs text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                      >
                        <option value="only_me">Only me (Private)</option>
                        <option value="followers">Followers only</option>
                        <option value="public">Public (Everyone)</option>
                      </select>
                    </div>

                    {/* Birthday Display Preference */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#89919d] mb-1">
                        Display format on profile
                      </label>
                      <select
                        value={birthdayDisplay}
                        onChange={(e) => setBirthdayDisplay(e.target.value as BirthdayDisplay)}
                        className="w-full bg-[#1b1b1f] border border-[#2a2a2f] rounded-xl px-3 py-2 text-xs text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                      >
                        <option value="month_day">Month and Day only (e.g. Born May 14)</option>
                        <option value="full">Full birthday (e.g. Born May 14, 1998)</option>
                        <option value="age">Age only (e.g. 26 years old)</option>
                        <option value="hidden">Hide completely from profile</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Gender & Visibility */}
                <div className="bg-[#141417] p-4 rounded-2xl border border-[#201f22] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#e5e2e1] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#1d9bf0]" />
                      <span>Gender</span>
                    </label>
                    <span className="text-[10px] text-[#89919d]">Optional</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#89919d] mb-1">
                        Gender identity
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as GenderOption)}
                        className="w-full bg-[#1b1b1f] border border-[#2a2a2f] rounded-xl px-3 py-2 text-xs text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                      >
                        <option value="prefer_not_to_say">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#89919d] mb-1">
                        Who can see your gender
                      </label>
                      <select
                        value={genderVisibility}
                        onChange={(e) => setGenderVisibility(e.target.value as GenderVisibility)}
                        className="w-full bg-[#1b1b1f] border border-[#2a2a2f] rounded-xl px-3 py-2 text-xs text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                      >
                        <option value="only_me">Only me (Private)</option>
                        <option value="followers">Followers only</option>
                        <option value="public">Public (Everyone)</option>
                      </select>
                    </div>
                  </div>

                  {gender === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="pt-1"
                    >
                      <label className="block text-[11px] font-semibold text-[#89919d] mb-1">
                        Custom gender description
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        value={genderCustom}
                        onChange={(e) => setGenderCustom(e.target.value)}
                        placeholder="e.g. Agender, Genderfluid, etc."
                        className="w-full bg-[#1b1b1f] border border-[#2a2a2f] rounded-xl px-3.5 py-2 text-xs text-[#e5e2e1] outline-none focus:border-[#1d9bf0]"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-semibold text-[#89919d] mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#89919d]" />
                    <span>Location</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Tokyo, Japan or Remote"
                    className="w-full bg-[#161619] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* SECTION 3: ABOUT */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                {/* Occupation */}
                <div>
                  <label className="block text-xs font-semibold text-[#89919d] mb-1 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#89919d]" />
                    <span>Occupation / Work</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Software Engineer, Designer, Student, Founder"
                    className="w-full bg-[#161619] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                  />
                  {/* Suggestions */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['Developer', 'Designer', 'Student', 'Creator', 'Researcher', 'Engineer'].map(
                      (role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setOccupation(role)}
                          className="px-2 py-0.5 bg-[#1f1f24] hover:bg-[#282830] text-[#89919d] hover:text-[#e5e2e1] rounded-md text-[11px] transition-colors"
                        >
                          + {role}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Education */}
                <div>
                  <label className="block text-xs font-semibold text-[#89919d] mb-1 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[#89919d]" />
                    <span>Education</span>
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="e.g. MIT, Stanford, Self-taught"
                    className="w-full bg-[#161619] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-xs font-semibold text-[#89919d] mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#89919d]" />
                    <span>Website</span>
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        setWebsite(sanitizeWebsiteUrl(e.target.value));
                      }
                    }}
                    placeholder="https://yourportfolio.com or yoursite.com"
                    className="w-full bg-[#161619] border border-[#27272a] rounded-xl px-3.5 py-2.5 text-sm text-[#e5e2e1] outline-none focus:border-[#1d9bf0] transition-colors"
                  />
                  <p className="text-[10px] text-[#71767b] mt-1">
                    Will be displayed as a clickable external link on your profile.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 4: INTERESTS */}
            {activeTab === 'interests' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#e5e2e1] mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#1d9bf0]" />
                    <span>Your Interests ({interests.length}/20)</span>
                  </label>
                  <p className="text-xs text-[#89919d] mb-3">
                    Add topics you love to help people discover and connect with your profile.
                  </p>

                  {/* Selected Interests Chips */}
                  {interests.length > 0 && (
                    <div className="p-3.5 bg-[#141417] border border-[#201f22] rounded-2xl mb-4">
                      <div className="flex flex-wrap gap-2">
                        {interests.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1d9bf0]/15 text-[#1d9bf0] border border-[#1d9bf0]/30 rounded-full text-xs font-medium animate-fadeIn"
                          >
                            <span>#{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveInterest(tag)}
                              className="hover:text-white rounded-full p-0.5 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Interest Input */}
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#71767b]">
                        #
                      </span>
                      <input
                        type="text"
                        value={customInterestInput}
                        onChange={(e) => setCustomInterestInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomInterest();
                          }
                        }}
                        placeholder="Add a custom interest (e.g. Architecture, Rust)"
                        className="w-full bg-[#161619] border border-[#27272a] rounded-xl pl-7 pr-3.5 py-2 text-xs text-[#e5e2e1] outline-none focus:border-[#1d9bf0]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomInterest}
                      className="px-4 py-2 bg-[#202025] hover:bg-[#2b2b32] text-[#e5e2e1] rounded-xl text-xs font-semibold flex items-center gap-1 border border-[#33333a] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Popular Presets */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#89919d] mb-2">
                      Popular topics to explore:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_INTERESTS.map((tag) => {
                        const isSelected = interests.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleInterest(tag)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#1d9bf0] text-white'
                                : 'bg-[#18181b] text-[#89919d] hover:text-[#e5e2e1] hover:bg-[#222227] border border-[#27272a]'
                            }`}
                          >
                            {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: PRIVACY */}
            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div className="p-4 bg-[#141417] rounded-2xl border border-[#201f22] space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#e5e2e1]">
                    <Shield className="w-4 h-4 text-[#1d9bf0]" />
                    <span>Profile Privacy Summary</span>
                  </div>
                  <p className="text-xs text-[#89919d]">
                    Control how sensitive details like birthday and gender are displayed to
                    different visitors.
                  </p>

                  <div className="divide-y divide-[#201f22] text-xs">
                    {/* Birthday Setting Summary */}
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#e5e2e1] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#1d9bf0]" />
                          Birthday Visibility
                        </p>
                        <p className="text-[#89919d] text-[11px] mt-0.5">
                          {birthdayVisibility === 'only_me'
                            ? 'Only visible to you'
                            : birthdayVisibility === 'followers'
                            ? 'Visible only to confirmed followers'
                            : 'Publicly visible'}
                          {' • '}
                          Format:{' '}
                          {birthdayDisplay === 'month_day'
                            ? 'Month & Day'
                            : birthdayDisplay === 'full'
                            ? 'Full Date'
                            : birthdayDisplay === 'age'
                            ? 'Age only'
                            : 'Hidden'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('personal')}
                        className="text-[#1d9bf0] hover:underline text-xs font-medium"
                      >
                        Change
                      </button>
                    </div>

                    {/* Gender Setting Summary */}
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#e5e2e1] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#1d9bf0]" />
                          Gender Visibility
                        </p>
                        <p className="text-[#89919d] text-[11px] mt-0.5">
                          {genderVisibility === 'only_me'
                            ? 'Only visible to you'
                            : genderVisibility === 'followers'
                            ? 'Visible only to confirmed followers'
                            : 'Publicly visible'}
                          {' • '}
                          Value:{' '}
                          {gender === 'custom'
                            ? genderCustom || 'Custom'
                            : gender === 'prefer_not_to_say'
                            ? 'Not specified'
                            : gender}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('personal')}
                        className="text-[#1d9bf0] hover:underline text-xs font-medium"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-[#18181b]/50 border border-[#27272a] rounded-xl text-xs text-[#89919d] flex items-start gap-2.5">
                  <Eye className="w-4 h-4 text-[#1d9bf0] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#e5e2e1] font-semibold mb-0.5">Privacy First Promise</p>
                    <p className="text-[11px]">
                      Your private information is filtered automatically. Other users will never see
                      fields set to &quot;Only me&quot;.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
