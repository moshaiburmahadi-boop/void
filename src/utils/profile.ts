import { BirthdayDisplay, BirthdayVisibility, GenderOption, GenderVisibility, NotificationType, Profile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const PRESET_INTERESTS: string[] = [
  'Technology',
  'Programming',
  'Design',
  'AI & ML',
  'Gaming',
  'Music',
  'Movies',
  'Photography',
  'Crypto & Web3',
  'Science',
  'Art & Illustration',
  'Writing',
  'Fitness & Health',
  'Travel',
  'Reading',
  'Startups',
  'Open Source',
  'Robotics',
  'Cybersecurity',
  'Coffee',
];

export function calculateAge(dobString?: string | null): number | null {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function formatBirthday(
  dobString?: string | null,
  displayPreference: BirthdayDisplay = 'month_day'
): string | null {
  if (!dobString || displayPreference === 'hidden') return null;

  // Handle YYYY-MM-DD safely without timezone shifts
  const parts = dobString.split('T')[0].split('-');
  if (parts.length < 3) return null;

  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const dateObj = new Date(year, monthIndex, day);
  if (isNaN(dateObj.getTime())) return null;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[monthIndex] || '';

  if (displayPreference === 'full') {
    return `Born ${monthName} ${day}, ${year}`;
  }

  if (displayPreference === 'month_day') {
    return `Born ${monthName} ${day}`;
  }

  if (displayPreference === 'age') {
    const age = calculateAge(dobString);
    return age !== null ? `${age} years old` : null;
  }

  return null;
}

export function canViewField(
  visibility: BirthdayVisibility | GenderVisibility | 'public' | 'followers' | 'only_me' | null | undefined,
  isSelf: boolean,
  isFollowed: boolean
): boolean {
  if (isSelf) return true;
  if (!visibility || visibility === 'only_me') return false;
  if (visibility === 'followers') return isFollowed;
  if (visibility === 'public') return true;
  return false;
}

export function formatGender(
  gender?: GenderOption | string | null,
  customGender?: string | null
): string | null {
  if (!gender || gender === 'prefer_not_to_say') return null;
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  if (gender === 'non_binary') return 'Non-binary';
  if (gender === 'custom') return customGender?.trim() || 'Custom';
  return gender;
}

export function sanitizeWebsiteUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

export function formatWebsiteDisplay(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  url = url.replace(/^https?:\/\//i, '');
  url = url.replace(/^www\./i, '');
  url = url.replace(/\/+$/, '');
  return url;
}

/**
 * Sends notifications to all followers when a user updates their profile picture or cover photo.
 */
export async function notifyFollowersOfMediaUpdate(
  actorProfile: Profile,
  updateTypes: ('avatar_update' | 'cover_update')[]
): Promise<number> {
  if (!actorProfile?.id || !updateTypes || updateTypes.length === 0) return 0;

  let notifiedCount = 0;

  if (isSupabaseConfigured) {
    try {
      // 1. Fetch all follower IDs of this user
      const { data: followers, error: followErr } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', actorProfile.id);

      if (followErr) {
        console.warn('Error fetching followers for profile update notification:', followErr);
      } else if (followers && followers.length > 0) {
        const notificationsPayload: Array<{
          user_id: string;
          actor_id: string;
          type: NotificationType;
          created_at: string;
        }> = [];

        for (const f of followers) {
          // Do not send notification to self
          if (!f.follower_id || f.follower_id === actorProfile.id) continue;

          for (const uType of updateTypes) {
            notificationsPayload.push({
              user_id: f.follower_id,
              actor_id: actorProfile.id,
              type: uType,
              created_at: new Date().toISOString(),
            });
          }
        }

        if (notificationsPayload.length > 0) {
          const { error: insertErr } = await supabase
            .from('notifications')
            .insert(notificationsPayload);

          if (insertErr) {
            console.warn('Error inserting profile media update notifications:', insertErr);
          } else {
            notifiedCount = notificationsPayload.length;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to notify followers via Supabase:', err);
    }
  }

  // Local storage broadcast for offline / demo mode
  try {
    const localNotifsKey = `void_local_notifications_broadcast`;
    const existing = localStorage.getItem(localNotifsKey);
    const list = existing ? JSON.parse(existing) : [];
    for (const uType of updateTypes) {
      list.unshift({
        id: `local_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        actor_id: actorProfile.id,
        actor_profile: actorProfile,
        type: uType,
        created_at: new Date().toISOString(),
      });
    }
    localStorage.setItem(localNotifsKey, JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.warn(e);
  }

  return notifiedCount;
}

