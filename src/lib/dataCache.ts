import { Post, Profile, Message, Notification } from '../types';

export interface ConversationCacheItem {
  partner: Profile;
  lastMessage: Message | null;
  isFollowed: boolean;
}

interface MessagesCacheEntry {
  messages: Message[];
  hasMore: boolean;
  lastFetched: number;
}

class VoidDataCache {
  // 1. Feed posts cache
  private feedPosts: Post[] | null = null;
  private feedLastFetched: number = 0;

  // 2. Conversations cache
  private conversations: ConversationCacheItem[] | null = null;
  private conversationsLastFetched: number = 0;

  // 3. Message history cache keyed by partner ID
  private messageHistories: Map<string, MessagesCacheEntry> = new Map();

  // 4. Notifications cache
  private notifications: Notification[] | null = null;
  private notificationsLastFetched: number = 0;

  // 5. Profiles cache keyed by user ID
  private profilesMap: Map<string, Profile> = new Map();

  // 6. Follow stats cache keyed by user ID
  private followStatsMap: Map<string, { followers: number; following: number; lastFetched: number }> = new Map();

  // 7. Recommended members cache (RightSidebar & Explore)
  private recommendedMembers: Profile[] | null = null;
  private recommendedLastFetched: number = 0;

  // TTL constants (milliseconds)
  private readonly FEED_TTL = 60 * 1000; // 1 min before background revalidate
  private readonly CONVERSATIONS_TTL = 45 * 1000;
  private readonly NOTIFICATIONS_TTL = 30 * 1000;
  private readonly RECOMMENDED_TTL = 5 * 60 * 1000;

  // ================= FEED CACHE =================
  getFeed(): { posts: Post[]; isStale: boolean } | null {
    if (!this.feedPosts) return null;
    const isStale = Date.now() - this.feedLastFetched > this.FEED_TTL;
    return { posts: this.feedPosts, isStale };
  }

  setFeed(posts: Post[]) {
    this.feedPosts = posts;
    this.feedLastFetched = Date.now();
  }

  prependFeedPost(post: Post) {
    if (!this.feedPosts) {
      this.feedPosts = [post];
    } else {
      if (!this.feedPosts.some((p) => p.id === post.id)) {
        this.feedPosts = [post, ...this.feedPosts];
      }
    }
  }

  updateFeedPost(updatedPost: Post) {
    if (!this.feedPosts) return;
    this.feedPosts = this.feedPosts.map((p) => (p.id === updatedPost.id ? updatedPost : p));
  }

  deleteFeedPost(postId: string) {
    if (!this.feedPosts) return;
    this.feedPosts = this.feedPosts.filter((p) => p.id !== postId);
  }

  // ================= CONVERSATIONS CACHE =================
  getConversations(): { items: ConversationCacheItem[]; isStale: boolean } | null {
    if (!this.conversations) return null;
    const isStale = Date.now() - this.conversationsLastFetched > this.CONVERSATIONS_TTL;
    return { items: this.conversations, isStale };
  }

  setConversations(items: ConversationCacheItem[]) {
    this.conversations = items;
    this.conversationsLastFetched = Date.now();
    // Also cache partner profiles
    items.forEach((item) => {
      if (item.partner?.id) {
        this.setProfile(item.partner);
      }
    });
  }

  updateConversationMessage(newMsg: Message, currentUserId: string) {
    if (!this.conversations) return;
    const partnerId = newMsg.sender_id === currentUserId ? newMsg.receiver_id : newMsg.sender_id;
    const existingIndex = this.conversations.findIndex((c) => c.partner.id === partnerId);

    if (existingIndex !== -1) {
      const existing = this.conversations[existingIndex];
      const updated: ConversationCacheItem = {
        ...existing,
        lastMessage: newMsg,
      };
      const rest = this.conversations.filter((_, idx) => idx !== existingIndex);
      this.conversations = [updated, ...rest];
    }
  }

  // ================= MESSAGES HISTORY CACHE =================
  getMessages(partnerId: string): { messages: Message[]; hasMore: boolean } | null {
    const entry = this.messageHistories.get(partnerId);
    if (!entry) return null;
    return { messages: entry.messages, hasMore: entry.hasMore };
  }

  setMessages(partnerId: string, messages: Message[], hasMore: boolean = false) {
    this.messageHistories.set(partnerId, {
      messages,
      hasMore,
      lastFetched: Date.now(),
    });
  }

  appendMessage(partnerId: string, message: Message) {
    const entry = this.messageHistories.get(partnerId);
    if (entry) {
      if (!entry.messages.some((m) => m.id === message.id)) {
        entry.messages = [...entry.messages, message];
      }
    } else {
      this.messageHistories.set(partnerId, {
        messages: [message],
        hasMore: false,
        lastFetched: Date.now(),
      });
    }
  }

  updateMessage(partnerId: string, updatedMessage: Message) {
    const entry = this.messageHistories.get(partnerId);
    if (entry) {
      entry.messages = entry.messages.map((m) => (m.id === updatedMessage.id ? updatedMessage : m));
    }
  }

  removeMessage(partnerId: string, messageId: string) {
    const entry = this.messageHistories.get(partnerId);
    if (entry) {
      entry.messages = entry.messages.filter((m) => m.id !== messageId);
    }
  }

  // ================= NOTIFICATIONS CACHE =================
  getNotifications(): { notifications: Notification[]; isStale: boolean } | null {
    if (!this.notifications) return null;
    const isStale = Date.now() - this.notificationsLastFetched > this.NOTIFICATIONS_TTL;
    return { notifications: this.notifications, isStale };
  }

  setNotifications(notifications: Notification[]) {
    this.notifications = notifications;
    this.notificationsLastFetched = Date.now();
    notifications.forEach((n) => {
      if (n.actor_profile?.id) {
        this.setProfile(n.actor_profile);
      }
    });
  }

  prependNotification(notification: Notification) {
    if (!this.notifications) {
      this.notifications = [notification];
    } else {
      if (!this.notifications.some((n) => n.id === notification.id)) {
        this.notifications = [notification, ...this.notifications];
      }
    }
    if (notification.actor_profile?.id) {
      this.setProfile(notification.actor_profile);
    }
  }

  // ================= PROFILES CACHE =================
  getProfile(userId: string): Profile | null {
    return this.profilesMap.get(userId) || null;
  }

  setProfile(profile: Profile) {
    if (profile?.id) {
      this.profilesMap.set(profile.id, profile);
    }
  }

  // ================= RECOMMENDED MEMBERS CACHE =================
  getRecommendedMembers(): Profile[] | null {
    if (!this.recommendedMembers) return null;
    if (Date.now() - this.recommendedLastFetched > this.RECOMMENDED_TTL) return null;
    return this.recommendedMembers;
  }

  setRecommendedMembers(members: Profile[]) {
    this.recommendedMembers = members;
    this.recommendedLastFetched = Date.now();
    members.forEach((m) => this.setProfile(m));
  }

  // Clear all caches on sign out
  clear() {
    this.feedPosts = null;
    this.conversations = null;
    this.messageHistories.clear();
    this.notifications = null;
    this.profilesMap.clear();
    this.followStatsMap.clear();
    this.recommendedMembers = null;
  }
}

export const dataCache = new VoidDataCache();
