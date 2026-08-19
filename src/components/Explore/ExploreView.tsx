import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Profile, Post } from '../../types';
import { Search, User, MessageSquare } from 'lucide-react';

interface ExploreViewProps {
  initialSearchQuery?: string;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ initialSearchQuery = '' }) => {
  const [search, setSearch] = useState(initialSearchQuery);
  const [matchedUsers, setMatchedUsers] = useState<Profile[]>([]);
  const [matchedPosts, setMatchedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const runSearch = async () => {
      if (!isSupabaseConfigured) return;
      setLoading(true);
      try {
        if (search.trim()) {
          // Search profiles
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
            .limit(10);
          setMatchedUsers((profiles as Profile[]) || []);

          // Search posts
          const { data: posts } = await supabase
            .from('posts')
            .select('*, profiles:user_id(*)')
            .ilike('content', `%${search}%`)
            .limit(10);
          setMatchedPosts((posts as Post[]) || []);
        } else {
          // Load suggested real users
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .limit(10);
          setMatchedUsers((profiles as Profile[]) || []);
          setMatchedPosts([]);
        }
      } catch (err) {
        console.warn('Explore search error:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(runSearch, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleFollow = (id: string) => {
    setFollowingMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <main className="w-full max-w-[600px] lg:ml-[275px] min-h-screen border-r border-[#201f1f] relative pb-20 lg:pb-8 select-none">
      {/* Search Header */}
      <header className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-[#201f1f] p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#89919d]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Void users, posts, or keywords"
            className="w-full bg-[#18181b] border border-transparent rounded-full py-2.5 pl-10 pr-4 text-xs text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none transition-all"
          />
        </div>
      </header>

      {/* Results Section */}
      <div className="divide-y divide-[#201f1f]">
        {/* Members Section */}
        <div className="p-4 bg-[#0a0a0a]">
          <h3 className="text-sm font-bold text-[#e5e2e1] flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-[#1d9bf0]" /> {search ? 'Matching People' : 'Members to Connect'}
          </h3>

          {matchedUsers.length === 0 ? (
            <p className="text-xs text-[#89919d] py-3">
              {search ? 'No users found matching your search.' : 'No other members registered yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {matchedUsers.map((u) => {
                const isFollowing = followingMap[u.id];
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 bg-[#121212] rounded-2xl border border-[#201f1f]"
                  >
                    <div className="flex items-center gap-3">
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

                    <button
                      onClick={() => toggleFollow(u.id)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                        isFollowing
                          ? 'bg-transparent border border-[#3f3f46] text-[#e5e2e1]'
                          : 'bg-[#e5e2e1] text-black hover:bg-white'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Posts Search Results */}
        {search && (
          <div className="p-4 bg-[#0a0a0a]">
            <h3 className="text-sm font-bold text-[#e5e2e1] flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#1d9bf0]" /> Matching Posts
            </h3>

            {matchedPosts.length === 0 ? (
              <p className="text-xs text-[#89919d] py-3">No posts found containing &ldquo;{search}&rdquo;.</p>
            ) : (
              <div className="space-y-3">
                {matchedPosts.map((p) => (
                  <div key={p.id} className="p-3 bg-[#121212] rounded-2xl border border-[#201f1f]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-bold text-xs text-[#e5e2e1]">
                        {p.profiles?.display_name || p.profiles?.username || 'User'}
                      </span>
                      <span className="text-[11px] text-[#89919d]">@{p.profiles?.username}</span>
                    </div>
                    <p className="text-xs text-[#e5e2e1]">{p.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
