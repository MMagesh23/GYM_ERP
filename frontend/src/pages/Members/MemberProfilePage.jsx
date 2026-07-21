import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, RefreshCw, Snowflake, XCircle, Pencil, Phone, Mail, MapPin, Cake,
  Ruler, Weight, Briefcase, HeartPulse, StickyNote, ArrowRightLeft, Repeat,
  FileText, CreditCard, CalendarClock, ShieldCheck, PlayCircle,
} from 'lucide-react';
import { memberApi } from '../../services/memberApi';
import { membershipApi } from '../../services/membershipApi';
import { paymentApi } from '../../services/paymentApi';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import ProgressBar from '../../components/common/ProgressBar';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonBlock } from '../../components/common/Skeleton';
import AssignMembershipModal from './AssignMembershipModal';
import ChangePlanModal from './ChangePlanModal';
import TransferMembershipModal from './TransferMembershipModal';
import FreezeMembershipModal from './FreezeMembershipModal';
import MemberFormModal from './MemberFormModal';
import RecordPaymentModal from '../Payments/RecordPaymentModal';
import {
  daysUntil, membershipUrgency, expiryLabel, URGENCY_STYLES, formatCurrency, formatDate, billingStatusMeta,
} from '../../utils/memberHelpers';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'Membership History' },
  { key: 'payments', label: 'Payments' },
];

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800">
      <Icon size={15} />
    </span>
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{value || '—'}</p>
    </div>
  </div>
);

