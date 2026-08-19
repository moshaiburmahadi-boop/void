import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { triggerFollowNotification } from '../../lib/followService';
import { Profile } from '../../types';
import { Search, Loader2, X, CheckCircle2, UserPlus, UserCheck } from 'lucide-react';

interface RightSidebarProps {
  onSearch?: (query: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ onSearch }) => {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [suggestedMembers, setSuggestedMembers] = useState<Profile[]>([]);
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

  // Fetch suggested members
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const fetchMembers = async () => {
      try {
        let query = supabase.from('profiles').select('*').limit(5);
        if (profile?.id) {
          query = query.neq('id', profile.id);
        }
        const { data } = await query;
        if (data) {
          setSuggestedMembers(data as Profile[]);
        }
      } catch (e) {
        console.warn(e);
      }
    };

    fetchMembers();
  }, [profile?.id]);

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
            // Exclude current user from results if logged in
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

  const handleFollowToggle = async (targetUser: Profile) => {
    const isNowFollowing = !followingMap[targetUser.id];
    setFollowingMap((prev) => ({
      ...prev,
      [targetUser.id]: isNowFollowing,
    }));

    if (isNowFollowing && profile) {
      await triggerFollowNotification(profile, targetUser.id);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setShowDropdown(false);
    }
  };

  return (
    <aside className="hidden xl:block w-[350px] pl-8 py-5 sticky top-0 h-screen overflow-y-auto select-none">
      {/* Search Bar Container */}
      <div ref={searchContainerRef} className="relative mb-6 z-30">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#89919d]" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowDropdown(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Void users..."
            className="w-full bg-[#121212] border border-[#27272a] rounded-full py-2.5 pl-11 pr-10 text-sm text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] focus:bg-black transition-all outline-none shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#89919d] hover:text-white rounded-full hover:bg-[#27272a] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Live Search Dropdown */}
        {showDropdown && searchQuery.trim().length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-[#121212] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden divide-y divide-[#1f1f23] max-h-96 overflow-y-auto">
            {isSearching ? (
              <div className="p-4 flex items-center justify-center gap-2 text-xs text-[#89919d]">
                <Loader2 className="w-4 h-4 animate-spin text-[#1d9bf0]" />
                <span>Searching members...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#89919d]">
                No members found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              searchResults.map((user) => {
                const isFollowing = followingMap[user.id];
                return (
                  <div
                    key={user.id}
                    className="p-3.5 hover:bg-[#18181b] transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          user.avatar_url ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                        }
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#27272a]"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-bold text-[#e5e2e1] truncate">
                            {user.display_name || user.username}
                          </p>
                          {user.verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
                          )}
                        </div>
                        <p className="text-xs text-[#89919d] truncate">@{user.username}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleFollowToggle(user)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1 ${
                        isFollowing
                          ? 'bg-transparent border border-[#3f3f46] text-[#e5e2e1] hover:border-red-500 hover:text-red-500'
                          : 'bg-[#e5e2e1] text-black hover:bg-white'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
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
              })
            )}
          </div>
        )}
      </div>

      {/* Suggested Members / Who to follow */}
      {suggestedMembers.length > 0 && (
        <div className="bg-[#121212] border border-[#201f1f] rounded-2xl overflow-hidden mb-6">
          <h2 className="text-base font-bold p-4 text-[#e5e2e1]">Who to follow</h2>
          <div className="divide-y divide-[#201f1f]">
            {suggestedMembers.map((user) => {
              const isFollowing = followingMap[user.id];
              return (
                <div
                  key={user.id}
                  className="p-4 hover:bg-[#18181b] transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        user.avatar_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                      }
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#27272a]"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold text-[#e5e2e1] truncate">
                          {user.display_name || user.username}
                        </p>
                        {user.verified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1d9bf0] fill-[#1d9bf0]" />
                        )}
                      </div>
                      <p className="text-xs text-[#89919d] truncate">@{user.username}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFollowToggle(user)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1 ${
                      isFollowing
                        ? 'bg-transparent border border-[#3f3f46] text-[#e5e2e1] hover:border-red-500 hover:text-red-500'
                        : 'bg-[#e5e2e1] text-black hover:bg-white'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
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
          </div>
        </div>
      )}

      {/* Right Rail Mini Footer */}
      <div className="px-4 text-[11px] text-[#71767b] flex flex-wrap gap-x-3 gap-y-1">
        <a href="#" className="hover:underline">Terms of Service</a>
        <a href="#" className="hover:underline">Privacy Policy</a>
        <a href="#" className="hover:underline">Cookie Policy</a>
        <a href="#" className="hover:underline">Accessibility</a>
        <span>© 2026 Void, Inc.</span>
      </div>
    </aside>
  );
};
