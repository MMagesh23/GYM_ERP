import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Snowflake, XCircle } from 'lucide-react';
import { memberApi } from '../../services/memberApi';
import { membershipApi } from '../../services/membershipApi';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import AssignMembershipModal from './AssignMembershipModal';

const MemberProfilePage = () => {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [freezeTarget, setFreezeTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memberRes, historyRes] = await Promise.all([memberApi.get(id), membershipApi.historyForMember(id)]);
      setMember(memberRes.data.data);
      setHistory(historyRes.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load member');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRenew = async (membershipId) => {
    try {
      await membershipApi.renew(membershipId);
      toast.success('Membership renewed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Renewal failed');
    }
  };

  const handleFreeze = async (days) => {
    try {
      await membershipApi.freeze(freezeTarget._id, days, 'Requested by member');
      toast.success('Membership frozen');
      setFreezeTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Freeze failed');
    }
  };

  const handleCancel = async () => {
    try {
      await membershipApi.cancel(cancelTarget._id, 'Cancelled by staff');
      toast.success('Membership cancelled');
      setCancelTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancellation failed');
    }
  };

  if (loading || !member) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="p-6">
      <Link to="/members" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to members
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h1 className="text-xl font-semibold">
            {member.firstName} {member.lastName}
          </h1>
          <p className="text-sm text-gray-500">
            {member.memberId} · {member.phone} {member.email && `· ${member.email}`}
          </p>
          <div className="mt-2">
            <Badge status={member.status} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-500">
          <span>Gender</span>
          <span className="text-gray-900 dark:text-gray-100 capitalize">{member.gender}</span>
          <span>BMI</span>
          <span className="text-gray-900 dark:text-gray-100">{member.bmi || '—'}</span>
          <span>Joined</span>
          <span className="text-gray-900 dark:text-gray-100">{new Date(member.joiningDate).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Membership History</h2>
        {!member.currentMembership && (
          <button
            onClick={() => setAssignOpen(true)}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Assign Membership
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No memberships yet.
                </td>
              </tr>
            ) : (
              history.map((h) => (
                <tr key={h._id}>
                  <td className="px-4 py-3">{h.plan?.name}</td>
                  <td className="px-4 py-3 capitalize">{h.type}</td>
                  <td className="px-4 py-3">{new Date(h.startDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{new Date(h.endDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">₹{h.finalAmount}</td>
                  <td className="px-4 py-3">
                    <Badge status={h.status} />
                  </td>
                  <td className="px-4 py-3">
                    {h.status === 'active' && (
                      <div className="flex justify-end gap-1">
                        <button title="Renew" onClick={() => handleRenew(h._id)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                          <RefreshCw size={16} />
                        </button>
                        <button title="Freeze" onClick={() => setFreezeTarget(h)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Snowflake size={16} />
                        </button>
                        <button title="Cancel" onClick={() => setCancelTarget(h)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AssignMembershipModal open={assignOpen} onClose={() => setAssignOpen(false)} onSaved={load} memberId={id} />

      <ConfirmDialog
        open={Boolean(freezeTarget)}
        title="Freeze membership"
        message="Freeze this membership for 7 days? The end date will shift accordingly."
        confirmLabel="Freeze 7 days"
        onConfirm={() => handleFreeze(7)}
        onClose={() => setFreezeTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel membership"
        message="Are you sure you want to cancel this membership? This can't be undone."
        confirmLabel="Cancel membership"
        danger
        onConfirm={handleCancel}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
};

export default MemberProfilePage;
