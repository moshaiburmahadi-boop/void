import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Message, MessageReaction, Profile } from '../../types';
import {
  Search,
  Edit3,
  Send,
  ArrowLeft,
  CheckCircle2,
  Mail,
  Reply,
  MoreVertical,
  Trash2,
  EyeOff,
  X,
  CornerDownRight,
  Phone,
  PhoneCall,
  PhoneMissed,
  Video,
  VideoOff,
  Smile,
  Pencil,
  Check,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCall } from '../../context/CallContext';
import { dispatchPushNotification } from '../../utils/pushNotifications';
import { formatRelativeTime } from '../../utils/date';
import { dataCache } from '../../lib/dataCache';

const QUICK_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

export interface ConversationItem {
  partner: Profile;
  lastMessage: Message | null;
  isFollowed: boolean;
}

interface MessagesViewProps {
  initialPartner?: Profile | null;
  onUnreadChange?: (count: number) => void;
  onViewProfile?: (user: Profile) => void;
  onMobileChatToggle?: (isOpen: boolean) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  initialPartner,
  onViewProfile,
  onMobileChatToggle,
}) => {
  const { profile } = useAuth();
  const { isFollowing, followingMap, followedUserIds } = useFollow();
  const { startCall } = useCall();
  const [conversations, setConversations] = useState<ConversationItem[]>(() => {
    const cached = dataCache.getConversations();
    return cached ? cached.items : [];
  });
  const [activePartner, setActivePartner] = useState<Profile | null>(initialPartner || null);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialPartner?.id) {
      const cached = dataCache.getMessages(initialPartner.id);
      return cached ? cached.messages : [];
    }
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(Boolean(initialPartner));
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [followedUsers, setFollowedUsers] = useState<Profile[]>([]);
  const [isLoadingFollowedUsers, setIsLoadingFollowedUsers] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // Editing State
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Inform parent of mobile chat state for hiding/showing bottom nav
  useEffect(() => {
    onMobileChatToggle?.(showMobileChat);
  }, [showMobileChat, onMobileChatToggle]);

  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Action Menu State (opened popover for a message)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  // Emoji Picker Popover State
  const [activeEmojiMessageId, setActiveEmojiMessageId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const partnerTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPartnerTyping]);

  // Handle click outside to close message action menu & emoji picker
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuMessageId(null);
      setActiveEmojiMessageId(null);
    };
    if (activeMenuMessageId || activeEmojiMessageId) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [activeMenuMessageId, activeEmojiMessageId]);

  // If initialPartner changes from props, set active conversation
  useEffect(() => {
    if (initialPartner) {
      setActivePartner(initialPartner);
      setShowMobileChat(true);
      setConversations((prev) => {
        if (!prev.some((c) => c.partner.id === initialPartner.id)) {
          const isUserFollowed = Boolean(
            isFollowing(initialPartner.id) ||
            followingMap[initialPartner.id] ||
            followedUserIds.includes(initialPartner.id)
          );
          return [{ partner: initialPartner, lastMessage: null, isFollowed: isUserFollowed }, ...prev];
        }
        return prev;
      });
    }
  }, [initialPartner, isFollowing, followingMap, followedUserIds]);

  // Load existing profiles & conversations (Union of message history + all followed users)
  const fetchUsersAndConversations = useCallback(async () => {
    if (!profile) return;

    if (isSupabaseConfigured) {
      try {
        // 1. Fetch all messages involving current user to extract last message & active chat partners
        const { data: messagesData, error: msgErr } = await supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            receiver_id,
            content,
            message_type,
            call_status,
            call_type,
            duration_seconds,
            is_unsent,
            deleted_for_user_ids,
            created_at
          `)
          .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
          .order('created_at', { ascending: false });

        if (msgErr) {
          console.warn('Error fetching messages for conversations:', msgErr);
        }

        const lastMessageByPartner: Record<string, Message> = {};
        const partnerIdsWithHistory = new Set<string>();

        (messagesData || []).forEach((m: any) => {
          const isDeletedForMe =
            m.is_unsent ||
            (Array.isArray(m.deleted_for_user_ids) && m.deleted_for_user_ids.includes(profile.id));
          const partnerId = m.sender_id === profile.id ? m.receiver_id : m.sender_id;

          if (partnerId && partnerId !== profile.id) {
            if (!isDeletedForMe) {
              partnerIdsWithHistory.add(partnerId);
              if (!lastMessageByPartner[partnerId]) {
                lastMessageByPartner[partnerId] = m as Message;
              }
            }
          }
        });

        // 2. Fetch all users whom current logged-in user follows from public.follows
        const { data: followData, error: followErr } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', profile.id);

        if (followErr) {
          console.warn('Error fetching follows for conversations:', followErr);
        }

        const followedIdSet = new Set<string>(
          (followData || []).map((f: { following_id: string }) => f.following_id)
        );

        // Merge with optimistic followedUserIds / followingMap from FollowContext
        Object.keys(followingMap).forEach((id) => {
          if (followingMap[id] && id !== profile.id) {
            followedIdSet.add(id);
          } else if (followingMap[id] === false) {
            followedIdSet.delete(id);
          }
        });
        followedUserIds.forEach((id) => {
          if (id && id !== profile.id) followedIdSet.add(id);
        });

        // 3. UNION of:
        //    a) Users with direct message conversation history
        //    b) Users followed by currently authenticated user
        //    c) initialPartner if provided
        const allContactIds = new Set<string>([
          ...Array.from(partnerIdsWithHistory),
          ...Array.from(followedIdSet),
        ]);

        if (initialPartner?.id && initialPartner.id !== profile.id) {
          allContactIds.add(initialPartner.id);
        }

        if (allContactIds.size === 0) {
          setConversations([]);
          return;
        }

        // 4. Fetch profiles for all distinct contact IDs
        const { data: profilesData, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(allContactIds));

        if (profErr) {
          console.warn('Error fetching contact profiles:', profErr);
        }

        const profileMap = new Map<string, Profile>();
        (profilesData || []).forEach((p: Profile) => {
          profileMap.set(p.id, p);
        });

        if (initialPartner && !profileMap.has(initialPartner.id)) {
          profileMap.set(initialPartner.id, initialPartner);
        }

        // 5. Build ConversationItem list
        const items: ConversationItem[] = [];

        allContactIds.forEach((id) => {
          const partnerProfile = profileMap.get(id);
          if (partnerProfile) {
            const lastMsg = lastMessageByPartner[id] || null;
            const isUserFollowed = followedIdSet.has(id);
            items.push({
              partner: partnerProfile,
              lastMessage: lastMsg,
              isFollowed: isUserFollowed,
            });
          }
        });

        // 6. Sort items:
        //    - Recent active conversations first (DESC by last message timestamp)
        //    - Followed contacts with no messages sorted alphabetically by name
        items.sort((a, b) => {
          if (a.lastMessage && b.lastMessage) {
            return (
              new Date(b.lastMessage.created_at).getTime() -
              new Date(a.lastMessage.created_at).getTime()
            );
          }
          if (a.lastMessage && !b.lastMessage) return -1;
          if (!a.lastMessage && b.lastMessage) return 1;
          const nameA = (a.partner.display_name || a.partner.username || '').toLowerCase();
          const nameB = (b.partner.display_name || b.partner.username || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        setConversations(items);
        dataCache.setConversations(items);

        // Keep activePartner updated if already chosen
        setActivePartner((currentActive) => {
          if (currentActive) {
            const updated = profileMap.get(currentActive.id);
            return updated || currentActive;
          }
          return initialPartner || null;
        });
      } catch (err) {
        console.warn('Error fetching conversations and followed contacts:', err);
      }
    } else {
      // Fallback for offline/demo environment
      setConversations((prev) => {
        if (initialPartner && !prev.some((c) => c.partner.id === initialPartner.id)) {
          return [{ partner: initialPartner, lastMessage: null, isFollowed: true }, ...prev];
        }
        return prev;
      });
    }
  }, [profile?.id, followingMap, followedUserIds, initialPartner]);

  // Load conversations on mount & when follow state changes
  useEffect(() => {
    fetchUsersAndConversations();
  }, [fetchUsersAndConversations]);

  // Global Realtime Listener for new messages & follows
  useEffect(() => {
    if (!profile || !isSupabaseConfigured) return;

    const globalInboxChannel = supabase
      .channel(`global_inbox_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (!newMsg || newMsg.is_unsent) return;
          if (
            Array.isArray(newMsg.deleted_for_user_ids) &&
            newMsg.deleted_for_user_ids.includes(profile.id)
          ) {
            return;
          }

          const isRecipient = newMsg.receiver_id === profile.id;
          const isSender = newMsg.sender_id === profile.id;
          if (!isRecipient && !isSender) return;

          const partnerId = isSender ? newMsg.receiver_id : newMsg.sender_id;

          // Update conversation list last message and move partner to top
          setConversations((prev) => {
            const existing = prev.find((c) => c.partner.id === partnerId);
            if (existing) {
              const updated: ConversationItem = {
                ...existing,
                lastMessage: newMsg,
              };
              return [updated, ...prev.filter((c) => c.partner.id !== partnerId)];
            } else {
              // Partner not in current list -> refresh
              fetchUsersAndConversations();
              return prev;
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
        },
        () => {
          fetchUsersAndConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalInboxChannel);
    };
  }, [profile?.id, fetchUsersAndConversations]);

  // Fetch ONLY followed users when opening the "New Message" modal
  useEffect(() => {
    if (!isSearchingUser || !profile) return;

    const fetchFollowedUsersForPicker = async () => {
      setIsLoadingFollowedUsers(true);
      if (isSupabaseConfigured) {
        try {
          const { data: followData, error: followErr } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', profile.id);

          if (followErr) throw followErr;

          const followingIds = Array.from(
            new Set([
              ...(followData || []).map((f: { following_id: string }) => f.following_id),
              ...Object.keys(followingMap).filter((id) => followingMap[id] && id !== profile.id),
              ...followedUserIds.filter((id) => id !== profile.id),
            ])
          );

          if (followingIds.length === 0) {
            setFollowedUsers([]);
            setIsLoadingFollowedUsers(false);
            return;
          }

          const { data: followedProfiles, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .in('id', followingIds)
            .order('display_name', { ascending: true });

          if (profErr) throw profErr;

          setFollowedUsers((followedProfiles || []) as Profile[]);
        } catch (err) {
          console.warn('Error fetching followed users for chat picker:', err);
          const fallback = Object.keys(followingMap)
            .filter((id) => followingMap[id] && id !== profile.id)
            .map((id) => conversations.find((c) => c.partner.id === id)?.partner)
            .filter(Boolean) as Profile[];
          setFollowedUsers(fallback);
        } finally {
          setIsLoadingFollowedUsers(false);
        }
      } else {
        const localFollowed = conversations
          .filter((c) => c.isFollowed && c.partner.id !== profile.id)
          .map((c) => c.partner);
        setFollowedUsers(localFollowed);
        setIsLoadingFollowedUsers(false);
      }
    };

    fetchFollowedUsersForPicker();
  }, [isSearchingUser, profile?.id, followingMap, followedUserIds, conversations]);

  // Load message history & setup real-time broadcast and message listeners
  useEffect(() => {
    if (!profile || !activePartner) {
      setMessages([]);
      setIsPartnerTyping(false);
      return;
    }

    setIsPartnerTyping(false);
    setReplyingTo(null);

    // Render from cache immediately if available
    const cachedEntry = dataCache.getMessages(activePartner.id);
    if (cachedEntry) {
      setMessages(cachedEntry.messages);
    }

    if (isSupabaseConfigured) {
      const fetchHistory = async () => {
        try {
          const { data, error } = await supabase
            .from('messages')
            .select(`
              id,
              sender_id,
              receiver_id,
              content,
              reply_to_id,
              is_unsent,
              is_edited,
              deleted_for_user_ids,
              message_type,
              call_status,
              call_type,
              duration_seconds,
              created_at,
              sender_profile:sender_id(id, username, display_name, avatar_url, verified),
              receiver_profile:receiver_id(id, username, display_name, avatar_url, verified),
              reactions:message_reactions(*)
            `)
            .or(
              `and(sender_id.eq.${profile.id},receiver_id.eq.${activePartner.id}),and(sender_id.eq.${activePartner.id},receiver_id.eq.${profile.id})`
            )
            .order('created_at', { ascending: true })
            .limit(60);

          if (!error && data) {
            // Filter out messages marked unsent or deleted for current user
            const validMessages: Message[] = (data as unknown as any[])
              .filter((m) => {
                if (m.is_unsent) return false;
                if (Array.isArray(m.deleted_for_user_ids) && m.deleted_for_user_ids.includes(profile.id)) {
                  return false;
                }
                return true;
              })
              .map((m) => ({
                ...m,
                sender_profile: Array.isArray(m.sender_profile) ? m.sender_profile[0] : m.sender_profile,
                receiver_profile: Array.isArray(m.receiver_profile) ? m.receiver_profile[0] : m.receiver_profile,
                reactions: Array.isArray(m.reactions) ? m.reactions : [],
              }));

            // Resolve reply_to_message objects
            const msgMap = new Map<string, Message>();
            validMessages.forEach((m) => msgMap.set(m.id, m));

            const resolved = validMessages.map((m) => {
              if (m.reply_to_id && msgMap.has(m.reply_to_id)) {
                const target = msgMap.get(m.reply_to_id)!;
                return {
                  ...m,
                  reply_to_message: {
                    id: target.id,
                    content: target.content,
                    sender_id: target.sender_id,
                    sender_profile: target.sender_profile,
                  },
                };
              }
              return m;
            });

            setMessages(resolved);
            dataCache.setMessages(activePartner.id, resolved);
          }
        } catch (err) {
          console.warn('Could not fetch messages:', err);
        }
      };

      fetchHistory();

      // Deterministic sorted channel ID for 1-to-1 conversation
      const conversationId = [profile.id, activePartner.id].sort().join('_');
      const channel = supabase.channel(`chat_${conversationId}`);
      channelRef.current = channel;

      channel
        // Listen for new messages inserted in DB
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            const newMsg = payload.new as Message;
            const isRelevant =
              (newMsg.sender_id === activePartner.id && newMsg.receiver_id === profile.id) ||
              (newMsg.sender_id === profile.id && newMsg.receiver_id === activePartner.id);

            if (isRelevant) {
              if (newMsg.is_unsent) return;
              if (Array.isArray(newMsg.deleted_for_user_ids) && newMsg.deleted_for_user_ids.includes(profile.id)) {
                return;
              }

              // Hide typing indicator when new message arrives
              if (newMsg.sender_id === activePartner.id) {
                setIsPartnerTyping(false);
              }

              setMessages((prev) => {
                // Deduplicate by exact database ID
                if (prev.some((m) => m.id === newMsg.id)) {
                  return prev;
                }

                // If this is a reply, lookup the quoted message in current state
                let replyQuote: Message['reply_to_message'] = null;
                if (newMsg.reply_to_id) {
                  const found = prev.find((m) => m.id === newMsg.reply_to_id);
                  if (found) {
                    replyQuote = {
                      id: found.id,
                      content: found.content,
                      sender_id: found.sender_id,
                      sender_profile: found.sender_profile,
                    };
                  }
                }

                // Replace optimistic message if exists
                const tempIndex = prev.findIndex(
                  (m) =>
                    m.id.startsWith('temp_') &&
                    m.sender_id === newMsg.sender_id &&
                    m.receiver_id === newMsg.receiver_id &&
                    m.content === newMsg.content
                );

                if (tempIndex !== -1) {
                  const updated = [...prev];
                  updated[tempIndex] = {
                    ...newMsg,
                    reactions: updated[tempIndex].reactions || [],
                    sender_profile: newMsg.sender_id === profile.id ? profile : activePartner,
                    receiver_profile: newMsg.receiver_id === profile.id ? profile : activePartner,
                    reply_to_message: replyQuote || updated[tempIndex].reply_to_message,
                  };
                  return updated;
                }

                // New incoming message
                return [
                  ...prev,
                  {
                    ...newMsg,
                    reactions: [],
                    sender_profile: newMsg.sender_id === profile.id ? profile : activePartner,
                    receiver_profile: newMsg.receiver_id === profile.id ? profile : activePartner,
                    reply_to_message: replyQuote,
                  },
                ];
              });
            }
          }
        )
        // Listen for Realtime message deletions (Unsend / Delete for everyone)
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const deletedId = (payload.old as { id: string })?.id;
            if (deletedId) {
              setMessages((prev) => prev.filter((m) => m.id !== deletedId));
            }
          }
        )
        // Listen for Realtime message updates (e.g. is_unsent, is_edited, or deleted_for_user_ids)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const updated = payload.new as Message;
            if (updated.is_unsent || (Array.isArray(updated.deleted_for_user_ids) && updated.deleted_for_user_ids.includes(profile.id))) {
              setMessages((prev) => prev.filter((m) => m.id !== updated.id));
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === updated.id ? { ...m, ...updated, reactions: m.reactions || [] } : m))
              );
            }
          }
        )
        // Listen for Realtime message reaction inserts
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload) => {
            const newReaction = payload.new as MessageReaction;
            if (newReaction && newReaction.message_id) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== newReaction.message_id) return m;
                  const existing = m.reactions || [];
                  if (existing.some((r) => r.id === newReaction.id || (r.user_id === newReaction.user_id && r.emoji === newReaction.emoji))) {
                    return m;
                  }
                  return {
                    ...m,
                    reactions: [...existing, newReaction],
                  };
                })
              );
            }
          }
        )
        // Listen for Realtime message reaction deletes
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload) => {
            const oldReaction = payload.old as MessageReaction;
            if (oldReaction) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (!m.reactions || m.reactions.length === 0) return m;
                  const filtered = m.reactions.filter((r) => {
                    if (oldReaction.id && r.id) {
                      return r.id !== oldReaction.id;
                    }
                    if (oldReaction.message_id && oldReaction.user_id && oldReaction.emoji) {
                      return !(r.message_id === oldReaction.message_id && r.user_id === oldReaction.user_id && r.emoji === oldReaction.emoji);
                    }
                    return true;
                  });
                  return {
                    ...m,
                    reactions: filtered,
                  };
                })
              );
            }
          }
        )
        // Listen for realtime typing broadcast from partner
        .on('broadcast', { event: 'typing' }, (eventPayload) => {
          const { userId, isTyping } = eventPayload?.payload || {};
          if (userId === activePartner.id) {
            setIsPartnerTyping(Boolean(isTyping));

            if (partnerTypingTimeoutRef.current) {
              clearTimeout(partnerTypingTimeoutRef.current);
            }
            if (isTyping) {
              partnerTypingTimeoutRef.current = setTimeout(() => {
                setIsPartnerTyping(false);
              }, 2500);
            }
          }
        })
        .subscribe();

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        if (partnerTypingTimeoutRef.current) {
          clearTimeout(partnerTypingTimeoutRef.current);
        }
      };
    }
  }, [activePartner?.id, profile?.id]);

  // Call Handlers
  const handleStartCall = (type: 'audio' | 'video') => {
    if (!activePartner || !profile) return;
    startCall(activePartner, type);
  };

  // Emit typing broadcast event with 2s debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!profile || !activePartner || !channelRef.current) return;

    if (val.trim().length > 0) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, isTyping: true },
      });

      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }

      typingDebounceRef.current = setTimeout(() => {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: profile.id, isTyping: false },
          });
        }
      }, 2000);
    } else {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, isTyping: false },
      });
    }
  };

  // Feature: Initiate Message Editing (5-minute window)
  const handleInitiateEdit = (msg: Message) => {
    setActiveMenuMessageId(null);
    setReplyingTo(null);
    setEditingMessage(msg);
    setInputText(msg.content);
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 50);
  };

  // Cancel Message Editing
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  // Feature: Save Edited Message
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage || !inputText.trim() || !profile) return;

    const newContent = inputText.trim();
    const targetMsgId = editingMessage.id;
    setEditingMessage(null);
    setInputText('');

    // Optimistically update message in local state
    setMessages((prev) =>
      prev.map((m) => (m.id === targetMsgId ? { ...m, content: newContent, is_edited: true } : m))
    );

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('messages')
          .update({
            content: newContent,
            is_edited: true,
          })
          .eq('id', targetMsgId)
          .eq('sender_id', profile.id);

        if (error) {
          console.error('Error saving edited message:', error);
        }
      } catch (err) {
        console.error('Failed to update edited message:', err);
      }
    }
  };

  // Feature: Toggle Emoji Reaction
  const handleToggleReaction = async (msg: Message, emoji: string) => {
    if (!profile) return;
    setActiveEmojiMessageId(null);
    setActiveMenuMessageId(null);

    const existingReactions = msg.reactions || [];
    const hasReacted = existingReactions.some(
      (r) => r.user_id === profile.id && r.emoji === emoji
    );

    let updatedReactions: MessageReaction[];
    if (hasReacted) {
      updatedReactions = existingReactions.filter(
        (r) => !(r.user_id === profile.id && r.emoji === emoji)
      );
    } else {
      const optimisticReaction: MessageReaction = {
        id: `temp_react_${Date.now()}`,
        message_id: msg.id,
        user_id: profile.id,
        emoji,
      };
      updatedReactions = [...existingReactions, optimisticReaction];
    }

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, reactions: updatedReactions } : m))
    );

    if (isSupabaseConfigured) {
      try {
        if (hasReacted) {
          await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', msg.id)
            .eq('user_id', profile.id)
            .eq('emoji', emoji);
        } else {
          await supabase.from('message_reactions').insert({
            message_id: msg.id,
            user_id: profile.id,
            emoji,
          });
        }
      } catch (err) {
        console.error('Error toggling emoji reaction:', err);
      }
    }
  };

  // Feature 1: Trigger Reply to a message
  const handleInitiateReply = (targetMsg: Message) => {
    setReplyingTo(targetMsg);
    setActiveMenuMessageId(null);
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 50);
  };

  // Cancel Replying
  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  // Feature 2: Unsend Message (Delete for Everyone)
  const handleUnsendMessage = async (msg: Message) => {
    setActiveMenuMessageId(null);
    // Optimistically remove from state
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('messages').delete().eq('id', msg.id);
        if (error) {
          console.warn('Delete message error, falling back to update is_unsent:', error);
          await supabase.from('messages').update({ is_unsent: true }).eq('id', msg.id);
        }
      } catch (err) {
        console.error('Error unsending message:', err);
      }
    }
  };

  // Feature 3: Remove for Me (Delete for Me)
  const handleRemoveForMe = async (msg: Message) => {
    if (!profile) return;
    setActiveMenuMessageId(null);

    // Optimistically remove from current user's local state
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));

    if (isSupabaseConfigured) {
      try {
        // Fetch current deleted_for_user_ids and append current user's ID
        const existingDeleted = Array.isArray(msg.deleted_for_user_ids)
          ? msg.deleted_for_user_ids
          : [];
        const updatedDeleted = Array.from(new Set([...existingDeleted, profile.id]));

        await supabase
          .from('messages')
          .update({ deleted_for_user_ids: updatedDeleted })
          .eq('id', msg.id);
      } catch (err) {
        console.error('Error removing message for me:', err);
      }
    }
  };

  // Send Message (with reply support)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !profile || !activePartner) return;

    const content = inputText.trim();
    const replyTarget = replyingTo;
    setInputText('');
    setReplyingTo(null);

    // Immediately stop typing broadcast
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, isTyping: false },
      });
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: profile.id,
      receiver_id: activePartner.id,
      content,
      created_at: new Date().toISOString(),
      sender_profile: profile,
      receiver_profile: activePartner,
      reply_to_id: replyTarget ? replyTarget.id : null,
      reply_to_message: replyTarget
        ? {
            id: replyTarget.id,
            content: replyTarget.content,
            sender_id: replyTarget.sender_id,
            sender_profile: replyTarget.sender_profile,
          }
        : null,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    // Update conversation list locally & move active conversation to top
    setConversations((prev) => {
      const existingIdx = prev.findIndex((c) => c.partner.id === activePartner.id);
      const isUserFollowed = Boolean(
        isFollowing(activePartner.id) ||
        followingMap[activePartner.id] ||
        followedUserIds.includes(activePartner.id) ||
        (existingIdx >= 0 ? prev[existingIdx].isFollowed : false)
      );
      const updatedItem: ConversationItem = {
        partner: activePartner,
        lastMessage: optimisticMsg,
        isFollowed: isUserFollowed,
      };
      const rest = prev.filter((c) => c.partner.id !== activePartner.id);
      return [updatedItem, ...rest];
    });

    if (isSupabaseConfigured) {
      try {
        const payloadToInsert: any = {
          sender_id: profile.id,
          receiver_id: activePartner.id,
          content,
        };

        if (replyTarget?.id && !replyTarget.id.startsWith('temp_')) {
          payloadToInsert.reply_to_id = replyTarget.id;
        }

        const { data, error } = await supabase
          .from('messages')
          .insert(payloadToInsert)
          .select('*, sender_profile:sender_id(*), receiver_profile:receiver_id(*)')
          .single();

        if (!error && data) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...data,
                    sender_profile: profile,
                    receiver_profile: activePartner,
                    reply_to_message: optimisticMsg.reply_to_message,
                  }
                : m
            )
          );
        }

        // Dispatch background Web Push notification to recipient
        dispatchPushNotification({
          targetUserId: activePartner.id,
          type: 'message',
          title: profile.display_name || profile.username,
          body: content.length > 80 ? `${content.substring(0, 80)}...` : content,
          icon: profile.avatar_url || '/icon-192.png',
          tag: `msg_${profile.id}`,
          data: {
            type: 'message',
            senderId: profile.id,
            senderName: profile.display_name || profile.username,
            senderAvatar: profile.avatar_url,
            receiverId: activePartner.id,
            url: `/messages`,
          },
        });
      } catch (err) {
        console.warn('Failed to send message to Supabase:', err);
      }
    }
  };

  // Smooth scroll and highlight quoted message
  const handleScrollToMessage = (targetMsgId: string) => {
    const el = document.getElementById(`msg-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetMsgId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1500);
    }
  };

  const filteredConversations = conversations.filter((item) => {
    const user = item.partner;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      user.display_name?.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      (item.lastMessage?.content && item.lastMessage.content.toLowerCase().includes(q))
    );
  });

  return (
    <main className="w-full max-w-[990px] h-[100dvh] border-r border-neutral-800 flex overflow-hidden select-none">
      {/* Conversations Column */}
      <div
        className={`w-full md:w-[380px] border-r border-neutral-800 flex flex-col h-[100dvh] bg-black shrink-0 overflow-hidden ${
          showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Fixed / Frozen Sticky Header (Title + Search) */}
        <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-neutral-800 w-full flex-none">
          {/* Header Bar */}
          <div className="p-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#e5e2e1]">Messages</h1>
            <button
              onClick={() => setIsSearchingUser(true)}
              className="p-2 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b] transition-colors cursor-pointer"
              title="New Message"
            >
              <Edit3 className="w-5 h-5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#89919d]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Direct Messages"
                className="w-full bg-[#18181b] border border-transparent rounded-full py-2 pl-10 pr-4 text-xs text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#18181b]">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-[#89919d]">
              <p className="text-sm font-semibold text-[#e5e2e1] mb-1">
                {searchQuery.trim() ? 'No matches found' : 'No conversations'}
              </p>
              <p className="text-xs mb-4 text-[#89919d]">
                {searchQuery.trim()
                  ? `No direct messages or contacts matching "${searchQuery}"`
                  : 'Users you follow will automatically appear here so you can chat directly.'}
              </p>
              {!searchQuery.trim() && (
                <button
                  onClick={() => setIsSearchingUser(true)}
                  className="px-4 py-1.5 bg-[#1d9bf0] text-white text-xs font-bold rounded-full hover:bg-[#1a8cd8] cursor-pointer"
                >
                  New Message
                </button>
              )}
            </div>
          ) : (
            filteredConversations.map((item) => {
              const user = item.partner;
              const isSelected = activePartner?.id === user.id;
              const lastMsg = item.lastMessage;
              const isMe = lastMsg?.sender_id === profile?.id;

              // Format last message preview
              let previewText = 'Start a conversation';
              if (lastMsg) {
                if (lastMsg.message_type === 'call') {
                  const isMissed =
                    lastMsg.call_status === 'missed' ||
                    lastMsg.call_status === 'rejected' ||
                    lastMsg.call_status === 'declined' ||
                    lastMsg.call_status === 'failed';
                  const isVideo = lastMsg.call_type === 'video';
                  previewText = isMissed
                    ? isMe
                      ? 'Outgoing Missed Call'
                      : 'Missed Call'
                    : isVideo
                    ? 'Video Call'
                    : 'Voice Call';
                } else {
                  previewText = isMe ? `You: ${lastMsg.content}` : lastMsg.content;
                }
              }

              return (
                <div
                  key={user.id}
                  id={`conversation-item-${user.id}`}
                  onClick={() => {
                    setActivePartner(user);
                    setShowMobileChat(true);
                  }}
                  className={`p-3.5 sm:p-4 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#18181b]' : 'hover:bg-[#121212]'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={
                        user.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                      }
                      alt={user.username}
                      className="w-11 h-11 rounded-full object-cover border border-[#27272a]"
                    />
                    {item.isFollowed && !lastMsg && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#1d9bf0] rounded-full border-2 border-black flex items-center justify-center text-[8px] text-white font-bold"
                        title="Followed contact"
                      >
                        ✓
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-bold text-sm text-[#e5e2e1] truncate">
                          {user.display_name || user.username}
                        </span>
                        {user.verified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                        )}
                        <span className="text-xs text-[#89919d] truncate">@{user.username}</span>
                      </div>

                      {lastMsg && (
                        <span className="text-[11px] text-[#89919d] shrink-0 font-normal">
                          {formatRelativeTime(lastMsg.created_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate ${
                          lastMsg ? 'text-[#89919d]' : 'text-[#1d9bf0] font-medium'
                        }`}
                      >
                        {lastMsg ? previewText : 'Start a conversation'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Chat Conversation Pane */}
      <div
        className={`flex-1 flex flex-col h-[100dvh] bg-black overflow-hidden relative ${
          !showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activePartner ? (
          <>
            {/* Fixed / Frozen Chat Top Header */}
            <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-neutral-800 w-full flex-none p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b] cursor-pointer transition-colors"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div
                  onClick={() => onViewProfile && onViewProfile(activePartner)}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <img
                    src={
                      activePartner.avatar_url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                    }
                    alt={activePartner.username}
                    className="w-9 h-9 rounded-full object-cover border border-[#27272a]"
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm text-[#e5e2e1] group-hover:underline">
                        {activePartner.display_name || activePartner.username}
                      </span>
                      {activePartner.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
                      )}
                    </div>
                    <span className="text-xs text-[#89919d]">
                      {isPartnerTyping ? (
                        <span className="text-[#1d9bf0] font-medium animate-pulse">typing...</span>
                      ) : (
                        `@${activePartner.username}`
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Call Action Buttons (Audio & Video) */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => handleStartCall('audio')}
                  className="p-2 sm:p-2.5 text-[#89919d] hover:text-[#1d9bf0] hover:bg-[#18181b] rounded-full transition-colors cursor-pointer"
                  title="Start Audio Call"
                  aria-label="Start Audio Call"
                >
                  <Phone className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
                <button
                  onClick={() => handleStartCall('video')}
                  className="p-2 sm:p-2.5 text-[#89919d] hover:text-[#1d9bf0] hover:bg-[#18181b] rounded-full transition-colors cursor-pointer"
                  title="Start Video Call"
                  aria-label="Start Video Call"
                >
                  <Video className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              </div>
            </header>

            {/* Independent Scrollable Messages Body Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#89919d]">
                  <img
                    src={activePartner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                    alt={activePartner.username}
                    className="w-16 h-16 rounded-full object-cover border border-[#27272a] mb-3"
                  />
                  <h3 className="font-bold text-base text-[#e5e2e1]">
                    {activePartner.display_name || activePartner.username}
                  </h3>
                  <p className="text-xs mb-3">@{activePartner.username}</p>
                  <p className="text-xs max-w-xs">
                    Say hello to start the conversation! Swipe right on any message to reply, or swipe left on your own messages.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  // Custom Call Log Message Card Rendering
                  if (msg.message_type === 'call') {
                    const isMissed =
                      msg.call_status === 'missed' ||
                      msg.call_status === 'rejected' ||
                      msg.call_status === 'declined' ||
                      msg.call_status === 'failed' ||
                      msg.content?.toLowerCase().includes('missed');
                    const isVideo =
                      msg.call_type === 'video' || msg.content?.toLowerCase().includes('video');
                    const isMe = msg.sender_id === profile?.id;

                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className="my-3 flex flex-col items-center justify-center w-full select-none transition-all"
                      >
                        <div
                          className={`px-4 py-3 rounded-2xl border flex items-center gap-3.5 shadow-sm max-w-sm sm:max-w-md w-full sm:w-auto transition-all ${
                            isMissed
                              ? 'bg-[#181112]/95 border-red-500/30 text-[#fca5a5]'
                              : 'bg-[#18181b]/95 border-[#27272a] text-[#e5e2e1]'
                          }`}
                        >
                          {/* Call Icon Badge */}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                              isMissed
                                ? 'bg-red-500/15 border-red-500/40 text-red-400'
                                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                            }`}
                          >
                            {isVideo ? (
                              isMissed ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />
                            ) : (
                              isMissed ? <PhoneMissed className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />
                            )}
                          </div>

                          {/* Call Summary Info */}
                          <div className="flex-1 min-w-0 pr-1">
                            <p
                              className={`text-xs font-bold leading-tight truncate ${
                                isMissed ? 'text-red-400' : 'text-[#f4f4f5]'
                              }`}
                            >
                              {isMissed
                                ? isMe
                                  ? isVideo
                                    ? 'Outgoing Missed Video Call'
                                    : 'Outgoing Missed Audio Call'
                                  : isVideo
                                  ? 'Missed Video Call'
                                  : 'Missed Audio Call'
                                : msg.content || (isVideo ? 'Video Call' : 'Audio Call')}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#89919d] mt-0.5">
                              {isMissed ? (
                                <span>{isMe ? 'No answer' : 'Unanswered'}</span>
                              ) : msg.duration_seconds && msg.duration_seconds > 0 ? (
                                <span>
                                  {Math.floor(msg.duration_seconds / 60)}m{' '}
                                  {(msg.duration_seconds % 60).toString().padStart(2, '0')}s
                                </span>
                              ) : (
                                <span>{isVideo ? 'Video call' : 'Audio call'}</span>
                              )}
                              <span>•</span>
                              <span>{formatRelativeTime(msg.created_at)}</span>
                            </div>
                          </div>

                          {/* Call Back Button */}
                          {isMissed && (
                            <button
                              type="button"
                              onClick={() => handleStartCall(isVideo ? 'video' : 'audio')}
                              className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 active:scale-95 text-red-300 hover:text-white border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ml-auto"
                              title={`Call back with ${isVideo ? 'video' : 'audio'}`}
                            >
                              {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                              <span>Call Back</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const isMe = msg.sender_id === profile?.id;
                  const isHighlighted = highlightedMessageId === msg.id;
                  const isMenuOpen = activeMenuMessageId === msg.id;
                  const isEmojiOpen = activeEmojiMessageId === msg.id;

                  // Check if editable: sent by current user and within 5 minutes
                  const isEditable =
                    isMe &&
                    Date.now() - new Date(msg.created_at).getTime() <= 5 * 60 * 1000;

                  // Group reactions by emoji
                  const reactionGroups: { emoji: string; count: number; hasReacted: boolean }[] = [];
                  if (msg.reactions && msg.reactions.length > 0) {
                    const counts: { [emoji: string]: { count: number; hasReacted: boolean } } = {};
                    msg.reactions.forEach((r) => {
                      if (!counts[r.emoji]) {
                        counts[r.emoji] = { count: 0, hasReacted: false };
                      }
                      counts[r.emoji].count += 1;
                      if (r.user_id === profile?.id) {
                        counts[r.emoji].hasReacted = true;
                      }
                    });
                    Object.entries(counts).forEach(([emoji, data]) => {
                      reactionGroups.push({ emoji, count: data.count, hasReacted: data.hasReacted });
                    });
                  }

                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`relative group flex flex-col transition-all duration-300 ${
                        isMe ? 'items-end' : 'items-start'
                      } ${isHighlighted ? 'scale-[1.02]' : ''}`}
                    >
                      {/* Swipeable container with spring reset */}
                      <motion.div
                        drag="x"
                        dragSnapToOrigin={true}
                        dragConstraints={isMe ? { left: -80, right: 0 } : { left: 0, right: 80 }}
                        dragElastic={0.25}
                        dragTransition={{ bounceStiffness: 600, bounceDamping: 25 }}
                        onDragEnd={(_, info) => {
                          if (isMe && (info.offset.x < -35 || info.velocity.x < -150)) {
                            handleInitiateReply(msg);
                          } else if (!isMe && (info.offset.x > 35 || info.velocity.x > 150)) {
                            handleInitiateReply(msg);
                          }
                        }}
                        className={`relative flex items-center gap-2 max-w-[85%] sm:max-w-[75%] ${
                          isMe ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {/* Swipe Reply Icon Indicator (revealed on drag) */}
                        <div
                          className={`absolute ${
                            isMe ? '-right-6' : '-left-6'
                          } top-1/2 -translate-y-1/2 text-[#1d9bf0] opacity-70 pointer-events-none`}
                        >
                          <Reply className={`w-4 h-4 ${isMe ? 'scale-x-[-1]' : ''}`} />
                        </div>

                        {/* Message Bubble Container */}
                        <div
                          className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap transition-all shadow-sm ${
                            isMe
                              ? 'bg-[#1d9bf0] text-white rounded-br-none'
                              : 'bg-[#201f1f] text-[#e5e2e1] rounded-bl-none border border-[#2b2b2b]'
                          } ${isHighlighted ? 'ring-2 ring-[#1d9bf0] ring-offset-2 ring-offset-black' : ''}`}
                        >
                          {/* Render Quoted Reply Snippet if message is a reply */}
                          {msg.reply_to_message && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScrollToMessage(msg.reply_to_message!.id);
                              }}
                              className={`mb-2 p-2 rounded-lg text-xs cursor-pointer flex items-start gap-1.5 transition-all ${
                                isMe
                                  ? 'bg-white/15 text-white/90 border-l-2 border-white hover:bg-white/25'
                                  : 'bg-[#161616] text-[#a1a1aa] border-l-2 border-[#1d9bf0] hover:bg-[#27272a]'
                              }`}
                              title="Click to view quoted message"
                            >
                              <CornerDownRight className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" />
                              <div className="min-w-0 flex-1">
                                <span className="font-bold block truncate opacity-90 text-[11px]">
                                  {msg.reply_to_message.sender_id === profile?.id
                                    ? 'You'
                                    : msg.reply_to_message.sender_profile?.display_name ||
                                      activePartner.display_name ||
                                      activePartner.username}
                                </span>
                                <span className="line-clamp-1 opacity-80 text-[11px]">
                                  {msg.reply_to_message.content}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Message Text Content */}
                          <span>{msg.content}</span>

                          {/* Message Meta Info: Timestamp & (edited) badge */}
                          <div
                            className={`flex items-center gap-1.5 mt-1 text-[10px] select-none ${
                              isMe ? 'text-white/70 justify-end' : 'text-[#89919d] justify-start'
                            }`}
                          >
                            <span>{formatRelativeTime(msg.created_at)}</span>
                            {msg.is_edited && (
                              <span className="italic opacity-80" title="Message has been edited">
                                (edited)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Desktop Action Controls (Emoji Reaction, Hover Reply & 3-Dots Menu) */}
                        <div
                          className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 ${
                            isMenuOpen || isEmojiOpen ? 'opacity-100' : ''
                          }`}
                        >
                          {/* Quick Emoji Reaction Trigger */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveEmojiMessageId(isEmojiOpen ? null : msg.id);
                                setActiveMenuMessageId(null);
                              }}
                              className="p-1.5 text-[#89919d] hover:text-[#1d9bf0] hover:bg-[#18181b] rounded-full transition-colors cursor-pointer"
                              title="React with emoji"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>

                            {/* Floating Quick Emoji Picker Bar */}
                            <AnimatePresence>
                              {isEmojiOpen && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: 6 }}
                                  transition={{ duration: 0.12 }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`absolute z-30 flex items-center gap-1 bg-[#1c1c1f] border border-[#2e2e33] rounded-full px-2 py-1 shadow-2xl ${
                                    isMe ? 'right-0 -top-9' : 'left-0 -top-9'
                                  }`}
                                >
                                  {QUICK_EMOJIS.map((emoji) => {
                                    const isSelected = msg.reactions?.some(
                                      (r) => r.user_id === profile?.id && r.emoji === emoji
                                    );
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleToggleReaction(msg, emoji)}
                                        className={`p-1 text-sm hover:scale-125 transition-transform cursor-pointer rounded-full ${
                                          isSelected ? 'bg-[#1d9bf0]/20' : 'hover:bg-white/10'
                                        }`}
                                        title={`React ${emoji}`}
                                      >
                                        {emoji}
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Desktop Quick Reply Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInitiateReply(msg);
                            }}
                            className="p-1.5 text-[#89919d] hover:text-[#1d9bf0] hover:bg-[#18181b] rounded-full transition-colors cursor-pointer"
                            title="Reply to message"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>

                          {/* 3-Dots Context Menu Trigger */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuMessageId(isMenuOpen ? null : msg.id);
                                setActiveEmojiMessageId(null);
                              }}
                              className="p-1.5 text-[#89919d] hover:text-white hover:bg-[#18181b] rounded-full transition-colors cursor-pointer"
                              title="Message options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Action Popover Menu */}
                            <AnimatePresence>
                              {isMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                                  transition={{ duration: 0.12 }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`absolute z-30 w-44 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl py-1.5 overflow-hidden text-xs ${
                                    isMe ? 'right-0 top-7' : 'left-0 top-7'
                                  }`}
                                >
                                  {/* Feature 1: Edit Option (Show ONLY if sender and within 5 minutes) */}
                                  {isEditable && (
                                    <button
                                      onClick={() => handleInitiateEdit(msg)}
                                      className="w-full px-3.5 py-2 flex items-center gap-2.5 text-[#e5e2e1] hover:bg-[#27272a] transition-colors cursor-pointer font-medium"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-[#1d9bf0]" />
                                      <span>Edit</span>
                                    </button>
                                  )}

                                  {/* Action: Reply */}
                                  <button
                                    onClick={() => handleInitiateReply(msg)}
                                    className="w-full px-3.5 py-2 flex items-center gap-2.5 text-[#e5e2e1] hover:bg-[#27272a] transition-colors cursor-pointer font-medium"
                                  >
                                    <Reply className="w-3.5 h-3.5 text-[#1d9bf0]" />
                                    <span>Reply</span>
                                  </button>

                                  {/* Feature 3: Remove for Me (Available on ANY message) */}
                                  <button
                                    onClick={() => handleRemoveForMe(msg)}
                                    className="w-full px-3.5 py-2 flex items-center gap-2.5 text-[#89919d] hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer font-medium"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>Delete for me</span>
                                  </button>

                                  {/* Feature 2: Unsend Message (Sent by current user only) */}
                                  {isMe && (
                                    <button
                                      onClick={() => handleUnsendMessage(msg)}
                                      className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-500 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer font-medium border-t border-[#27272a]/60 mt-1 pt-2"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                      <span>Unsend for everyone</span>
                                    </button>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </motion.div>

                      {/* Emoji Reaction Chips / Pills attached to bottom of bubble */}
                      {reactionGroups.length > 0 && (
                        <div
                          className={`flex flex-wrap items-center gap-1.5 mt-1 ${
                            isMe ? 'justify-end pr-1' : 'justify-start pl-1'
                          }`}
                        >
                          {reactionGroups.map(({ emoji, count, hasReacted }) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(msg, emoji)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer border ${
                                hasReacted
                                  ? 'bg-[#1d9bf0]/20 border-[#1d9bf0]/60 text-[#1d9bf0]'
                                  : 'bg-[#18181b] border-[#27272a] text-[#89919d] hover:border-[#3f3f46]'
                              }`}
                              title={hasReacted ? 'Click to remove reaction' : `Click to react ${emoji}`}
                            >
                              <span>{emoji}</span>
                              <span className="font-semibold text-[11px]">{count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Real-time 3-Dot Typing Indicator Bubble */}
              {isPartnerTyping && (
                <div className="flex items-end gap-2 my-2 animate-fade-in">
                  <img
                    src={
                      activePartner.avatar_url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                    }
                    alt={activePartner.username}
                    className="w-7 h-7 rounded-full object-cover border border-[#27272a] shrink-0 mb-1"
                  />
                  <div className="bg-[#1e1e24] text-neutral-300 rounded-full px-4 py-2 flex items-center gap-1.5 shadow-sm border border-[#27272a]">
                    <span className="w-2 h-2 bg-[#1d9bf0] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-[#1d9bf0] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-[#1d9bf0] rounded-full animate-bounce" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Fixed Bottom Message Input Bar & Replying / Editing Context */}
            <div className="sticky bottom-0 z-30 bg-black border-t border-neutral-800 flex-none w-full">
              {/* Editing Context Bar */}
              <AnimatePresence>
                {editingMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-4 py-2.5 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-3">
                      <div className="w-1 h-8 rounded-full bg-[#1d9bf0] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-[#1d9bf0] truncate flex items-center gap-1.5">
                          <Pencil className="w-3 h-3 text-[#1d9bf0]" />
                          <span>Editing message</span>
                        </p>
                        <p className="text-[#89919d] truncate text-[11px]">
                          {editingMessage.content}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1 text-xs text-[#89919d] hover:text-white hover:bg-[#27272a] rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Replying Context Bar */}
              <AnimatePresence>
                {replyingTo && !editingMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-4 py-2.5 bg-[#141416] border-b border-[#201f1f] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-3">
                      <div className="w-1 h-8 rounded-full bg-[#1d9bf0] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-[#e5e2e1] truncate flex items-center gap-1">
                          <Reply className="w-3 h-3 text-[#1d9bf0]" />
                          <span>
                            Replying to{' '}
                            {replyingTo.sender_id === profile?.id
                              ? 'yourself'
                              : replyingTo.sender_profile?.display_name ||
                                activePartner.display_name ||
                                `@${activePartner.username}`}
                          </span>
                        </p>
                        <p className="text-[#89919d] truncate text-[11px]">
                          {replyingTo.content}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleCancelReply}
                      className="p-1 text-[#89919d] hover:text-white hover:bg-[#27272a] rounded-full transition-colors cursor-pointer shrink-0"
                      title="Cancel reply"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Composer Form */}
              <form
                onSubmit={editingMessage ? handleSaveEdit : handleSendMessage}
                className="p-3 flex items-center gap-2"
              >
                <input
                  ref={messageInputRef}
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder={
                    editingMessage
                      ? 'Edit message content...'
                      : replyingTo
                      ? 'Type your reply...'
                      : 'Start a new message...'
                  }
                  className="flex-1 bg-[#18181b] border border-transparent rounded-full px-4 py-2.5 text-sm text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className={`p-2.5 text-white rounded-full transition-all disabled:opacity-30 cursor-pointer shadow-md active:scale-95 shrink-0 flex items-center justify-center ${
                    editingMessage ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-[#1d9bf0] hover:bg-[#1a8cd8]'
                  }`}
                  aria-label={editingMessage ? 'Save edit' : 'Send message'}
                  title={editingMessage ? 'Save Changes' : 'Send'}
                >
                  {editingMessage ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#89919d]">
            <div className="w-16 h-16 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 text-[#1d9bf0]" />
            </div>
            <h2 className="text-xl font-bold text-[#e5e2e1] mb-2">Select a message</h2>
            <p className="text-sm max-w-sm text-[#89919d]">
              Choose from your existing conversations, start a new one, or connect with members on Void.
            </p>
          </div>
        )}
      </div>

      {/* New Conversation Picker Modal */}
      {isSearchingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#121212] border border-[#27272a] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#201f1f] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#e5e2e1]">New message</h3>
              <button
                onClick={() => {
                  setIsSearchingUser(false);
                  setPickerSearchQuery('');
                }}
                className="text-xs text-[#1d9bf0] font-bold cursor-pointer hover:underline"
              >
                Close
              </button>
            </div>

            {/* Search Input for Followed Users */}
            <div className="p-3 border-b border-[#201f1f] bg-[#161618]">
              <div className="flex items-center gap-2 bg-[#1f1f23] rounded-xl px-3 py-2 border border-[#2e2e34] focus-within:border-[#1d9bf0] transition-colors">
                <Search className="w-4 h-4 text-[#89919d] shrink-0" />
                <input
                  type="text"
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  placeholder="Search people you follow..."
                  className="w-full bg-transparent text-xs text-[#e5e2e1] placeholder-[#89919d] outline-none"
                  autoFocus
                />
                {pickerSearchQuery && (
                  <button
                    onClick={() => setPickerSearchQuery('')}
                    className="text-[#89919d] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List of Followed Users */}
            <div className="p-3 overflow-y-auto max-h-80 divide-y divide-[#18181b]">
              {isLoadingFollowedUsers ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#89919d]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#1d9bf0]" />
                  <p className="text-xs">Loading people you follow...</p>
                </div>
              ) : followedUsers.length === 0 ? (
                <div className="p-6 text-center text-[#89919d]">
                  <UserPlus className="w-8 h-8 text-[#89919d]/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[#e5e2e1] mb-1">No followed users found</p>
                  <p className="text-[11px] leading-relaxed text-[#89919d]">
                    Follow other profiles first to start direct conversations with them.
                  </p>
                </div>
              ) : (
                (() => {
                  const filtered = followedUsers.filter(
                    (u) =>
                      u.display_name?.toLowerCase().includes(pickerSearchQuery.toLowerCase()) ||
                      u.username.toLowerCase().includes(pickerSearchQuery.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <p className="text-xs text-[#89919d] text-center py-6">
                        No matches found for "{pickerSearchQuery}".
                      </p>
                    );
                  }

                  return filtered.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setActivePartner(u);
                        setConversations((prev) => {
                          if (!prev.some((c) => c.partner.id === u.id)) {
                            return [{ partner: u, lastMessage: null, isFollowed: true }, ...prev];
                          }
                          return prev;
                        });
                        setIsSearchingUser(false);
                        setPickerSearchQuery('');
                        setShowMobileChat(true);
                      }}
                      className="py-2.5 flex items-center gap-3 cursor-pointer hover:bg-[#18181b] px-3 rounded-xl transition-colors"
                    >
                      <img
                        src={
                          u.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                        }
                        alt={u.username}
                        className="w-10 h-10 rounded-full object-cover border border-[#27272a] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#e5e2e1] truncate">
                          {u.display_name || u.username}
                        </p>
                        <p className="text-xs text-[#89919d] truncate">@{u.username}</p>
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
