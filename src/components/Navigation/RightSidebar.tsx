import React, { useState } from 'react';
import { TRENDING_TOPICS, WHO_TO_FOLLOW } from '../../data/mockData';
import { Search, MoreHorizontal, Check } from 'lucide-react';

interface RightSidebarProps {
  onSearch?: (query: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const toggleFollow = (id: string) => {
    setFollowingMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery) {
      onSearch(searchQuery);
    }
  };

  return (
    <aside className="hidden xl:block w-[350px] pl-8 py-5 sticky top-0 h-screen overflow-y-auto">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="sticky top-0 bg-black/90 backdrop-blur-md pb-4 z-10">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#89919d]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Void"
            className="w-full bg-[#121212] border border-transparent rounded-full py-2.5 pl-12 pr-4 text-sm text-[#e5e2e1] placeholder-[#89919d] focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] focus:bg-black transition-all outline-none"
          />
        </div>
      </form>

      {/* What's Happening */}
      <div className="bg-[#121212] border border-[#201f1f] rounded-2xl mb-4 overflow-hidden">
        <h2 className="text-lg font-bold p-4 text-[#e5e2e1]">What&apos;s happening</h2>
        <div className="divide-y divide-[#201f1f]">
          {TRENDING_TOPICS.map((item, idx) => (
            <div
              key={idx}
              className="p-4 hover:bg-[#18181b] cursor-pointer transition-colors flex justify-between items-start group"
            >
              <div>
                <span className="text-xs text-[#89919d]">{item.category}</span>
                <p className="text-sm font-bold text-[#e5e2e1] mt-0.5 group-hover:text-[#1d9bf0] transition-colors">
                  {item.topic}
                </p>
                <span className="text-xs text-[#89919d] mt-0.5 block">{item.posts}</span>
              </div>
              <button className="text-[#89919d] hover:text-[#1d9bf0] p-1 rounded-full hover:bg-[#1d9bf0]/10 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Who to Follow */}
      <div className="bg-[#121212] border border-[#201f1f] rounded-2xl overflow-hidden mb-8">
        <h2 className="text-lg font-bold p-4 text-[#e5e2e1]">Who to follow</h2>
        <div className="divide-y divide-[#201f1f]">
          {WHO_TO_FOLLOW.map((user) => {
            const isFollowing = followingMap[user.id];
            return (
              <div
                key={user.id}
                className="p-4 hover:bg-[#18181b] transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#27272a]"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#e5e2e1] truncate hover:underline cursor-pointer">
                      {user.name}
                    </p>
                    <p className="text-xs text-[#89919d] truncate">{user.handle}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleFollow(user.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 ${
                    isFollowing
                      ? 'bg-transparent border border-[#3f3f46] text-[#e5e2e1] hover:border-red-500 hover:text-red-500'
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

      {/* Right Rail Mini Footer */}
      <div className="px-4 text-[11px] text-[#71767b] flex flex-wrap gap-x-3 gap-y-1">
        <a href="#" className="hover:underline">Terms of Service</a>
        <a href="#" className="hover:underline">Privacy Policy</a>
        <a href="#" className="hover:underline">Cookie Policy</a>
        <a href="#" className="hover:underline">Accessibility</a>
        <span>© 2026 Void Technologies, Inc.</span>
      </div>
    </aside>
  );
};
