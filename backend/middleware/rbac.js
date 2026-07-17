const ApiError = require('../utils/ApiError');

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
  if (req.user.role === 'admin') return next();
  if (allowedRoles.includes(req.user.role)) return next();
  return next(new ApiError(403, 'You do not have permission to perform this action.'));
};

// Modules a plain receptionist (no custom Role assigned) could already reach via
// unrestricted routes before this — kept as the safe default so converting
// authorize('admin')-only routes to can() below never *loosens* access.
const OPEN_BY_DEFAULT_MODULES = ['dashboard', 'members', 'memberships', 'payments', 'equipment', 'notifications'];

const can = (moduleName, action) => async (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
  if (req.user.role === 'admin') return next();

  await req.user.populate('roleRef');
  const roleDoc = req.user.roleRef;

  if (!roleDoc) {
    if (action === 'view' && OPEN_BY_DEFAULT_MODULES.includes(moduleName)) return next();
    return next(new ApiError(403, `You do not have permission to ${action} ${moduleName}.`));
  }

  const perm = roleDoc.permissions.find((p) => p.module === moduleName);
  if (perm && perm.actions[action]) return next();

  return next(new ApiError(403, `You do not have permission to ${action} ${moduleName}.`));
};

module.exports = { authorize, can };