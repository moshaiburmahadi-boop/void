import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../context/FollowContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Notification } from '../../types';
import { Heart, Repeat2, User, Settings, Bell, CheckCircle2, UserCheck, UserPlus } from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { profile } = useAuth();
  const { isFollowing, toggleFollow } = useFollow();
  const [tab, setTab] = useState<'all' | 'mentions'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchNotifications = async () => {
      if (!isSupabaseConfigured) return;

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            id,
            user_id,
            actor_id,
            type,
            created_at,
            actor_profile:actor_id(*)
          `)
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const formatted = (data as unknown as any[]).map((n) => ({
            ...n,
            actor_profile: Array.isArray(n.actor_profile) ? n.actor_profile[0] : n.actor_profile,
          }));
          setNotifications(formatted);
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

  const filteredNotifs = tab === 'mentions'
    ? notifications.filter((n) => n.type === 'mention')
    : notifications;

  return (
    <main className="w-full max-w-[600px] shrink-0 min-h-screen border-r border-[#201f1f] relative pb-20 lg:pb-8 select-none">
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
            const followed = isFollowing(notif.actor_id);

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
                          onClick={() => toggleFollow(actor)}
                          className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 group ${
                            followed
                              ? 'bg-transparent border border-[#3f3f46] text-[#e5e2e1] hover:border-red-500 hover:text-red-500 hover:bg-red-950/20'
                              : 'bg-[#e5e2e1] text-black hover:bg-white'
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
                              <span>Follow Back</span>
                            </>
                          )}
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
                      <span className="font-bold">@{actor.username}</span> started following you
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

                  <span className="text-[11px] text-[#89919d] mt-1">
                    {new Date(notif.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
};
