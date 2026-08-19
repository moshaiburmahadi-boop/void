import React, { useState } from 'react';
import { TRENDING_TOPICS, WHO_TO_FOLLOW } from '../../data/mockData';
import { Search, TrendingUp, Sparkles, Hash, MoreHorizontal } from 'lucide-react';

interface ExploreViewProps {
  initialSearchQuery?: string;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ initialSearchQuery = '' }) => {
  const [search, setSearch] = useState(initialSearchQuery);
  const [category, setCategory] = useState<'trending' | 'news' | 'sports' | 'entertainment'>('trending');
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

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
            placeholder="Search Void topics, tags, or architects"
            className="w-full bg-[#18181b] border border-transparent rounded-full py-2 pl-10 pr-4 text-xs text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none transition-all"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none text-xs font-semibold text-[#89919d]">
          {(['trending', 'news', 'sports', 'entertainment'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full capitalize transition-colors ${
                category === cat
                  ? 'bg-[#e5e2e1] text-black font-bold'
                  : 'bg-[#18181b] hover:text-[#e5e2e1]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Featured Header Card */}
      <div className="relative p-6 border-b border-[#201f1f] bg-gradient-to-r from-[#111119] to-[#08080c] overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs text-[#1d9bf0] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Void Community Spotlight
          </span>
          <h2 className="text-xl font-bold text-white mb-2">
            The Rise of Minimalist Glassmorphic Systems
          </h2>
          <p className="text-xs text-[#89919d] leading-relaxed max-w-md">
            Developers are converging on high-contrast brutalist design tokens and real-time reactive architectures.
          </p>
        </div>
      </div>

      {/* Trending Topics List */}
      <div className="divide-y divide-[#201f1f]">
        <div className="p-4 bg-[#0a0a0a]">
          <h3 className="text-sm font-bold text-[#e5e2e1] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#1d9bf0]" /> Trends in Neo-Tokyo
          </h3>
        </div>

        {TRENDING_TOPICS.map((item, idx) => (
          <div
            key={idx}
            className="p-4 hover:bg-[#080808] transition-colors cursor-pointer flex justify-between items-start group"
          >
            <div>
              <span className="text-xs text-[#89919d]">{item.category}</span>
              <p className="text-base font-bold text-[#e5e2e1] mt-0.5 group-hover:text-[#1d9bf0] transition-colors flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 opacity-50" />
                {item.topic.replace('#', '')}
              </p>
              <span className="text-xs text-[#89919d] mt-1 block">{item.posts}</span>
            </div>
            <button className="text-[#89919d] hover:text-[#1d9bf0] p-1.5 rounded-full hover:bg-[#1d9bf0]/10 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Suggested Architects */}
      <div className="border-t border-[#201f1f] p-4 bg-[#0a0a0a]">
        <h3 className="text-sm font-bold text-[#e5e2e1] mb-4">Suggested for You</h3>
        <div className="space-y-3">
          {WHO_TO_FOLLOW.map((user) => {
            const isFollowing = followingMap[user.id];
            return (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-[#121212] rounded-2xl border border-[#201f1f]"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover border border-[#27272a]"
                  />
                  <div>
                    <p className="text-sm font-bold text-[#e5e2e1]">{user.name}</p>
                    <p className="text-xs text-[#89919d]">{user.handle}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleFollow(user.id)}
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
      </div>
    </main>
  );
};
