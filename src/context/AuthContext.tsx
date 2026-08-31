import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types';
import { CURRENT_USER } from '../data/mockData';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isDemoMode: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, username?: string, fullName?: string) => Promise<{ error: AuthError | Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  updateProfile: (updatedData: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    // If not configured, check if demo mode was toggled
    const stored = localStorage.getItem('void_demo_mode');
    return stored === 'true' || !isSupabaseConfigured;
  });

  // Fetch or create profile for authenticated user
  const fetchUserProfile = async (userId: string, userEmail?: string, metadata?: Record<string, any>) => {
    if (!isSupabaseConfigured || isDemoMode) {
      try {
        const cached = localStorage.getItem('void_custom_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          setProfile({ ...CURRENT_USER, ...parsed });
          return;
        }
      } catch (_) {}
      setProfile(CURRENT_USER);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile from Supabase:', error.message);
      }

      if (data) {
        setProfile(data as Profile);
      } else {
        // Create initial profile if missing
        const defaultUsername = metadata?.username || userEmail?.split('@')[0] || `user_${userId.slice(0, 5)}`;
        const defaultDisplayName = metadata?.full_name || defaultUsername;
        const newProfile: Partial<Profile> = {
          id: userId,
          username: defaultUsername,
          display_name: defaultDisplayName,
          avatar_url: metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          bio: 'Building on Void. Minimalist systems architect.',
          created_at: new Date().toISOString(),
          verified: false,
        };

        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (!insertError && inserted) {
          setProfile(inserted as Profile);
        } else {
          setProfile({
            id: userId,
            username: defaultUsername,
            display_name: defaultDisplayName,
            avatar_url: newProfile.avatar_url,
            bio: newProfile.bio,
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.error('Failed to resolve user profile:', err);
      try {
        const cached = localStorage.getItem('void_custom_profile');
        if (cached) {
          setProfile({ ...CURRENT_USER, ...JSON.parse(cached) });
          return;
        }
      } catch (_) {}
      setProfile(CURRENT_USER);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Use demo profile for instant interactivity
      if (isDemoMode) {
        setProfile(CURRENT_USER);
      }
      setLoading(false);
      return;
    }

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchUserProfile(initialSession.user.id, initialSession.user.email, initialSession.user.user_metadata);
      } else if (isDemoMode) {
        setProfile(CURRENT_USER);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // 2. Listen to Auth State Changes using onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        setIsDemoMode(false);
        localStorage.setItem('void_demo_mode', 'false');
        fetchUserProfile(currentSession.user.id, currentSession.user.email, currentSession.user.user_metadata);
      } else {
        if (isDemoMode) {
          setProfile(CURRENT_USER);
        } else {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isDemoMode]);

  const signUp = async (email: string, password: string, username?: string, fullName?: string) => {
    if (!isSupabaseConfigured) {
      // Local simulated signup
      setIsDemoMode(true);
      localStorage.setItem('void_demo_mode', 'true');
      const mockProfile: Profile = {
        ...CURRENT_USER,
        username: username || email.split('@')[0],
        display_name: fullName || username || email.split('@')[0],
      };
      setProfile(mockProfile);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
            full_name: fullName || username || email.split('@')[0],
          },
        },
      });

      if (error) return { error };

      if (data.user) {
        setIsDemoMode(false);
        localStorage.setItem('void_demo_mode', 'false');
        await fetchUserProfile(data.user.id, data.user.email, {
          username: username || email.split('@')[0],
          full_name: fullName,
        });
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      // Local simulated signin
      setIsDemoMode(true);
      localStorage.setItem('void_demo_mode', 'true');
      setProfile(CURRENT_USER);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };

      if (data.user) {
        setIsDemoMode(false);
        localStorage.setItem('void_demo_mode', 'false');
        await fetchUserProfile(data.user.id, data.user.email, data.user.user_metadata);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured && session) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error signing out of Supabase:', err);
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsDemoMode(false);
    localStorage.setItem('void_demo_mode', 'false');
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
    localStorage.setItem('void_demo_mode', 'true');
    setProfile(CURRENT_USER);
  };

  const updateProfile = async (updatedData: Partial<Profile>) => {
    if (!profile) return { error: new Error('No profile found') };

    const merged = { ...profile, ...updatedData };
    setProfile(merged);

    try {
      localStorage.setItem('void_custom_profile', JSON.stringify(merged));
    } catch (_) {}

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update(updatedData)
          .eq('id', user.id);

        if (error) {
          console.warn('Full profile update warning, attempting core fields fallback:', error.message);
          // Fallback: If newer optional schema columns don't exist yet on remote table, update core columns
          const coreUpdate: Record<string, any> = {};
          if (updatedData.username !== undefined) coreUpdate.username = updatedData.username;
          if (updatedData.display_name !== undefined) coreUpdate.display_name = updatedData.display_name;
          if (updatedData.bio !== undefined) coreUpdate.bio = updatedData.bio;
          if (updatedData.location !== undefined) coreUpdate.location = updatedData.location;
          if (updatedData.website !== undefined) coreUpdate.website = updatedData.website;
          if (updatedData.avatar_url !== undefined) coreUpdate.avatar_url = updatedData.avatar_url;
          if (updatedData.cover_url !== undefined) coreUpdate.cover_url = updatedData.cover_url;

          const { error: fallbackError } = await supabase
            .from('profiles')
            .update(coreUpdate)
            .eq('id', user.id);

          if (fallbackError) {
            console.error('Fallback profile update error:', fallbackError);
            return { error: fallbackError };
          }
        }
      } catch (err: any) {
        console.error('Error updating profile in Supabase:', err);
        return { error: err };
      }
    }

    return { error: null };
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id, user.email, user.user_metadata);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isDemoMode,
        isConfigured: isSupabaseConfigured,
        signUp,
        signIn,
        signOut,
        enterDemoMode,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
