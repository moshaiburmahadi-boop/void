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
  Users,
} from 'lucide-react';

interface MessagesViewProps {
  initialPartner?: Profile | null;
  onUnreadChange?: (count: number) => void;
  onViewProfile?: (user: Profile) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  initialPartner,
  onUnreadChange,
  onViewProfile,
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const partnerTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPartnerTyping]);

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
              created_at,
              sender_profile:sender_id(*),
              receiver_profile:receiver_id(*)
            `)
            .or(
              `and(sender_id.eq.${profile.id},receiver_id.eq.${activePartner.id}),and(sender_id.eq.${activePartner.id},receiver_id.eq.${profile.id})`
            )
            .order('created_at', { ascending: true });

          if (!error && data) {
            const formattedMessages: Message[] = (data as unknown as any[]).map((m) => ({
              ...m,
              sender_profile: Array.isArray(m.sender_profile) ? m.sender_profile[0] : m.sender_profile,
              receiver_profile: Array.isArray(m.receiver_profile) ? m.receiver_profile[0] : m.receiver_profile,
            }));
            setMessages(formattedMessages);
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
          (payload) => {
            const newMsg = payload.new as Message;
            const isRelevant =
              (newMsg.sender_id === activePartner.id && newMsg.receiver_id === profile.id) ||
              (newMsg.sender_id === profile.id && newMsg.receiver_id === activePartner.id);

            if (isRelevant) {
              // Hide typing indicator when new message arrives
              if (newMsg.sender_id === activePartner.id) {
                setIsPartnerTyping(false);
              }

              setMessages((prev) => {
                // 1. Deduplicate by exact database ID
                if (prev.some((m) => m.id === newMsg.id)) {
                  return prev;
                }

                // 2. Replace optimistic message
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
                  };
                  return updated;
                }

                // 3. New incoming message
                return [
                  ...prev,
                  {
                    ...newMsg,
                    sender_profile: newMsg.sender_id === profile.id ? profile : activePartner,
                    receiver_profile: newMsg.receiver_id === profile.id ? profile : activePartner,
                  },
                ];
              });
            }
          }
        )
        // Listen for realtime typing broadcast from partner
        .on('broadcast', { event: 'typing' }, (eventPayload) => {
          const { userId, isTyping } = eventPayload?.payload || {};
          if (userId === activePartner.id) {
            setIsPartnerTyping(Boolean(isTyping));

            // Auto reset typing after 2.5s if no further typing broadcast received
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

  // Emit typing broadcast event with 2s debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!profile || !activePartner || !channelRef.current) return;

    if (val.trim().length > 0) {
      // Broadcast typing = true
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, isTyping: true },
      });

      // Clear existing debounce and set 2-second timeout to broadcast typing = false
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
      // If user clears the input, immediately broadcast typing = false
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !profile || !activePartner) return;

    const content = inputText.trim();
    setInputText('');

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
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({
            sender_id: profile.id,
            receiver_id: activePartner.id,
            content,
          })
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

  const filteredConversations = conversations.filter(
    (c) =>
      c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="w-full max-w-[990px] min-h-screen border-r border-[#201f1f] flex pb-20 lg:pb-0 select-none">
      {/* Conversations Column */}
      <div
        className={`w-full md:w-[380px] border-r border-[#201f1f] flex flex-col h-screen sticky top-0 bg-black shrink-0 ${
          showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#201f1f] flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#e5e2e1]">Messages</h1>
          <button
            onClick={() => setIsSearchingUser(true)}
            className="p-2 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b] transition-colors cursor-pointer"
            title="New Message"
          >
            <Edit3 className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#201f1f]">
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

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#18181b]">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-[#89919d]">
              <p className="text-sm font-semibold text-[#e5e2e1] mb-1">No conversations</p>
              <p className="text-xs mb-4">Start messaging any registered user on Void!</p>
              <button
                onClick={() => setIsSearchingUser(true)}
                className="px-4 py-1.5 bg-[#1d9bf0] text-white text-xs font-bold rounded-full hover:bg-[#1a8cd8]"
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
        className={`flex-1 flex flex-col h-screen sticky top-0 bg-black ${
          !showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activePartner ? (
          <>
            {/* Chat Top Header */}
            <div className="p-3.5 border-b border-[#201f1f] flex items-center justify-between bg-black/90 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b]"
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
            </div>

            {/* Messages Scroll Area */}
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
                    Say hello to start the conversation! Realtime messaging with instant delivery.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === profile?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                          isMe
                            ? 'bg-[#1d9bf0] text-white rounded-br-none'
                            : 'bg-[#201f1f] text-[#e5e2e1] rounded-bl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
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
                  <div className="bg-neutral-800 text-neutral-300 rounded-full px-4 py-2 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-[#201f1f] bg-black flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Start a new message..."
                className="flex-1 bg-[#18181b] border border-transparent rounded-full px-4 py-2.5 text-sm text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-full transition-all disabled:opacity-30 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
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
    </main>
  );
};
