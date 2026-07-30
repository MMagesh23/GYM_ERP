import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, RotateCcw, Eye, Loader2 } from 'lucide-react';
import { emailTemplateApi } from '../../services/emailApi';
import Modal from '../../components/common/Modal';

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800';
const labelClass = 'mb-1 block text-sm font-medium';

const EmailTemplatesPanel = () => {
  const [templates, setTemplates] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [activeType, setActiveType] = useState(null);
  const [draft, setDraft] = useState({ subject: '', body: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [preview, setPreview] = useState(null); // { subject, body } | null
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    const { data } = await emailTemplateApi.list();
    setTemplates(data.data);
    setPlaceholders(data.placeholders || []);
    if (!activeType && data.data.length) selectTemplate(data.data[0]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTemplate = (t) => {
    setActiveType(t.type);
    setDraft({ subject: t.subject, body: t.body, isActive: t.isActive });
    setPreview(null);
  };

  const activeTemplate = templates.find((t) => t.type === activeType);

  const handleSave = async () => {
    if (!draft.subject.trim() || !draft.body.trim()) {
      toast.error('Subject and body cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await emailTemplateApi.update(activeType, draft);
      setTemplates((prev) => prev.map((t) => (t.type === activeType ? data.data : t)));
      toast.success('Template saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data } = await emailTemplateApi.reset(activeType);
      setTemplates((prev) => prev.map((t) => (t.type === activeType ? data.data : t)));
      setDraft({ subject: data.data.subject, body: data.data.body, isActive: data.data.isActive });
      toast.success('Template reset to default');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset template');
    } finally {
      setResetting(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const { data } = await emailTemplateApi.preview(activeType, { subject: draft.subject, body: draft.body });
      setPreview(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const insertPlaceholder = (token) => {
    setDraft((prev) => ({ ...prev, body: `${prev.body}{{${token}}}` }));
  };

  if (!templates.length) return <div className="text-sm text-gray-400">Loading templates...</div>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-1">
        {templates.map((t) => (
          <button
            key={t.type}
            onClick={() => selectTemplate(t)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              t.type === activeType
                ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {t.name}
            {!t.isActive && <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400 dark:bg-gray-800">off</span>}
          </button>
        ))}
      </div>

      {activeTemplate && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Subject</label>
            <input className={inputClass} value={draft.subject} onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))} />
          </div>

          <div>
            <label className={labelClass}>Body (HTML)</label>
            <textarea
              rows={12}
              className={`${inputClass} font-mono text-xs`}
              value={draft.body}
              onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Insert a placeholder:</p>
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => insertPlaceholder(p)}
                  className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
                >
                  {`{{${p}}}`}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={draft.isActive}
              onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active (automatic triggers will send this template)
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save template'}
            </button>
            <button onClick={handlePreview} disabled={previewLoading} className="btn-secondary flex items-center gap-1.5 text-sm">
              {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Preview
            </button>
            <button onClick={handleReset} disabled={resetting} className="btn-secondary flex items-center gap-1.5 text-sm">
              <RotateCcw size={16} /> Reset to default
            </button>
          </div>
        </div>
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Template preview" size="lg">
        {preview && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-400">Subject</p>
              <p className="text-sm">{preview.subject}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-gray-400">Body</p>
              <div
                className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                dangerouslySetInnerHTML={{ __html: preview.body }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmailTemplatesPanel;
