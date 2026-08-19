export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  created_at: string;
  verified?: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  profiles?: Profile | null;
  likes_count?: number;
  user_has_liked?: boolean;
  replies_count?: number;
  reposts_count?: number;
  views_count?: string | number;
  user_has_reposted?: boolean;
  user_has_bookmarked?: boolean;
}

export interface Like {
  id: string;
  post_id: string;
  user_id: string;
  created_at?: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  sender_profile?: Profile | null;
  receiver_profile?: Profile | null;
  read?: boolean;
}

export type NotificationType = 'like' | 'repost' | 'follow' | 'mention';

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  created_at: string;
  post_id?: string | null;
  actor_profile?: Profile | null;
  post_content?: string | null;
  read?: boolean;
}

export type ActiveTab = 'feed' | 'messages' | 'compose' | 'notifications' | 'profile' | 'explore';
