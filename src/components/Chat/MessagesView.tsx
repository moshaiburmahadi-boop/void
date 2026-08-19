import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Message, Profile } from '../../types';
import {
  Search,
  Edit3,
  Send,
  Image as ImageIcon,
  Smile,
  ArrowLeft,
  CheckCircle2,
  Mail,
  UserPlus,
} from 'lucide-react';

interface MessagesViewProps {
  onUnreadChange?: (count: number) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ onUnreadChange }) => {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Profile[]>([]);
  const [activePartner, setActivePartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load existing profiles / conversations
  useEffect(() => {
    if (!profile) return;

    const fetchUsersAndConversations = async () => {
      if (isSupabaseConfigured) {
        try {
          // Fetch profiles excluding current user
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .neq('id', profile.id)
            .limit(20);

          if (profilesData && profilesData.length > 0) {
            setAllUsers(profilesData as Profile[]);
            setConversations(profilesData as Profile[]);
            if (!activePartner && profilesData.length > 0) {
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

  // Load message history with activePartner
  useEffect(() => {
    if (!profile || !activePartner) {
      setMessages([]);
      return;
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

      // Subscribe to real-time incoming messages
      const channel = supabase
        .channel(`messages_${profile.id}_${activePartner.id}`)
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
              setMessages((prev) => {
                // 1. Deduplicate by exact database ID
                if (prev.some((m) => m.id === newMsg.id)) {
                  return prev;
                }

                // 2. Deduplicate / replace optimistic message with real message
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

                // 3. New message from partner or fresh insert
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
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activePartner?.id, profile?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !profile || !activePartner) return;

    const content = inputText.trim();
    setInputText('');

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
        console.warn('Error sending message:', err);
      }
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="w-full max-w-[990px] lg:ml-[275px] min-h-screen border-r border-[#201f1f] flex pb-20 lg:pb-0 select-none">
      {/* Conversations Column */}
      <div
        className={`w-full md:w-[380px] border-r border-[#201f1f] flex flex-col h-screen sticky top-0 bg-black ${
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
              className="w-full bg-[#18181b] border border-transparent rounded-full py-2 pl-10 pr-4 text-xs text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none transition-all"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#18181b]">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-[#89919d] flex flex-col items-center">
              <Mail className="w-10 h-10 mb-3 text-[#27272a]" />
              <p className="text-sm font-bold text-[#e5e2e1] mb-1">No messages yet</p>
              <p className="text-xs max-w-[200px] mb-4">
                Send a direct message to begin a private conversation.
              </p>
              <button
                onClick={() => setIsSearchingUser(true)}
                className="px-4 py-2 bg-[#e5e2e1] text-black font-bold text-xs rounded-full hover:bg-white transition-all cursor-pointer"
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
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
                      )}
                    </div>
                    <span className="text-xs text-[#89919d] block truncate">
                      @{user.username}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Thread */}
      <div
        className={`flex-1 flex flex-col h-screen sticky top-0 bg-black ${
          showMobileChat ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activePartner ? (
          <>
            {/* Thread Header */}
            <div className="p-3.5 border-b border-[#201f1f] flex items-center justify-between bg-black/85 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 text-[#89919d] hover:text-white rounded-full"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img
                  src={activePartner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                  alt={activePartner.username}
                  className="w-9 h-9 rounded-full object-cover border border-[#27272a]"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm text-[#e5e2e1]">
                      {activePartner.display_name || activePartner.username}
                    </span>
                    {activePartner.verified && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
                    )}
                  </div>
                  <span className="text-xs text-[#89919d]">@{activePartner.username}</span>
                </div>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-[#89919d] flex flex-col items-center justify-center h-full">
                  <p className="text-sm font-semibold text-[#e5e2e1] mb-1">
                    Direct conversation with @{activePartner.username}
                  </p>
                  <p className="text-xs">Say hello to break the ice.</p>
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
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMe
                            ? 'bg-[#1d9bf0] text-white rounded-br-none'
                            : 'bg-[#202327] text-[#e5e2e1] rounded-bl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
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
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Start a new message"
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
                className="text-xs text-[#1d9bf0] font-bold"
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
