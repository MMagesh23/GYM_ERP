import { useEffect, useState, useRef } from 'react';
import { Bell, RefreshCw, BellOff, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { notificationApi } from '../../services/notificationApi';

// Groups notifications into rough time buckets purely for display.
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const NotificationBell = () => {
  const { user } = useSelector((state) => state.auth);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await notificationApi.list({ limit: 10 });
      setNotifications(data.data);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      // Silent - the bell just won't update
    }
  };

  useEffect(() => {
    load();

    let interval;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(load, 60000);
    };
    const stopPolling = () => {
      clearInterval(interval);
      interval = undefined;
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        load();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    // FIX: Escape now closes the panel too — previously only an outside
    // click did, which is inconsistent with every other overlay in the app
    // (Modal, CommandPalette) and traps keyboard users.
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleMarkRead = async (id) => {
    await notificationApi.markRead(id);
    load();
  };

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead();
    load();
  };

  const handleGenerate = async () => {
    try {
      const { data } = await notificationApi.generateNow();
      toast.success(`Generated ${data.data.total} notification(s)`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate notifications');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        className={`relative rounded-xl p-2 text-gray-500 transition hover:bg-white/40 dark:hover:bg-white/5 ${
          open ? 'bg-white/50 text-gray-700 dark:bg-white/10 dark:text-gray-200' : ''
        }`}
      >
        <Bell size={18} className={unreadCount > 0 ? 'animate-bell-nudge' : ''} />
        {unreadCount > 0 && (
          // FIX: badge is now anchored flush to the icon's top-right corner
          // and ring-matched to the header glass so it reads as attached to
          // the bell rather than floating loose next to it.
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white/70 dark:ring-gray-900/70">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // FIX: was a fixed w-80 with no viewport clamp — it overflowed the
        // screen edge on small phones. Now clamped to the viewport width.
        <div className="glass-modal absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] animate-scale-in overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/30 px-4 py-2.5 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-900/40 dark:text-red-300">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {user?.role === 'admin' && (
                <button
                  title="Generate now"
                  aria-label="Generate notifications now"
                  onClick={handleGenerate}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/40 hover:text-gray-600 dark:hover:bg-white/10"
                >
                  <RefreshCw size={14} />
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-white/40 dark:hover:bg-white/10"
                >
                  <Check size={12} /> Mark all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-9 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/50 text-gray-300 dark:bg-white/5 dark:text-gray-600">
                  <BellOff size={18} />
                </span>
                <p className="text-sm text-gray-400">You're all caught up</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = n.status !== 'read';
                return (
                  <button
                    key={n._id}
                    onClick={() => handleMarkRead(n._id)}
                    className={`relative block w-full border-b border-white/20 px-4 py-2.5 text-left text-sm transition last:border-0 hover:bg-white/40 dark:border-white/5 dark:hover:bg-white/5 ${
                      isUnread ? 'bg-brand-500/5' : ''
                    }`}
                  >
                    {/* Unread marker rail — clearer at a glance than the old
                        whole-row tint alone, which was nearly invisible. */}
                    {isUnread && (
                      <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand-500" />
                    )}
                    <p className={`${isUnread ? 'font-semibold' : 'font-medium'} truncate`}>{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.message}</p>
                    <p className="mt-1 text-[10px] text-gray-400">{timeAgo(n.createdAt)}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
