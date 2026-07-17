import { CheckCircle2, XCircle, Building2, Users, Shield, Bell } from 'lucide-react';

const StatusRow = ({ label, ok, hint }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
    {ok ? (
      <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
        <CheckCircle2 size={14} /> Enabled
      </span>
    ) : (
      <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
        <XCircle size={14} /> Off
      </span>
    )}
  </div>
);

const OverviewPanel = ({ settings, roleCount, staffCount, onNavigate }) => {
  const features = settings.features || {};

  const cards = [
    { icon: Building2, label: 'Gym identity', value: settings.gymName, sub: settings.address || 'No address set', tab: 'General' },
    { icon: Users, label: 'Staff accounts', value: staffCount ?? '—', sub: 'Active receptionist/admin logins', tab: 'Security' },
    { icon: Shield, label: 'Custom roles', value: roleCount ?? '—', sub: 'Beyond the built-in Admin/Receptionist', tab: 'Roles & Permissions' },
    { icon: Bell, label: 'Currency', value: `${settings.currencySymbol} (${settings.currencyCode})`, sub: `Tax default: ${settings.taxPercentage}%`, tab: 'General' },
  ];

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => onNavigate(c.tab)}
            className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-card transition hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900"
          >
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
              <c.icon size={16} />
            </span>
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className="mt-0.5 truncate text-base font-semibold">{c.value}</p>
            <p className="mt-0.5 truncate text-xs text-gray-400">{c.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-1 text-sm font-semibold">Modules</h3>
          <p className="mb-2 text-xs text-gray-400">Disabling a module hides it from navigation and blocks its API routes.</p>
          <StatusRow label="Equipment tracking" ok={features.equipmentModule} />
          <StatusRow label="Finance (expenses, profit reports)" ok={features.financeModule} />
          <StatusRow label="Reports" ok={features.reportsModule} />
          <StatusRow label="QR code member IDs" ok={features.qrCode} />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-1 text-sm font-semibold">Notification delivery</h3>
          <p className="mb-2 text-xs text-gray-400">In-app notifications always run. Email/SMS/WhatsApp require provider setup — not yet connected.</p>
          <StatusRow label="In-app (system)" ok={true} hint="Always on" />
          <StatusRow label="Email" ok={false} hint="No SMTP provider connected" />
          <StatusRow label="SMS" ok={false} hint="No provider connected" />
          <StatusRow label="WhatsApp" ok={false} hint="No provider connected" />
        </div>
      </div>
    </div>
  );
};

export default OverviewPanel;