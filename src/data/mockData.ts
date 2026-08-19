import { Post, Profile, Message, Notification } from '../types';

export const CURRENT_USER: Profile = {
  id: 'user_default',
  username: 'user',
  display_name: 'User',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  bio: '',
  website: '',
  location: '',
  created_at: new Date().toISOString(),
  verified: false,
};

export const OTHER_USERS: Record<string, Profile> = {};

export const INITIAL_POSTS: Post[] = [];

export const INITIAL_MESSAGES: Message[] = [];

export const INITIAL_NOTIFICATIONS: Notification[] = [];

export const TRENDING_TOPICS: { category: string; topic: string; posts: string }[] = [];

export const WHO_TO_FOLLOW: { id: string; name: string; handle: string; avatar: string }[] = [];
