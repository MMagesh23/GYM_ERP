const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { listModules, listRoles, getRole, createRole, updateRole, deleteRole } = require('../controllers/roleController');

const router = express.Router();

router.use(protect, authorize('admin')); // role management is admin-only

router.get('/modules', listModules);
router.get('/', listRoles);
router.get('/:id', getRole);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

module.exports = router;