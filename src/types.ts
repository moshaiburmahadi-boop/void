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
  follower_count?: number;
  following_count?: number;
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

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile | null;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
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
  reply_to_id?: string | null;
  reply_to_message?: {
    id: string;
    content: string;
    sender_id: string;
    sender_profile?: Profile | null;
  } | null;
  is_unsent?: boolean;
  deleted_for_user_ids?: string[] | null;
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
