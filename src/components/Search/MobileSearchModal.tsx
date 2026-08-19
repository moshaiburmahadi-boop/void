import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { Profile } from '../../types';
import { Search, X, Loader2, CheckCircle2, UserPlus, UserCheck, Users, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSearchModal: React.FC<MobileSearchModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const { isFollowing, toggleFollow } = useFollow();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [recentMembers, setRecentMembers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened & load suggested real users
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      loadRecentMembers();
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  const loadRecentMembers = async () => {
    if (!isSupabaseConfigured) return;
    try {
      let q = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (profile?.id) {
        q = q.neq('id', profile.id);
      }

      const { data, error } = await q;
      if (!error && data) {
        setRecentMembers(data as Profile[]);
      }
    } catch (e) {
      console.warn('Error loading recent members for mobile search:', e);
    }
  };

  // Live query to Supabase profiles
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      if (isSupabaseConfigured) {
        try {
          const term = query.trim();
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
            .limit(12);

          if (!error && data) {
            const filtered = (data as Profile[]).filter(
              (p) => !profile?.id || p.id !== profile.id
            );
            setResults(filtered);
          } else {
            setResults([]);
          }
        } catch (err) {
          console.warn('Mobile search query error:', err);
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, profile?.id]);

  if (!isOpen) return null;

  const displayList = query.trim() ? results : recentMembers;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black flex flex-col md:hidden select-none">
        {/* Top Search Bar */}
        <header className="sticky top-0 bg-black/95 backdrop-blur-md border-b border-[#201f1f] px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 text-[#89919d] hover:text-white rounded-full hover:bg-[#18181b] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-[#71767b]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Void users..."
              className="w-full bg-[#16181c] border border-transparent rounded-full py-2 pl-9 pr-9 text-sm text-[#e7e9ea] placeholder-[#71767b] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] focus:bg-black transition-all outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 p-1 text-[#71767b] hover:text-white rounded-full hover:bg-[#27272a] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* Search Results / Members List */}
        <main className="flex-1 overflow-y-auto divide-y divide-[#201f1f] pb-16">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#71767b]">
              <Loader2 className="w-6 h-6 animate-spin text-[#1d9bf0]" />
              <span>Searching Void members...</span>
            </div>
          ) : query.trim() && results.length === 0 ? (
            <div className="py-16 px-6 text-center text-xs text-[#71767b]">
              <Users className="w-8 h-8 mx-auto mb-2 text-[#71767b]" />
              <p className="text-sm font-semibold text-[#e7e9ea] mb-1">No results found</p>
              <p>Try searching for a different username or name.</p>
            </div>
          ) : displayList.length === 0 ? (
            <div className="py-16 px-6 text-center text-xs text-[#71767b]">
              <Users className="w-8 h-8 mx-auto mb-2 text-[#71767b]" />
              <p className="text-sm font-semibold text-[#e7e9ea] mb-1">No users found</p>
              <p>Type above to find people across Void.</p>
            </div>
          ) : (
            <>
              {!query.trim() && recentMembers.length > 0 && (
                <div className="px-4 py-2.5 bg-[#0f1419] border-b border-[#201f1f] text-xs font-bold text-[#89919d] tracking-wider uppercase">
                  Suggested Members
                </div>
              )}

              {displayList.map((user) => {
                const followed = isFollowing(user.id);
                return (
                  <div
                    key={user.id}
                    className="p-4 hover:bg-[#16181c] transition-colors flex items-center justify-between gap-3 active:bg-[#1f2125]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={
                          user.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                        }
                        alt={user.username}
                        className="w-11 h-11 rounded-full object-cover shrink-0 border border-[#2f3336]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-bold text-[#e7e9ea] truncate">
                            {user.display_name || user.username}
                          </p>
                          {user.verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[#71767b] truncate">@{user.username}</p>
                        {user.bio && (
                          <p className="text-xs text-[#89919d] truncate mt-0.5">{user.bio}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleFollow(user)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1 group ${
                        followed
                          ? 'bg-transparent border border-[#536471] text-[#e7e9ea] hover:border-red-500 hover:text-red-500'
                          : 'bg-[#eff3f4] text-black hover:bg-white'
                      }`}
                    >
                      {followed ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-[#1d9bf0]" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </main>
      </div>
    </AnimatePresence>
  );
};
