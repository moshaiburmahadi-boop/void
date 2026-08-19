import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types';

interface FollowContextType {
  isFollowing: (userId: string) => boolean;
  getFollowerCount: (userId: string, baseCount?: number) => number;
  getFollowingCount: (userId: string, baseCount?: number) => number;
  toggleFollow: (targetUser: Profile) => Promise<boolean>;
  followingCount: number;
}

const FollowContext = createContext<FollowContextType | undefined>(undefined);

export const FollowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('void_follows_state');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [followerDeltaMap, setFollowerDeltaMap] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('void_followers_delta');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('void_follows_state', JSON.stringify(followingMap));
    } catch (e) {
      console.warn(e);
    }
  }, [followingMap]);

  useEffect(() => {
    try {
      localStorage.setItem('void_followers_delta', JSON.stringify(followerDeltaMap));
    } catch (e) {
      console.warn(e);
    }
  }, [followerDeltaMap]);

  // Load existing follows from Supabase if table exists
  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured) return;

    const loadFollows = async () => {
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', profile.id);

        if (!error && data) {
          const map: Record<string, boolean> = {};
          data.forEach((row) => {
            map[row.following_id] = true;
          });
          setFollowingMap((prev) => ({ ...prev, ...map }));
        }
      } catch {
        // Table might not exist yet; gracefully handled
      }
    };

    loadFollows();
  }, [profile?.id]);

  const isFollowing = (userId: string) => {
    return Boolean(followingMap[userId]);
  };

  const getFollowerCount = (userId: string, baseCount: number = 0) => {
    const delta = followerDeltaMap[userId] || 0;
    return Math.max(0, baseCount + delta);
  };

  const getFollowingCount = (userId: string, baseCount: number = 0) => {
    if (userId === profile?.id) {
      return Object.values(followingMap).filter(Boolean).length;
    }
    return baseCount;
  };

  const toggleFollow = async (targetUser: Profile): Promise<boolean> => {
    if (!profile || profile.id === targetUser.id) return false;

    const currentlyFollowing = Boolean(followingMap[targetUser.id]);
    const nextState = !currentlyFollowing;

    // 1. Update state immediately (optimistic UI)
    setFollowingMap((prev) => ({
      ...prev,
      [targetUser.id]: nextState,
    }));

    setFollowerDeltaMap((prev) => ({
      ...prev,
      [targetUser.id]: (prev[targetUser.id] || 0) + (nextState ? 1 : -1),
    }));

    if (!isSupabaseConfigured) return nextState;

    try {
      if (nextState) {
        // FOLLOW:
        // a) Insert into follows table (if exists)
        try {
          await supabase.from('follows').insert({
            follower_id: profile.id,
            following_id: targetUser.id,
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Follows table insert fallback:', e);
        }

        // b) Insert notification for target user ONLY on follow
        try {
          await supabase.from('notifications').insert({
            user_id: targetUser.id,
            actor_id: profile.id,
            type: 'follow',
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Follow notification insert error:', e);
        }
      } else {
        // UNFOLLOW:
        // a) Remove from follows table
        try {
          await supabase
            .from('follows')
            .delete()
            .match({ follower_id: profile.id, following_id: targetUser.id });
        } catch (e) {
          console.warn('Follows table delete fallback:', e);
        }

        // b) NO notification is sent on unfollow as requested!
      }
    } catch (err) {
      console.warn('Error in toggleFollow:', err);
    }

    return nextState;
  };

  const followingCount = Object.values(followingMap).filter(Boolean).length;

  return (
    <FollowContext.Provider
      value={{
        isFollowing,
        getFollowerCount,
        getFollowingCount,
        toggleFollow,
        followingCount,
      }}
    >
      {children}
    </FollowContext.Provider>
  );
};

export const useFollow = () => {
  const context = useContext(FollowContext);
  if (!context) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return context;
};
