// frontend/src/pages/Settings/SessionsPanel.jsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Laptop, LogOut } from 'lucide-react';
import { sessionApi } from '../../services/sessionApi';

const SessionsPanel = () => {
  const [sessions, setSessions] = useState([]);

  const load = () => sessionApi.list().then(({ data }) => setSessions(data.data));
  useEffect(() => { load(); }, []);

  const revoke = async (id) => {
    try {
      await sessionApi.revoke(id);
      toast.success('Session revoked');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not revoke session');
    }
  };

  const revokeOthers = async () => {
    try {
      await sessionApi.revokeOthers();
      toast.success('Other sessions revoked');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not revoke sessions');
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Active sessions</h3>
        <button onClick={revokeOthers} className="text-xs text-red-500 hover:underline">Log out other devices</button>
      </div>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s._id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Laptop size={16} className="text-gray-400" />
              <div>
                <p className="font-medium">{s.deviceLabel || 'Unknown device'}</p>
                <p className="text-xs text-gray-400">{s.ipAddress} · last active {new Date(s.lastActiveAt).toLocaleString()}</p>
              </div>
            </div>
            <button onClick={() => revoke(s._id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40">
              <LogOut size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SessionsPanel;