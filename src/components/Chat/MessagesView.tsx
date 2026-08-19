import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Message, Profile } from '../../types';
import { INITIAL_MESSAGES, OTHER_USERS } from '../../data/mockData';
import {
  Search,
  Settings,
  Edit3,
  Send,
  Image as ImageIcon,
  Smile,
  Info,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

interface MessagesViewProps {
  onUnreadChange?: (count: number) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ onUnreadChange }) => {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Profile[]>([
    OTHER_USERS.elena_rostova,
    OTHER_USERS.marcus_chen,
    OTHER_USERS.system_updates,
    OTHER_USERS.alex_chen,
    OTHER_USERS.nova_design,
  ]);

  const [activePartner, setActivePartner] = useState<Profile>(OTHER_USERS.elena_rostova);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load and subscribe to Supabase Realtime messages
  useEffect(() => {
    if (!profile) return;

    if (isSupabaseConfigured) {
      // 1. Fetch initial message history between current user and activePartner
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

          if (!error && data && data.length > 0) {
            const formattedMessages: Message[] = (data as unknown as any[]).map((m) => ({
              ...m,
              sender_profile: Array.isArray(m.sender_profile) ? m.sender_profile[0] : m.sender_profile,
              receiver_profile: Array.isArray(m.receiver_profile) ? m.receiver_profile[0] : m.receiver_profile,
            }));
            setMessages(formattedMessages);
          }
        } catch (err) {
          console.warn('Could not fetch Supabase messages, using local store:', err);
        }
      };

      fetchHistory();

      // 2. Set up Supabase Realtime Channel using postgres_changes
      const channel = supabase
        .channel(`messages_room_${activePartner.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            const newMsg = payload.new as Message;
            // Check if this message belongs to active conversation
            const isRelevant =
              (newMsg.sender_id === activePartner.id && newMsg.receiver_id === profile.id) ||
              (newMsg.sender_id === profile.id && newMsg.receiver_id === activePartner.id);

            if (isRelevant) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
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
  }, [activePartner.id, profile?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !profile) return;

    const content = inputText.trim();
    setInputText('');

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender_id: profile.id,
      receiver_id: activePartner.id,
      content,
      created_at: new Date().toISOString(),
      sender_profile: profile,
      receiver_profile: activePartner,
    };

    // Optimistic UI append
    setMessages((prev) => [...prev, newMsg]);

    // Send to Supabase
    if (isSupabaseConfigured) {
      try {
        await supabase.from('messages').insert({
          sender_id: profile.id,
          receiver_id: activePartner.id,
          content,
        });
      } catch (err) {
        console.warn('Error sending to Supabase messages:', err);
      }
    } else {
      // Simulate live reply from bot/partner after 1.5 seconds in local/demo mode
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const replyResponses = [
          "Looks fantastic! Let's get the latest build ready.",
          "Awesome work on the void dark mode palette.",
          "Got it, reviewing the components right now.",
          "Minimalist architecture is definitely the way forward! 🚀",
        ];
        const randomReply = replyResponses[Math.floor(Math.random() * replyResponses.length)];
        const simulatedReply: Message = {
          id: `msg-${Date.now() + 1}`,
          sender_id: activePartner.id,
          receiver_id: profile.id,
          content: randomReply,
          created_at: new Date().toISOString(),
          sender_profile: activePartner,
          receiver_profile: profile,
        };
        setMessages((prev) => [...prev, simulatedReply]);
      }, 1400);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    (c.display_name || c.username).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col lg:ml-[275px] h-screen overflow-hidden bg-black select-none">
      {/* Messages Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Conversations List */}
        <section
          className={`w-full lg:w-[350px] border-r border-[#201f1f] flex flex-col h-full bg-[#000000] shrink-0 ${
            showMobileChat ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#201f1f]">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold text-[#e5e2e1]">Messages</h2>
              <div className="flex gap-2 text-[#89919d]">
                <button className="p-2 hover:bg-[#18181b] hover:text-[#1d9bf0] rounded-full transition-colors">
                  <Settings className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-[#18181b] hover:text-[#1d9bf0] rounded-full transition-colors">
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Input */}
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

          {/* Conversation Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#201f1f] pb-20 lg:pb-0">
            {filteredConversations.map((partner) => {
              const isActive = activePartner.id === partner.id;
              return (
                <div
                  key={partner.id}
                  onClick={() => {
                    setActivePartner(partner);
                    setShowMobileChat(true);
                  }}
                  className={`flex items-start gap-3 p-4 hover:bg-[#131313] cursor-pointer transition-colors ${
                    isActive ? 'bg-[#18181b] border-r-2 border-r-[#1d9bf0]' : ''
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={partner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                      alt={partner.display_name || partner.username}
                      className="w-11 h-11 rounded-full object-cover border border-[#27272a]"
                    />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-sm font-bold text-[#e5e2e1] truncate">
                          {partner.display_name || partner.username}
                        </span>
                        {partner.verified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-[#89919d] shrink-0">
                        {isActive ? 'Now' : '2m'}
                      </span>
                    </div>

                    <p className="text-xs text-[#89919d] truncate">
                      {isActive
                        ? messages[messages.length - 1]?.content || 'Active conversation'
                        : partner.bio || 'Available for messaging'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Active Chat Interface */}
        <section
          className={`flex-1 flex-col bg-[#000000] relative z-0 h-full ${
            showMobileChat ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Chat Header */}
          <div className="h-16 border-b border-[#201f1f] flex items-center justify-between px-4 sm:px-6 bg-black/85 backdrop-blur-md sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              {/* Back button on mobile */}
              <button
                onClick={() => setShowMobileChat(false)}
                className="lg:hidden p-2 -ml-2 text-[#89919d] hover:text-white rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <img
                src={activePartner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                alt={activePartner.display_name || activePartner.username}
                className="w-10 h-10 rounded-full object-cover border border-[#27272a]"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm sm:text-base font-bold text-[#e5e2e1]">
                    {activePartner.display_name || activePartner.username}
                  </h2>
                  {activePartner.verified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
                  )}
                </div>
                <p className="text-[11px] text-[#89919d]">
                  @{activePartner.username} • <span className="text-emerald-400">Active now</span>
                </p>
              </div>
            </div>

            <button className="text-[#89919d] hover:text-[#1d9bf0] p-2 rounded-full hover:bg-[#18181b] transition-colors">
              <Info className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Stream Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
            {/* Timestamp pill */}
            <div className="flex justify-center my-2">
              <span className="bg-[#18181b] text-[#89919d] text-[11px] font-medium px-3 py-1 rounded-full border border-[#27272a]">
                Today • Realtime Chat
              </span>
            </div>

            {/* Message Bubbles */}
            {messages.map((msg) => {
              const isMe = msg.sender_id === profile?.id || msg.sender_id === 'user_current_alex';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${
                    isMe ? 'self-end flex-row-reverse' : 'self-start'
                  }`}
                >
                  {!isMe && (
                    <img
                      src={activePartner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                      alt="avatar"
                      className="w-7 h-7 rounded-full object-cover self-end mb-1 border border-[#27272a] shrink-0"
                    />
                  )}

                  <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-2.5 text-sm sm:text-base leading-relaxed ${
                        isMe
                          ? 'bg-[#1d9bf0] text-white rounded-2xl rounded-br-sm shadow-md shadow-[#1d9bf0]/10'
                          : 'bg-[#1c1b1b] text-[#e5e2e1] rounded-2xl rounded-bl-sm border border-[#27272a]'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Live Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3 max-w-[80%] self-start items-center">
                <img
                  src={activePartner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                  alt="avatar"
                  className="w-7 h-7 rounded-full object-cover self-end mb-1 border border-[#27272a]"
                />
                <div className="bg-[#1c1b1b] px-4 py-3 rounded-2xl rounded-bl-sm border border-[#27272a] flex items-center gap-1.5 h-10">
                  <div className="w-1.5 h-1.5 bg-[#89919d] rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 bg-[#89919d] rounded-full animate-bounce [animation-delay:200ms]" />
                  <div className="w-1.5 h-1.5 bg-[#89919d] rounded-full animate-bounce [animation-delay:400ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Form */}
          <div className="p-3 sm:p-4 bg-[#000000] border-t border-[#201f1f] sticky bottom-0 shrink-0">
            <form
              onSubmit={handleSendMessage}
              className="bg-[#18181b] rounded-2xl flex items-center px-2 py-1.5 border border-[#27272a] focus-within:border-[#1d9bf0] focus-within:ring-1 focus-within:ring-[#1d9bf0] transition-all"
            >
              <button
                type="button"
                className="p-2 text-[#1d9bf0] hover:bg-[#27272a] rounded-full transition-colors"
                title="Add Image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Start a new message"
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm sm:text-base text-[#e5e2e1] placeholder-[#89919d] px-2 outline-none"
              />

              <button
                type="button"
                onClick={() => setInputText((prev) => prev + ' 🔥')}
                className="p-2 text-[#1d9bf0] hover:bg-[#27272a] rounded-full transition-colors"
              >
                <Smile className="w-5 h-5" />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 ml-1 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-full transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center w-9 h-9 cursor-pointer"
              >
                <Send className="w-4 h-4 fill-current" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};
