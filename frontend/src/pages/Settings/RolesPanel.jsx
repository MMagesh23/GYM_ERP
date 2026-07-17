import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Shield, Save } from 'lucide-react';
import { roleApi } from '../../services/roleApi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';

const ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

const emptyMatrix = (modules) =>
  modules.map((m) => ({ module: m, actions: { view: false, create: false, update: false, delete: false, export: false } }));

const RolesPanel = () => {
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null); // { name, description, permissions }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: modData }, { data: roleData }] = await Promise.all([roleApi.modules(), roleApi.list()]);
      setModules(modData.data.modules);
      setRoles(roleData.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectRole = (role) => {
    setSelectedId(role._id);
    const merged = modules.map((m) => {
      const existing = role.permissions.find((p) => p.module === m);
      return existing || { module: m, actions: { view: false, create: false, update: false, delete: false, export: false } };
    });
    setDraft({ name: role.name, description: role.description, permissions: merged, isSystemRole: role.isSystemRole });
  };

  const startNew = () => {
    setSelectedId('new');
    setDraft({ name: '', description: '', permissions: emptyMatrix(modules), isSystemRole: false });
  };

  const toggleAction = (moduleName, action) => {
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.map((p) =>
        p.module === moduleName ? { ...p, actions: { ...p.actions, [action]: !p.actions[action] } } : p
      ),
    }));
  };

  const toggleAllForModule = (moduleName, value) => {
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.map((p) =>
        p.module === moduleName ? { ...p, actions: { view: value, create: value, update: value, delete: value, export: value } } : p
      ),
    }));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      if (selectedId === 'new') {
        const { data } = await roleApi.create({ name: draft.name, description: draft.description, permissions: draft.permissions });
        toast.success('Role created');
        setSelectedId(data.data._id);
      } else {
        await roleApi.update(selectedId, { name: draft.name, description: draft.description, permissions: draft.permissions });
        toast.success('Role updated');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await roleApi.remove(deleteTarget._id);
      toast.success('Role deleted');
      setDeleteTarget(null);
      setSelectedId(null);
      setDraft(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete role');
    }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading roles...</div>;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Roles</h3>
          <button
            onClick={startNew}
            className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            <Plus size={13} /> New role
          </button>
        </div>

        {roles.length === 0 ? (
          <EmptyState icon={Shield} title="No custom roles yet" description="Admin and Receptionist are built in. Create a custom role for finer-grained access." />
        ) : (
          <div className="space-y-1">
            {roles.map((r) => (
              <button
                key={r._id}
                onClick={() => selectRole(r)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  selectedId === r._id
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span>
                  {r.name}
                  {r.isSystemRole && <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">system</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        {!draft ? (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800">Select a role to view its permissions, or create a new one.</p>
        ) : (
          <div>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Role name</label>
                <input
                  disabled={draft.isSystemRole}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:disabled:bg-gray-800/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <input
                  disabled={draft.isSystemRole}
                  value={draft.description || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:disabled:bg-gray-800/50"
                />
              </div>
            </div>

            {draft.isSystemRole && (
              <p className="mb-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Admin and Receptionist are built-in roles and can't be edited here. Create a custom role to customize permissions.
              </p>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-3 py-2">Module</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-2 py-2 text-center capitalize">{a}</th>
                    ))}
                    <th className="px-2 py-2 text-center">All</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {draft.permissions.map((p) => {
                    const allOn = ACTIONS.every((a) => p.actions[a]);
                    return (
                      <tr key={p.module}>
                        <td className="px-3 py-2 capitalize">{p.module}</td>
                        {ACTIONS.map((a) => (
                          <td key={a} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              disabled={draft.isSystemRole}
                              checked={Boolean(p.actions[a])}
                              onChange={() => toggleAction(p.module, a)}
                              className="h-4 w-4"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            disabled={draft.isSystemRole}
                            checked={allOn}
                            onChange={(e) => toggleAllForModule(p.module, e.target.checked)}
                            className="h-4 w-4"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!draft.isSystemRole && (
              <div className="mt-4 flex justify-between">
                {selectedId !== 'new' && (
                  <button
                    onClick={() => setDeleteTarget({ _id: selectedId, name: draft.name })}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={14} /> Delete role
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <Save size={14} /> {saving ? 'Saving...' : 'Save role'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete role"
        message={`Delete "${deleteTarget?.name}"? Any user still assigned this role must be reassigned first.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default RolesPanel;