import { supabase, isSupabaseConfigured } from './supabase';
import { Profile } from '../types';

export const triggerFollowNotification = async (
  followerProfile: Profile,
  targetUserId: string
) => {
  if (!isSupabaseConfigured || !followerProfile?.id || followerProfile.id === targetUserId) {
    return;
  }

  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: targetUserId,
      actor_id: followerProfile.id,
      type: 'follow',
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('Error inserting follow notification:', error.message);
    }
  } catch (err) {
    console.warn('Follow notification exception:', err);
  }
};
