import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Notification } from '../../types';
import { Heart, Repeat2, User, Settings, Bell } from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'all' | 'mentions'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!profile || !isSupabaseConfigured) return;

    // Fetch notifications from Supabase
    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            id,
            user_id,
            actor_id,
            type,
            post_id,
            created_at,
            actor_profile:actor_id(*)
          `)
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const formattedNotifs: Notification[] = (data as unknown as any[]).map((n) => ({
            ...n,
            actor_profile: Array.isArray(n.actor_profile) ? n.actor_profile[0] : n.actor_profile,
          }));
          setNotifications(formattedNotifs);
        }
      } catch (err) {
        console.warn('Error fetching notifications:', err);
      }
    };

    fetchNotifications();

    // Subscribe to real-time notification inserts
    const channel = supabase
      .channel(`notifs_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        async (payload) => {
          const newNotif = payload.new as Notification;
          // Fetch actor profile for new notification
          let actorProfile = null;
          try {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newNotif.actor_id)
              .single();
            actorProfile = data;
          } catch (e) {
            console.warn(e);
          }

          setNotifications((prev) => [
            {
              ...newNotif,
              actor_profile: actorProfile || {
                id: newNotif.actor_id,
                username: 'member',
                display_name: 'Member',
                avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
                created_at: new Date().toISOString(),
              },
            },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const toggleFollow = (actorId: string) => {
    setFollowingMap((prev) => ({
      ...prev,
      [actorId]: !prev[actorId],
    }));
  };

  const filteredNotifs = tab === 'mentions'
    ? notifications.filter((n) => n.type === 'mention')
    : notifications;

  return (
    <main className="w-full max-w-[600px] lg:ml-[275px] min-h-screen border-r border-[#201f1f] relative pb-20 lg:pb-8 select-none">
      {/* Page Header */}
      <div className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-[#201f1f]">
        <div className="px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-[#e5e2e1]">Notifications</h1>
          <button className="text-[#89919d] hover:text-white p-2 rounded-full hover:bg-[#18181b] transition-colors cursor-pointer">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex w-full px-2">
          <button
            onClick={() => setTab('all')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              tab === 'all'
                ? 'border-[#1d9bf0] text-[#1d9bf0]'
                : 'border-transparent text-[#89919d] hover:text-[#e5e2e1]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTab('mentions')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              tab === 'mentions'
                ? 'border-[#1d9bf0] text-[#1d9bf0]'
                : 'border-transparent text-[#89919d] hover:text-[#e5e2e1]'
            }`}
          >
            Mentions
          </button>
        </div>
      </div>

      {/* Notifications Feed */}
      <div className="divide-y divide-[#201f1f]">
        {filteredNotifs.length === 0 ? (
          <div className="p-16 text-center text-[#89919d] flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-[#1d9bf0]" />
            </div>
            <h3 className="text-lg font-bold text-[#e5e2e1] mb-1">Nothing to see here — yet</h3>
            <p className="text-xs max-w-sm text-[#89919d]">
              From likes to reposts and a whole lot more, this is where all the action about your posts and account will happen.
            </p>
          </div>
        ) : (
          filteredNotifs.map((notif) => {
            const actor = notif.actor_profile || {
              id: notif.actor_id,
              username: 'member',
              display_name: 'Member',
              avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
              created_at: new Date().toISOString(),
            };
            const isFollowing = followingMap[notif.actor_id];

            return (
              <article
                key={notif.id}
                className="p-4 hover:bg-[#080808] transition-colors cursor-pointer flex gap-4"
              >
                {/* Notification Icon */}
                <div className="w-10 flex justify-end shrink-0 pt-0.5">
                  {notif.type === 'like' && (
                    <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
                  )}
                  {notif.type === 'repost' && (
                    <Repeat2 className="w-6 h-6 text-[#1d9bf0]" />
                  )}
                  {notif.type === 'follow' && (
                    <User className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                  )}
                  {notif.type === 'mention' && (
                    <img
                      src={actor.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                      alt={actor.username}
                      className="w-10 h-10 rounded-full object-cover border border-[#27272a]"
                    />
                  )}
                </div>

                {/* Notification Details */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  {notif.type !== 'mention' && (
                    <div className="flex items-center justify-between">
                      <img
                        src={actor.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                        alt={actor.username}
                        className="w-8 h-8 rounded-full object-cover border border-[#27272a]"
                      />

                      {notif.type === 'follow' && (
                        <button
                          onClick={() => toggleFollow(notif.actor_id)}
                          className={`px-4 py-1 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                            isFollowing
                              ? 'bg-transparent border border-[#3f3f46] text-[#e5e2e1]'
                              : 'bg-[#e5e2e1] text-black hover:bg-white'
                          }`}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  )}

                  {notif.type === 'like' && (
                    <>
                      <div className="text-sm text-[#e5e2e1]">
                        <span className="font-bold">{actor.display_name || actor.username}</span> liked your post
                      </div>
                      {notif.post_content && (
                        <p className="text-xs text-[#89919d] line-clamp-2 leading-relaxed">
                          {notif.post_content}
                        </p>
                      )}
                    </>
                  )}

                  {notif.type === 'repost' && (
                    <>
                      <div className="text-sm text-[#e5e2e1]">
                        <span className="font-bold">{actor.display_name || actor.username}</span> reposted your post
                      </div>
                      {notif.post_content && (
                        <p className="text-xs text-[#89919d] line-clamp-2 leading-relaxed">
                          {notif.post_content}
                        </p>
                      )}
                    </>
                  )}

                  {notif.type === 'follow' && (
                    <div className="text-sm text-[#e5e2e1]">
                      <span className="font-bold">{actor.display_name || actor.username}</span> followed you
                    </div>
                  )}

                  {notif.type === 'mention' && (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-[#89919d]">
                        <span className="font-bold text-sm text-[#e5e2e1]">
                          {actor.display_name || actor.username}
                        </span>
                        <span>@{actor.username}</span>
                      </div>
                      <p className="text-sm text-[#e5e2e1] leading-relaxed">
                        {notif.post_content || 'Mentioned you in a post'}
                      </p>
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
};
