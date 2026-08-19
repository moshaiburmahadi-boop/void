import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { Profile } from '../../types';
import { Search, Loader2, X, CheckCircle2, UserPlus, UserCheck, Sparkles, Users } from 'lucide-react';

interface RightSidebarProps {
  onSearch?: (query: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ onSearch }) => {
  const { profile } = useAuth();
  const { isFollowing, toggleFollow } = useFollow();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [realMembers, setRealMembers] = useState<Profile[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch ONLY real users from Supabase profiles table
  const fetchRealMembers = async () => {
    if (!isSupabaseConfigured) {
      setRealMembers([]);
      return;
    }

    setIsLoadingMembers(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (profile?.id) {
        query = query.neq('id', profile.id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setRealMembers(data as Profile[]);
      } else {
        setRealMembers([]);
      }
    } catch (e) {
      console.warn('Error fetching real members from Supabase:', e);
      setRealMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchRealMembers();
  }, [profile?.id]);

  // Filter 3 to 4 recommended real users who are NOT followed yet & NOT the current user
  const whoToFollowList = realMembers
    .filter((user) => {
      if (profile?.id && user.id === profile.id) return false;
      if (isFollowing(user.id)) return false;
      return true;
    })
    .slice(0, 4);

  // Live user search from Supabase profiles
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setShowDropdown(true);
    setIsSearching(true);

    const timer = setTimeout(async () => {
      if (isSupabaseConfigured) {
        try {
          const queryTerm = searchQuery.trim();
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`username.ilike.%${queryTerm}%,display_name.ilike.%${queryTerm}%`)
            .limit(8);

          if (!error && data) {
            const filtered = (data as Profile[]).filter(
              (p) => !profile?.id || p.id !== profile.id
            );
            setSearchResults(filtered);
          }
        } catch (err) {
          console.warn('Search profiles error:', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, profile?.id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setShowDropdown(false);
    }
  };

  return (
    <aside className="hidden xl:block w-[350px] shrink-0 pl-7 py-4 sticky top-0 h-screen overflow-y-auto select-none">
      {/* Search Bar Container */}
      <div ref={searchContainerRef} className="relative mb-4 z-30">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#71767b]" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowDropdown(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Void..."
            className="w-full bg-[#16181c] border border-transparent rounded-full py-2.5 pl-11 pr-10 text-sm text-[#e7e9ea] placeholder-[#71767b] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] focus:bg-black transition-all outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#71767b] hover:text-white rounded-full hover:bg-[#27272a] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Live Search Dropdown */}
        {showDropdown && searchQuery.trim().length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-[#000000] border border-[#2f3336] rounded-2xl shadow-2xl overflow-hidden divide-y divide-[#2f3336] max-h-96 overflow-y-auto">
            {isSearching ? (
              <div className="p-4 flex items-center justify-center gap-2 text-xs text-[#71767b]">
                <Loader2 className="w-4 h-4 animate-spin text-[#1d9bf0]" />
                <span>Searching members...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#71767b]">
                No members found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              searchResults.map((user) => {
                const followed = isFollowing(user.id);
                return (
                  <div
                    key={user.id}
                    className="p-3.5 hover:bg-[#16181c] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          user.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                        }
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#2f3336]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-bold text-[#e7e9ea] truncate">
                            {user.display_name || user.username}
                          </p>
                          {user.verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
                          )}
                        </div>
                        <p className="text-xs text-[#71767b] truncate">@{user.username}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleFollow(user)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1 group ${
                        followed
                          ? 'bg-transparent border border-[#536471] text-[#e7e9ea] hover:border-red-500 hover:text-red-500 hover:bg-red-950/20'
                          : 'bg-[#eff3f4] text-black hover:bg-white'
                      }`}
                    >
                      {followed ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 group-hover:hidden" />
                          <span className="group-hover:hidden">Following</span>
                          <span className="hidden group-hover:inline">Unfollow</span>
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
              })
            )}
          </div>
        )}
      </div>

      {/* Dynamic "Who to follow" Card Widget (Real users only) */}
      <div className="bg-[#0f1419] border border-[#2f3336] rounded-2xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#2f3336]/60 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#e7e9ea] tracking-tight">
            Who to follow
          </h2>
          <Sparkles className="w-4 h-4 text-[#1d9bf0]" />
        </div>

        <div className="divide-y divide-[#2f3336]/50">
          {isLoadingMembers ? (
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-[#71767b]">
              <Loader2 className="w-4 h-4 animate-spin text-[#1d9bf0]" />
              <span>Loading recommendations...</span>
            </div>
          ) : whoToFollowList.length === 0 ? (
            <div className="p-5 text-center text-xs text-[#71767b] flex flex-col items-center gap-2">
              <Users className="w-5 h-5 text-[#71767b]" />
              <p>No new members to follow right now.</p>
            </div>
          ) : (
            whoToFollowList.map((user) => {
              const followed = isFollowing(user.id);
              return (
                <div
                  key={user.id}
                  className="px-4 py-3 hover:bg-[#16181c] transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={
                        user.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                      }
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#2f3336]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold text-[#e7e9ea] truncate group-hover:underline cursor-pointer">
                          {user.display_name || user.username}
                        </p>
                        {user.verified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#71767b] truncate">@{user.username}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleFollow(user)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1 group/btn ${
                      followed
                        ? 'bg-transparent border border-[#536471] text-[#e7e9ea] hover:border-red-500 hover:text-red-500 hover:bg-red-950/20'
                        : 'bg-[#eff3f4] text-black hover:bg-white'
                    }`}
                  >
                    {followed ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 group-hover/btn:hidden text-[#1d9bf0]" />
                        <span className="group-hover/btn:hidden">Following</span>
                        <span className="hidden group-hover/btn:inline">Unfollow</span>
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
            })
          )}
        </div>

        {whoToFollowList.length > 0 && (
          <button
            onClick={() => {
              if (onSearch) onSearch('');
            }}
            className="w-full text-left px-4 py-3 text-xs font-semibold text-[#1d9bf0] hover:bg-[#16181c] transition-colors cursor-pointer border-t border-[#2f3336]/40"
          >
            Show more
          </button>
        )}
      </div>

      {/* Right Rail Mini Footer */}
      <div className="px-4 text-[11px] text-[#71767b] flex flex-wrap gap-x-3 gap-y-1 leading-relaxed">
        <a href="#" className="hover:underline">Terms of Service</a>
        <a href="#" className="hover:underline">Privacy Policy</a>
        <a href="#" className="hover:underline">Cookie Policy</a>
        <a href="#" className="hover:underline">Accessibility</a>
        <span>© 2026 Void, Inc.</span>
      </div>
    </aside>
  );
};
