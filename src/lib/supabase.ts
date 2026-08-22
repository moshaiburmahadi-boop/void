import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://oqqmwsfavylcyqtqtwfg.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcW13c2ZhdnlsY3lxdHF0d2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDUwMjcsImV4cCI6MjEwMjg4MTAyN30.s7Ki9HnhPukAZ2CqpFvFR3GjRqwhE6NKi2PqsHkmRmk';

// Clean and normalize Supabase URL
export function sanitizeSupabaseUrl(rawUrl?: string | null): string {
  if (!rawUrl) return DEFAULT_SUPABASE_URL;
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.includes('.supabase.co')) {
      url = `https://${url}`;
    } else {
      url = `https://${url}.supabase.co`;
    }
  }
  // Strip trailing slashes and any subpaths like /auth/v1 or /rest/v1
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/(auth|rest|storage|functions)(\/v\d.*)?$/i, '');
  return url;
}

// Environment variables
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

// Check local storage for runtime-configured credentials
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('void_supabase_url') : null;
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('void_supabase_anon_key') : null;

export const supabaseUrl = sanitizeSupabaseUrl(storedUrl || envUrl || DEFAULT_SUPABASE_URL);
export const supabaseAnonKey = (storedKey || envAnonKey || DEFAULT_SUPABASE_ANON_KEY).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('demo-placeholder') &&
  !supabaseAnonKey.includes('placeholder')
);

// Initialize Supabase Client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const updateSupabaseCredentials = (url: string, key: string) => {
  const cleanUrl = sanitizeSupabaseUrl(url);
  localStorage.setItem('void_supabase_url', cleanUrl);
  localStorage.setItem('void_supabase_anon_key', key.trim());
  window.location.reload();
};

export const clearSupabaseCredentials = () => {
  localStorage.removeItem('void_supabase_url');
  localStorage.removeItem('void_supabase_anon_key');
  window.location.reload();
};

export const SCHEMA_SQL = `-- VOID Complete Database Schema (Supabase)
-- 1. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  website TEXT,
  location TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Likes Table
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(post_id, user_id)
);

-- 4. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Follows Table (Strict Directional Follower/Following)
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);

-- 6. Messages Table (Realtime Chat with Reply, Unsend, Delete-for-me, Edit)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_unsent BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  deleted_for_user_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- For upgrading existing messages table:
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_unsent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_for_user_ids UUID[] DEFAULT '{}';

-- 7. Message Reactions Table (Emoji Reactions)
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.message_reactions(user_id);

-- 8. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'repost', 'follow', 'mention')),
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Posts are viewable by everyone." ON public.posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts." ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts." ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts." ON public.posts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Likes are viewable by everyone." ON public.likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like posts." ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts." ON public.likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Comments are viewable by everyone." ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment." ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments." ON public.comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Follows are viewable by everyone." ON public.follows FOR SELECT USING (true);
CREATE POLICY "Authenticated users can follow." ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow." ON public.follows FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "Users can view their messages." ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages." ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their messages." ON public.messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can delete their messages." ON public.messages FOR DELETE USING (auth.uid() = sender_id);

CREATE POLICY "Reactions are viewable by everyone." ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add reactions." ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their reactions." ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their notifications." ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create notifications." ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Trigger to automatically create profile for new auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, bio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
    'Building on Void.'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
`;
