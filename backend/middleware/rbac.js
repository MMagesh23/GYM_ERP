const ApiError = require('../utils/ApiError');

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
  if (req.user.role === 'admin') return next();
  if (allowedRoles.includes(req.user.role)) return next();
  return next(new ApiError(403, 'You do not have permission to perform this action.'));
};

const OPEN_BY_DEFAULT_MODULES = ['dashboard', 'members', 'memberships', 'payments', 'equipment', 'notifications'];
const OPEN_BY_DEFAULT_ACTIONS = ['view', 'create', 'update']; // matches seed.js default Receptionist role; delete/export excluded

// NEW — the same module/action check `can()` does, extracted into a plain
// boolean-returning function so controllers can ask "does this user have
// permission X" inline (e.g. to decide whether to include finance data in a
// response body) without needing a full middleware/next() chain.
const hasPermission = async (user, moduleName, action) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  await user.populate('roleRef');
  const roleDoc = user.roleRef;

  if (!roleDoc) {
    return OPEN_BY_DEFAULT_MODULES.includes(moduleName) && OPEN_BY_DEFAULT_ACTIONS.includes(action);
  }

  const perm = roleDoc.permissions.find((p) => p.module === moduleName);
  return Boolean(perm && perm.actions[action]);
};

const can = (moduleName, action) => async (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
  const allowed = await hasPermission(req.user, moduleName, action);
  if (allowed) return next();
  return next(new ApiError(403, `You do not have permission to ${action} ${moduleName}.`));
};

module.exports = { authorize, can, hasPermission };