const MembershipTimelineCard = ({ record, onRenew, onFreeze, onUnfreeze, onChangePlan, onTransfer, onCancel, onCollectPayment }) => {
  const isActive = record.status === 'active';
  const isFrozen = record.status === 'frozen';
  const billing = record.billing;
  const meta = billing ? billingStatusMeta(billing.status) : null;
  const canCollect = billing && billing.outstanding > 0;

  return (
    <div className="relative pb-6 pl-8 last:pb-0">
      <span
        className={`absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white dark:border-gray-900 ${
          isActive ? 'bg-brand-600' : isFrozen ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      />
      <span className="absolute left-[7px] top-5 h-full w-px bg-gray-200 dark:bg-gray-800" />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{record.plan?.name || 'Plan'}</p>
            <p className="text-xs capitalize text-gray-400">
              {record.type} · {formatDate(record.startDate)} — {formatDate(record.endDate)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{formatCurrency(record.finalAmount)}</span>
              <Badge status={record.status} dot />
            </div>
            {meta && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>
                {meta.label}
                {billing.status === 'partial' && ` — ${formatCurrency(billing.outstanding)} due`}
              </span>
            )}
          </div>
        </div>

        {/* A membership never bills itself — assigning/renewing/changing one only
            records the debt, nothing ever creates a Payment automatically. This is
            the one place on the timeline where that debt can be collected without
            leaving the page or re-searching for the member on the Payments screen. */}
        {canCollect && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-2.5 dark:border-amber-800 dark:bg-amber-950/30">
            <span className="text-xs text-amber-800 dark:text-amber-300">
              {formatCurrency(billing.outstanding)} not yet collected for this membership.
            </span>
            <button
              onClick={() => onCollectPayment(record)}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              <CreditCard size={12} /> Collect Payment
            </button>
          </div>
        )}

        {isActive && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
            <button
              onClick={() => onRenew(record)}
              aria-label="Renew membership"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RefreshCw size={13} /> Renew
            </button>
            <button
              onClick={() => onFreeze(record)}
              aria-label="Freeze membership"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Snowflake size={13} /> Freeze
            </button>
            <button
              onClick={() => onChangePlan(record)}
              aria-label="Change plan"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Repeat size={13} /> Change plan
            </button>
            <button
              onClick={() => onTransfer(record)}
              aria-label="Transfer membership"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <ArrowRightLeft size={13} /> Transfer
            </button>
            <button
              onClick={() => onCancel(record)}
              aria-label="Cancel membership"
              className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
            >
              <XCircle size={13} /> Cancel
            </button>
          </div>
        )}

        {isFrozen && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
            <p className="mr-1 text-xs text-gray-400">
              Frozen — resume to restore normal billing dates. Unfreezing early credits back any unused freeze days.
            </p>
            <button
              onClick={() => onUnfreeze(record)}
              aria-label="Unfreeze membership"
              className="flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              <PlayCircle size={13} /> Unfreeze
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MemberProfilePage = () => {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [history, setHistory] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [changePlanTarget, setChangePlanTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [freezeTarget, setFreezeTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [unfreezeTarget, setUnfreezeTarget] = useState(null);
  // Membership currently offered for payment collection — either the staff
  // clicked "Collect Payment" on a timeline card, or a membership was just
  // assigned/renewed/changed and still has money owed on it.
  const [collectPaymentFor, setCollectPaymentFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memberRes, historyRes, paymentsRes] = await Promise.all([
        memberApi.get(id),
        membershipApi.historyForMember(id),
        paymentApi.list({ memberId: id, limit: 50 }),
      ]);
      setMember(memberRes.data.data);
      setHistory(historyRes.data.data);
      setPayments(paymentsRes.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load member');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // A membership never bills itself — assign/renew/change-plan only create the
  // debt (finalAmount), never a Payment. Whenever one of those actions leaves an
  // outstanding balance, immediately offer to collect it instead of relying on
  // staff to remember to do it later from the separate Payments screen.
  const offerPaymentCollectionIfDue = (membership) => {
    if (membership?.billing?.outstanding > 0) {
      setCollectPaymentFor(membership);
    }
  };

  const handleAssignSaved = (membership) => {
    load();
    offerPaymentCollectionIfDue(membership);
  };

  const handleChangePlanSaved = (membership) => {
    load();
    offerPaymentCollectionIfDue(membership);
  };

  const handleRenew = async (membership) => {
    try {
      const { data } = await membershipApi.renew(membership._id);
      toast.success('Membership renewed');
      load();
      offerPaymentCollectionIfDue(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Renewal failed');
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

  const handleUnfreeze = async () => {
    try {
      await membershipApi.unfreeze(unfreezeTarget._id);
      toast.success('Membership unfrozen — active again');
      setUnfreezeTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not unfreeze membership');
    }
  };

  const activeMembership = useMemo(
    () => member?.currentMembership || history.find((h) => h.status === 'active' || h.status === 'frozen') || null,
    [member, history]
  );

  const membershipDaysLeft = activeMembership ? daysUntil(activeMembership.endDate) : null;
  const urgency = membershipUrgency(membershipDaysLeft);

  const membershipProgress = useMemo(() => {
    if (!activeMembership) return 0;
    const start = new Date(activeMembership.startDate).getTime();
    const end = new Date(activeMembership.endDate).getTime();
    const now = Date.now();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  }, [activeMembership]);

  // FIX: previously summed `finalAmount` (invoiced total) for every non-refunded
  // payment, which overstated "Total Paid" for any 'partial' payment (counted as
  // if fully collected) and understated it for 'pending'/'failed' payments that
  // should contribute 0. Now sums the actual collected amount (amountPaid,
  // falling back to finalAmount for legacy pre-migration records) minus refunds,
  // and explicitly skips payments where nothing was collected.
  const totalPaid = useMemo(
    () =>
      payments.reduce((sum, p) => {
        if (p.status === 'pending' || p.status === 'failed') return sum;
        const collected = p.amountPaid ?? p.finalAmount;
        return sum + collected - (p.refund?.refundedAmount || 0);
      }, 0),
    [payments]
  );

  // FIX: previously scanned only Payment records with status pending/partial —
  // which is exactly the case that's silently wrong right after a membership is
  // assigned/renewed/changed, since none of those create a Payment on their own.
  // A membership with zero payment records still owes its full finalAmount; this
  // now sums the same `billing.outstanding` figure the timeline cards use, so the
  // two can never disagree.
  const outstandingBalance = useMemo(
    () => history.reduce((sum, h) => sum + (h.billing?.outstanding || 0), 0),
    [history]
  );

  if (loading || !member) {
    return (
      <div className="p-6">
        <SkeletonBlock className="mb-4 h-8 w-40" />
        <SkeletonBlock className="mb-6 h-40 rounded-2xl" />
        <SkeletonBlock className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <Link to="/members" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft size={16} /> Back to members
      </Link>

      {/* Hero */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
        <div className="h-16 bg-gradient-to-r from-brand-500 to-brand-700" />
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5">
          <div className="-mt-8 flex items-end gap-4">
            <Avatar firstName={member.firstName} lastName={member.lastName} photo={member.photo} size="xl" ring />
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">
                  {member.firstName} {member.lastName}
                </h1>
                <Badge status={member.status} dot />
              </div>
              <p className="text-sm text-gray-500">{member.memberId}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {member.phone && (
              <a href={`tel:${member.phone}`} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                <Phone size={14} /> Call
              </a>
            )}
            {member.email && (
              <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                <Mail size={14} /> Email
              </a>
            )}
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Pencil size={14} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck size={13} /> Current Plan
          </p>
          <p className="text-lg font-semibold">{activeMembership?.plan?.name || 'No active plan'}</p>
          {activeMembership && <p className="text-xs text-gray-400">{formatCurrency(activeMembership.finalAmount)}</p>}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
            <CalendarClock size={13} /> Membership Status
          </p>
          {activeMembership ? (
            <>
              <p className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[urgency]}`}>
                {activeMembership.status === 'frozen' ? 'Frozen' : expiryLabel(membershipDaysLeft)}
              </p>
              <ProgressBar percent={membershipProgress} tone={urgency === 'ok' ? 'brand' : urgency} />
            </>
          ) : (
            <button onClick={() => setAssignOpen(true)} className="text-sm font-medium text-brand-600 hover:underline">
              Assign a membership →
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
            <CreditCard size={13} /> Total Paid
          </p>
          <p className="text-lg font-semibold">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-gray-400">
            {payments.length} payment{payments.length === 1 ? '' : 's'}
            {outstandingBalance > 0 && (
              <span className="text-amber-600 dark:text-amber-400"> · {formatCurrency(outstandingBalance)} outstanding</span>
            )}
          </p>
          {outstandingBalance > 0 && (
            <button
              onClick={() => setCollectPaymentFor(history.find((h) => h.billing?.outstanding > 0) || activeMembership)}
              className="mt-2 text-xs font-medium text-brand-600 hover:underline"
            >
              Collect payment →
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
            <Cake size={13} /> Member Since
          </p>
          <p className="text-lg font-semibold">{formatDate(member.joiningDate)}</p>
          <p className="text-xs text-gray-400">BMI {member.bmi || '—'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.key === 'history' && history.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
                {history.length}
              </span>
            )}
            {t.key === 'payments' && payments.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
                {payments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-1 text-sm font-semibold">Personal details</h3>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
              <InfoRow icon={Cake} label="Date of birth" value={member.dob ? formatDate(member.dob) : null} />
              <InfoRow icon={Briefcase} label="Occupation" value={member.occupation} />
              <InfoRow icon={MapPin} label="Address" value={member.address} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-1 text-sm font-semibold">Health & physical</h3>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
              <InfoRow icon={Ruler} label="Height" value={member.height ? `${member.height} cm` : null} />
              <InfoRow icon={Weight} label="Weight" value={member.weight ? `${member.weight} kg` : null} />
              <InfoRow icon={HeartPulse} label="Medical conditions" value={member.medicalConditions} />
            </div>
          </div>

          {member.notes && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <StickyNote size={14} /> Notes
              </h3>
              <p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{member.notes}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Full lifecycle of this member's memberships, most recent first.</p>
            {!activeMembership && (
              <button onClick={() => setAssignOpen(true)} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Assign Membership
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No memberships yet" description="Assign a plan to start this member's journey." />
          ) : (
            <div className="pl-1">
              {history.map((h) => (
                <MembershipTimelineCard
                  key={h._id}
                  record={h}
                  onRenew={handleRenew}
                  onFreeze={setFreezeTarget}
                  onUnfreeze={setUnfreezeTarget}
                  onChangePlan={setChangePlanTarget}
                  onTransfer={setTransferTarget}
                  onCancel={setCancelTarget}
                  onCollectPayment={setCollectPaymentFor}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments yet" description="Payments recorded for this member will show up here." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {payments.map((p) => {
                  const outstanding = Math.max(p.finalAmount - (p.amountPaid ?? p.finalAmount), 0);
                  return (
                    <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-medium">{p.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        {formatCurrency(p.finalAmount)}
                        {p.status === 'partial' && outstanding > 0 && (
                          <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">({formatCurrency(outstanding)} due)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">{p.paymentMethod.replace('_', ' ')}</td>
                      <td className="px-4 py-3">{formatDate(p.paymentDate)}</td>
                      <td className="px-4 py-3">
                        <Badge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          title="Download invoice"
                          aria-label="Download invoice"
                          onClick={() => paymentApi.downloadInvoice(p._id, p.invoiceNumber)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <FileText size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      <MemberFormModal open={editOpen} member={member} onClose={() => setEditOpen(false)} onSaved={load} />
      <AssignMembershipModal open={assignOpen} onClose={() => setAssignOpen(false)} onSaved={handleAssignSaved} memberId={id} />
      <ChangePlanModal open={Boolean(changePlanTarget)} membership={changePlanTarget} onClose={() => setChangePlanTarget(null)} onSaved={handleChangePlanSaved} />
      <TransferMembershipModal
        open={Boolean(transferTarget)}
        membership={transferTarget}
        currentMemberName={`${member.firstName} ${member.lastName || ''}`.trim()}
        onClose={() => setTransferTarget(null)}
        onSaved={load}
      />
      <FreezeMembershipModal open={Boolean(freezeTarget)} membership={freezeTarget} onClose={() => setFreezeTarget(null)} onSaved={load} />

      {/* Guided assign/renew/change-plan → collect payment flow, and the
          "Collect Payment" action on timeline cards / the Total Paid stat — all
          funnel through here, pre-scoped to this member so nobody has to
          re-search for them on the separate Payments screen. */}
      <RecordPaymentModal
        open={Boolean(collectPaymentFor)}
        onClose={() => setCollectPaymentFor(null)}
        onSaved={load}
        presetMember={member}
        presetMembership={collectPaymentFor}
        title="Collect Payment"
        helperNote={`${collectPaymentFor?.plan?.name || 'This membership'} was ${
          collectPaymentFor?.type === 'renewal' ? 'renewed' : collectPaymentFor?.type === 'new' ? 'assigned' : 'updated'
        } — record what's been collected for it to keep billing in sync.`}
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

      <ConfirmDialog
        open={Boolean(unfreezeTarget)}
        title="Unfreeze membership"
        message="Resume this membership now? It will become active again immediately. If you're returning before the full freeze period was used, any unused days will be credited back automatically."
        confirmLabel="Unfreeze"
        onConfirm={handleUnfreeze}
        onClose={() => setUnfreezeTarget(null)}
      />
    </div>
  );
};

export default MemberProfilePage;