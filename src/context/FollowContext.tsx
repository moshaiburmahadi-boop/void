import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types';

interface FollowStats {
  followers: number;
  following: number;
}

interface FollowContextType {
  isFollowing: (userId: string) => boolean;
  getFollowerCount: (userId: string) => number;
  getFollowingCount: (userId: string) => number;
  fetchUserFollowStats: (userId: string) => Promise<FollowStats>;
  toggleFollow: (targetUser: Profile) => Promise<boolean>;
  followingCount: number;
  followersCount: number;
  followingMap: Record<string, boolean>;
  followedUserIds: string[];
}

const FollowContext = createContext<FollowContextType | undefined>(undefined);

export const FollowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();

  // Set of user IDs that the current user is following: { [targetUserId]: boolean }
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('void_following_map');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Cached count of followers per user: { [userId]: count }
  const [followersCountMap, setFollowersCountMap] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('void_followers_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Cached count of following per user: { [userId]: count }
  const [followingCountMap, setFollowingCountMap] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('void_following_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Persist local state
  useEffect(() => {
    try {
      localStorage.setItem('void_following_map', JSON.stringify(followingMap));
    } catch (e) {
      console.warn(e);
    }
  }, [followingMap]);

  useEffect(() => {
    try {
      localStorage.setItem('void_followers_counts', JSON.stringify(followersCountMap));
      localStorage.setItem('void_following_counts', JSON.stringify(followingCountMap));
    } catch (e) {
      console.warn(e);
    }
  }, [followersCountMap, followingCountMap]);

  // Function to query dynamic follower & following counts directly from the Supabase follows table
  const fetchUserFollowStats = useCallback(async (userId: string): Promise<FollowStats> => {
    if (!isSupabaseConfigured || !userId) {
      return {
        followers: followersCountMap[userId] || 0,
        following: followingCountMap[userId] || 0,
      };
    }

    try {
      // 1. Count followers: rows where following_id = userId
      const { count: followersCount, error: followersErr } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      // 2. Count following: rows where follower_id = userId
      const { count: followingCount, error: followingErr } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      const stats: FollowStats = {
        followers: !followersErr && typeof followersCount === 'number' ? followersCount : (followersCountMap[userId] || 0),
        following: !followingErr && typeof followingCount === 'number' ? followingCount : (followingCountMap[userId] || 0),
      };

      setFollowersCountMap((prev) => ({ ...prev, [userId]: stats.followers }));
      setFollowingCountMap((prev) => ({ ...prev, [userId]: stats.following }));

      return stats;
    } catch (err) {
      console.warn('Error fetching follow counts from Supabase:', err);
      return {
        followers: followersCountMap[userId] || 0,
        following: followingCountMap[userId] || 0,
      };
    }
  }, [followersCountMap, followingCountMap]);

  // Load current user's following list and stats from Supabase
  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured) return;

    const loadCurrentUserFollows = async () => {
      try {
        // Query who current user is following
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', profile.id);

        if (!followError && followData) {
          const map: Record<string, boolean> = {};
          followData.forEach((row) => {
            map[row.following_id] = true;
          });
          setFollowingMap(map);
        }

        // Fetch exact stats for current user
        await fetchUserFollowStats(profile.id);
      } catch (err) {
        console.warn('Failed to load initial follows:', err);
      }
    };

    loadCurrentUserFollows();
  }, [profile?.id, fetchUserFollowStats]);

  // Realtime subscription to follows table
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('public_follows_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'follows',
        },
        (payload) => {
          const newFollow = payload.new as { follower_id: string; following_id: string };
          if (profile?.id && newFollow.follower_id === profile.id) {
            setFollowingMap((prev) => ({ ...prev, [newFollow.following_id]: true }));
          }

          // User being followed gets +1 followers
          setFollowersCountMap((prev) => ({
            ...prev,
            [newFollow.following_id]: (prev[newFollow.following_id] || 0) + 1,
          }));

          // User who followed gets +1 following
          setFollowingCountMap((prev) => ({
            ...prev,
            [newFollow.follower_id]: (prev[newFollow.follower_id] || 0) + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'follows',
        },
        (payload) => {
          const oldFollow = payload.old as { follower_id: string; following_id: string };
          if (oldFollow && oldFollow.follower_id && oldFollow.following_id) {
            if (profile?.id && oldFollow.follower_id === profile.id) {
              setFollowingMap((prev) => {
                const next = { ...prev };
                delete next[oldFollow.following_id];
                return next;
              });
            }

            setFollowersCountMap((prev) => ({
              ...prev,
              [oldFollow.following_id]: Math.max(0, (prev[oldFollow.following_id] || 1) - 1),
            }));

            setFollowingCountMap((prev) => ({
              ...prev,
              [oldFollow.follower_id]: Math.max(0, (prev[oldFollow.follower_id] || 1) - 1),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const isFollowing = (userId: string) => {
    return Boolean(followingMap[userId]);
  };

  const getFollowerCount = (userId: string) => {
    return followersCountMap[userId] || 0;
  };

  const getFollowingCount = (userId: string) => {
    if (profile?.id && userId === profile.id) {
      const activeFollowing = Object.values(followingMap).filter(Boolean).length;
      return activeFollowing;
    }
    return followingCountMap[userId] || 0;
  };

  // Strict Directional Follow Toggle
  const toggleFollow = async (targetUser: Profile): Promise<boolean> => {
    if (!profile || profile.id === targetUser.id) return false;

    const currentFollowingState = Boolean(followingMap[targetUser.id]);
    const nextFollowingState = !currentFollowingState;

    // 1. Optimistic UI update strictly for directional counts:
    // - Current user (follower): following_count changes by +/- 1, followers_count DOES NOT CHANGE.
    // - Target user (following): followers_count changes by +/- 1, following_count DOES NOT CHANGE.
    setFollowingMap((prev) => ({
      ...prev,
      [targetUser.id]: nextFollowingState,
    }));

    setFollowersCountMap((prev) => ({
      ...prev,
      [targetUser.id]: Math.max(0, (prev[targetUser.id] || 0) + (nextFollowingState ? 1 : -1)),
    }));

    setFollowingCountMap((prev) => ({
      ...prev,
      [profile.id]: Math.max(0, (prev[profile.id] || 0) + (nextFollowingState ? 1 : -1)),
    }));

    if (!isSupabaseConfigured) return nextFollowingState;

    try {
      if (nextFollowingState) {
        // A) Insert into follows table
        const { error: insertErr } = await supabase.from('follows').insert({
          follower_id: profile.id,
          following_id: targetUser.id,
          created_at: new Date().toISOString(),
        });

        if (insertErr) {
          console.warn('Follow insert note:', insertErr);
        }

        // B) Insert notification for target user
        try {
          await supabase.from('notifications').insert({
            user_id: targetUser.id,
            actor_id: profile.id,
            type: 'follow',
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Notification insert error:', e);
        }
      } else {
        // Unfollow: delete matching row
        const { error: deleteErr } = await supabase
          .from('follows')
          .delete()
          .match({ follower_id: profile.id, following_id: targetUser.id });

        if (deleteErr) {
          console.warn('Follow delete note:', deleteErr);
        }
      }

      // Re-sync exact counts in background
      fetchUserFollowStats(targetUser.id);
      fetchUserFollowStats(profile.id);
    } catch (err) {
      console.warn('Error in toggleFollow:', err);
    }

    return nextFollowingState;
  };

  const currentFollowingCount = Object.values(followingMap).filter(Boolean).length;
  const currentFollowersCount = profile?.id ? (followersCountMap[profile.id] || 0) : 0;
  const currentFollowedUserIds = Object.keys(followingMap).filter((id) => Boolean(followingMap[id]));

  return (
    <FollowContext.Provider
      value={{
        isFollowing,
        getFollowerCount,
        getFollowingCount,
        fetchUserFollowStats,
        toggleFollow,
        followingCount: currentFollowingCount,
        followersCount: currentFollowersCount,
        followingMap,
        followedUserIds: currentFollowedUserIds,
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
