const ApiError = require('../utils/ApiError');

// Usage: router.post('/members', protect, authorize('admin'), createMember)
// Admin always passes; list any additional roles allowed besides admin.
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
  if (req.user.role === 'admin') return next(); // admin has full access
  if (allowedRoles.includes(req.user.role)) return next();
  return next(new ApiError(403, 'You do not have permission to perform this action.'));
};

// Usage: router.delete('/members/:id', protect, can('members', 'delete'), deleteMember)
// Checks the granular permission matrix on req.user.roleRef (populated Role doc), if present.
// Falls back to the simple admin/receptionist role check when no custom Role is attached.
const can = (moduleName, action) => async (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
  if (req.user.role === 'admin') return next();

  await req.user.populate('roleRef');
  const roleDoc = req.user.roleRef;

  if (!roleDoc) {
    // Receptionists without a custom role get read-only access by default
    if (action === 'view') return next();
    return next(new ApiError(403, `You do not have permission to ${action} ${moduleName}.`));
  }

  const perm = roleDoc.permissions.find((p) => p.module === moduleName);
  if (perm && perm.actions[action]) return next();

  return next(new ApiError(403, `You do not have permission to ${action} ${moduleName}.`));
};

module.exports = { authorize, can };
