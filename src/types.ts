export type BirthdayVisibility = 'public' | 'followers' | 'only_me';
export type BirthdayDisplay = 'full' | 'month_day' | 'age' | 'hidden';
export type GenderOption = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'custom';
export type GenderVisibility = 'public' | 'followers' | 'only_me';

export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  created_at: string;
  verified?: boolean;
  follower_count?: number;
  following_count?: number;
  // Extended profile fields
  date_of_birth?: string | null;
  birthday_visibility?: BirthdayVisibility | null;
  birthday_display?: BirthdayDisplay | null;
  gender?: GenderOption | string | null;
  gender_custom?: string | null;
  gender_visibility?: GenderVisibility | null;
  occupation?: string | null;
  education?: string | null;
  interests?: string[] | null;
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

export interface MessageReaction {
  id?: string;
  message_id: string;
  user_id: string;
  emoji: string;
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
  is_edited?: boolean;
  reactions?: MessageReaction[];
  deleted_for_user_ids?: string[] | null;
  message_type?: 'text' | 'call' | 'image' | string;
  call_status?: 'missed' | 'completed' | 'declined' | 'rejected' | 'failed' | string;
  call_type?: 'audio' | 'video';
  duration_seconds?: number | null;
}

export type NotificationType =
  | 'like'
  | 'repost'
  | 'follow'
  | 'mention'
  | 'avatar_update'
  | 'cover_update'
  | 'missed_audio_call'
  | 'missed_video_call'
  | 'missed_call';

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

export type CallSessionStatus =
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'active'
  | 'accepted'
  | 'rejected'
  | 'ended'
  | 'missed'
  | 'cancelled'
  | 'failed';

export interface CallSession {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'audio' | 'video';
  status: CallSessionStatus;
  offer?: any;
  answer?: any;
  duration_seconds?: number | null;
  created_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
  updated_at?: string;
  caller_profile?: Profile | null;
  receiver_profile?: Profile | null;
}

export interface PushSubscriptionRecord {
  id?: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PushNotificationPayload {
  type: 'message' | 'incoming_call' | 'social' | 'call_rejected' | 'call_ended';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data: {
    type: 'message' | 'incoming_call' | 'social' | 'call_rejected' | 'call_ended';
    senderId?: string;
    senderName?: string;
    senderAvatar?: string;
    receiverId?: string;
    conversationId?: string;
    callId?: string;
    callType?: 'audio' | 'video';
    offer?: any;
    notificationId?: string;
    url: string;
    timestamp?: number;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  renotify?: boolean;
  vibrate?: number[];
  silent?: boolean;
}
