// Maps each widget key to the module/action it requires (via the existing `can`
// semantics) and to the response fields it owns. Financial widgets are gated on
// the 'expenses' module (mirrors financeModule elsewhere in the app) since profit
// figures are derived from expenses; everything else is gated on 'dashboard'.
const WIDGET_DEFS = {
  totalMembers: { module: 'members', summaryFields: ['totalMembers'] },
  activeMembers: { module: 'members', summaryFields: ['activeMembers'] },
  expiredMembers: { module: 'members', summaryFields: ['expiredMembers'] },
  newMembersThisMonth: { module: 'members', summaryFields: ['newMembersThisMonth'] },
  monthlyRevenue: { module: 'payments', summaryFields: ['monthlyRevenue'] },
  monthlyExpenses: { module: 'expenses', summaryFields: ['monthlyExpenses'] },
  netProfit: { module: 'expenses', summaryFields: ['netProfit'] },
  equipmentCount: { module: 'equipment', summaryFields: ['equipmentCount'] },
  membershipsExpiringSoon: { module: 'memberships', summaryFields: ['membershipsExpiringSoon'] },
  pendingPayments: { module: 'payments', summaryFields: ['pendingPayments', 'pendingPaymentsCount'] },
  revenueChart: { module: 'payments', chartFields: ['revenueByMonth'] },
  membershipGrowthChart: { module: 'members', chartFields: ['membershipGrowth'] },
  profitChart: { module: 'expenses', chartFields: ['profitByMonth', 'expenseByMonth'] },
  planDistributionChart: { module: 'memberships', chartFields: ['planDistribution'] },
};

// Given a user + Settings doc, returns the widget keys they're allowed to see:
// the intersection of (a) what's configured for their role and (b) what their
// permission matrix (system role bypass, or Role.permissions) actually grants view on.
const resolveAllowedWidgets = async (user, settings) => {
  const configured = settings.dashboardWidgets?.[user.role] || settings.dashboardWidgets?.admin || [];
  if (user.role === 'admin') return configured; // admins bypass the permission check, same as can()

  await user.populate('roleRef');
  const roleDoc = user.roleRef;
  const canView = (moduleName) => {
    if (!roleDoc) {
      // Mirrors OPEN_BY_DEFAULT_MODULES in middleware/rbac.js
      return ['dashboard', 'members', 'memberships', 'payments', 'equipment', 'notifications'].includes(moduleName);
    }
    const perm = roleDoc.permissions.find((p) => p.module === moduleName);
    return Boolean(perm?.actions?.view);
  };

  return configured.filter((key) => canView(WIDGET_DEFS[key]?.module));
};

const pickFields = (source, allowedWidgets, kind) => {
  const allowedFields = new Set();
  allowedWidgets.forEach((key) => (WIDGET_DEFS[key]?.[kind] || []).forEach((f) => allowedFields.add(f)));
  return Object.fromEntries(Object.entries(source).filter(([k]) => allowedFields.has(k)));
};

module.exports = { WIDGET_DEFS, resolveAllowedWidgets, pickFields };