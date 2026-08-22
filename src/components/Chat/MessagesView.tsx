import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Message, Profile } from '../../types';
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
  Video,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CallModal } from './CallModal';
import { IncomingCallModal } from './IncomingCallModal';

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
  const [conversations, setConversations] = useState<Profile[]>([]);
  const [activePartner, setActivePartner] = useState<Profile | null>(initialPartner || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(Boolean(initialPartner));
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // 1-on-1 Call State
  const [activeCall, setActiveCall] = useState<{
    isCaller: boolean;
    callType: 'audio' | 'video';
    remoteUser: Profile;
    incomingOffer?: any;
    callId?: string;
  } | null>(null);

  const [incomingCall, setIncomingCall] = useState<{
    caller: Profile;
    callType: 'audio' | 'video';
    offer: any;
    callId: string;
  } | null>(null);

  // Inform parent of mobile chat state for hiding/showing bottom nav
  useEffect(() => {
    onMobileChatToggle?.(showMobileChat);
  }, [showMobileChat, onMobileChatToggle]);

  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Action Menu State (opened popover for a message)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
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

  // Handle click outside to close message action menu
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuMessageId(null);
    };
    if (activeMenuMessageId) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [activeMenuMessageId]);

  // If initialPartner changes from props, set active conversation
  useEffect(() => {
    if (initialPartner) {
      setActivePartner(initialPartner);
      setShowMobileChat(true);
      setConversations((prev) => {
        if (!prev.some((p) => p.id === initialPartner.id)) {
          return [initialPartner, ...prev];
        }
        return prev;
      });
    }
  }, [initialPartner]);

  // Load existing profiles / conversations
  useEffect(() => {
    if (!profile) return;

    const fetchUsersAndConversations = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .neq('id', profile.id)
            .limit(30);

          if (profilesData && profilesData.length > 0) {
            setAllUsers(profilesData as Profile[]);
            setConversations((prev) => {
              const combined = [...prev];
              profilesData.forEach((p) => {
                if (!combined.some((c) => c.id === p.id)) {
                  combined.push(p as Profile);
                }
              });
              return combined;
            });

            if (!activePartner && !initialPartner && profilesData.length > 0) {
              setActivePartner(profilesData[0] as Profile);
            }
          }
        } catch (err) {
          console.warn('Error fetching profiles for chat:', err);
        }
      }
    };

    fetchUsersAndConversations();
  }, [profile?.id]);

  // Load message history & setup real-time broadcast and message listeners
  useEffect(() => {
    if (!profile || !activePartner) {
      setMessages([]);
      setIsPartnerTyping(false);
      return;
    }

    setIsPartnerTyping(false);
    setReplyingTo(null);

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
              deleted_for_user_ids,
              created_at,
              sender_profile:sender_id(*),
              receiver_profile:receiver_id(*)
            `)
            .or(
              `and(sender_id.eq.${profile.id},receiver_id.eq.${activePartner.id}),and(sender_id.eq.${activePartner.id},receiver_id.eq.${profile.id})`
            )
            .order('created_at', { ascending: true });

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
        // Listen for Realtime message updates (e.g. is_unsent or deleted_for_user_ids)
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
                prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
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

  // Global listener for incoming calls targeting current user
  useEffect(() => {
    if (!profile?.id || !isSupabaseConfigured) return;

    const myCallChannel = supabase.channel(`call_room_${profile.id}`);

    myCallChannel
      .on('broadcast', { event: 'call-request' }, (payload) => {
        const { senderProfile, callType, offer, callId } = payload?.payload || {};
        if (senderProfile && offer && callId) {
          // If already in call, auto-reject with busy
          if (activeCall) {
            const rejectChannel = supabase.channel(`call_room_${senderProfile.id}`);
            rejectChannel.send({
              type: 'broadcast',
              event: 'call-rejected',
              payload: { callId },
            });
            return;
          }

          setIncomingCall({
            caller: senderProfile,
            callType: callType || 'video',
            offer,
            callId,
          });
        }
      })
      .on('broadcast', { event: 'call-ended' }, (payload) => {
        const { callId } = payload?.payload || {};
        if (incomingCall && incomingCall.callId === callId) {
          setIncomingCall(null);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(myCallChannel);
    };
  }, [profile?.id, activeCall, incomingCall]);

  // Call Handlers
  const handleStartCall = (type: 'audio' | 'video') => {
    if (!activePartner || !profile) return;
    setActiveCall({
      isCaller: true,
      callType: type,
      remoteUser: activePartner,
    });
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall || !profile) return;
    setActiveCall({
      isCaller: false,
      callType: incomingCall.callType,
      remoteUser: incomingCall.caller,
      incomingOffer: incomingCall.offer,
      callId: incomingCall.callId,
    });
    setIncomingCall(null);
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;
    const targetChannel = supabase.channel(`call_room_${incomingCall.caller.id}`);
    targetChannel.send({
      type: 'broadcast',
      event: 'call-rejected',
      payload: { callId: incomingCall.callId },
    });
    setIncomingCall(null);
  };

  const handleEndActiveCall = () => {
    setActiveCall(null);
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

  const filteredConversations = conversations.filter(
    (c) =>
      c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <p className="text-sm font-semibold text-[#e5e2e1] mb-1">No conversations</p>
              <p className="text-xs mb-4">Start messaging any registered user on Void!</p>
              <button
                onClick={() => setIsSearchingUser(true)}
                className="px-4 py-1.5 bg-[#1d9bf0] text-white text-xs font-bold rounded-full hover:bg-[#1a8cd8] cursor-pointer"
              >
                Start Conversation
              </button>
            </div>
          ) : (
            filteredConversations.map((user) => {
              const isSelected = activePartner?.id === user.id;
              return (
                <div
                  key={user.id}
                  onClick={() => {
                    setActivePartner(user);
                    setShowMobileChat(true);
                  }}
                  className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#18181b]' : 'hover:bg-[#121212]'
                  }`}
                >
                  <img
                    src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                    alt={user.username}
                    className="w-11 h-11 rounded-full object-cover border border-[#27272a] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm text-[#e5e2e1] truncate">
                        {user.display_name || user.username}
                      </span>
                      {user.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-[#89919d] truncate">@{user.username}</span>
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
                  const isMe = msg.sender_id === profile?.id;
                  const isHighlighted = highlightedMessageId === msg.id;
                  const isMenuOpen = activeMenuMessageId === msg.id;

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
                        </div>

                        {/* Desktop Action Controls (Hover Reply & 3-Dots Menu) */}
                        <div
                          className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 ${
                            isMenuOpen ? 'opacity-100' : ''
                          }`}
                        >
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

            {/* Fixed Bottom Message Input Bar & Replying Context */}
            <div className="sticky bottom-0 z-30 bg-black border-t border-neutral-800 flex-none w-full">
              {/* Replying Context Bar */}
              <AnimatePresence>
                {replyingTo && (
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
                onSubmit={handleSendMessage}
                className="p-3 flex items-center gap-2"
              >
                <input
                  ref={messageInputRef}
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder={replyingTo ? 'Type your reply...' : 'Start a new message...'}
                  className="flex-1 bg-[#18181b] border border-transparent rounded-full px-4 py-2.5 text-sm text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-full transition-all disabled:opacity-30 cursor-pointer shadow-md active:scale-95 shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
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
                onClick={() => setIsSearchingUser(false)}
                className="text-xs text-[#1d9bf0] font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-80 divide-y divide-[#18181b]">
              {allUsers.length === 0 ? (
                <p className="text-xs text-[#89919d] text-center py-6">
                  No other users registered yet.
                </p>
              ) : (
                allUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setActivePartner(u);
                      if (!conversations.some((c) => c.id === u.id)) {
                        setConversations((prev) => [u, ...prev]);
                      }
                      setIsSearchingUser(false);
                      setShowMobileChat(true);
                    }}
                    className="py-3 flex items-center gap-3 cursor-pointer hover:bg-[#18181b] px-2 rounded-xl"
                  >
                    <img
                      src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                      alt={u.username}
                      className="w-10 h-10 rounded-full object-cover border border-[#27272a]"
                    />
                    <div>
                      <p className="text-sm font-bold text-[#e5e2e1]">{u.display_name || u.username}</p>
                      <p className="text-xs text-[#89919d]">@{u.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Incoming Call Ringing Dialog */}
      {incomingCall && (
        <IncomingCallModal
          isOpen={Boolean(incomingCall)}
          caller={incomingCall.caller}
          callType={incomingCall.callType}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {/* Active Fullscreen WebRTC Call Modal */}
      {activeCall && profile && (
        <CallModal
          isOpen={Boolean(activeCall)}
          isCaller={activeCall.isCaller}
          callType={activeCall.callType}
          currentUser={profile}
          remoteUser={activeCall.remoteUser}
          incomingOffer={activeCall.incomingOffer}
          callId={activeCall.callId}
          onEndCall={handleEndActiveCall}
        />
      )}
    </main>
  );
};
