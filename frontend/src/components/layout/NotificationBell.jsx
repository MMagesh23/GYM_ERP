import { useEffect, useState, useRef } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { notificationApi } from '../../services/notificationApi';

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
        load(); // catch up immediately on refocus
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
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-2">
              {user?.role === 'admin' && (
                <button title="Generate now" onClick={handleGenerate} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <RefreshCw size={14} />
                </button>
              )}
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-brand-600 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleMarkRead(n._id)}
                  className={`block w-full border-b border-gray-50 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50 ${
                    n.status !== 'read' ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''
                  }`}
                >
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{n.message}</p>
                  <p className="mt-1 text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
