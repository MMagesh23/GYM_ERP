import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Copy, ExternalLink, MessageCircle, Loader2, AlertTriangle, Phone, Globe } from 'lucide-react';
import Modal from './Modal';
import { whatsappTemplateApi, whatsappLogApi } from '../../services/whatsappApi';

const TEMPLATE_TYPE_LABELS = {
  membership_expiry_reminder: 'Membership Expiry Reminder',
  membership_renewal_reminder: 'Membership Renewal Reminder',
  payment_due_reminder: 'Payment Due Reminder',
  payment_received_confirmation: 'Payment Received Confirmation',
  welcome_message: 'Welcome Message',
  general_announcement: 'General Announcement',
};

// NEW — supported message languages. Kept in sync with
// backend/models/WhatsappTemplate.js#SUPPORTED_LANGUAGES/LANGUAGE_LABELS.
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
];

/**
 * The single, reusable WhatsApp communication component — used from the
 * Dashboard's expiring-memberships section, the Members list, and the
 * Member Profile page. Never sends anything — only prepares text for staff
 * to paste into WhatsApp themselves.
 */
const WhatsAppCommunicationModal = ({
  open,
  onClose,
  member,
  membership,
  paymentId,
  defaultTemplateType = 'membership_expiry_reminder',
  defaultLanguage = 'en',
}) => {
  const [templateType, setTemplateType] = useState(defaultTemplateType);
  const [language, setLanguage] = useState(defaultLanguage);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const generate = useCallback(
    async (type, lang) => {
      if (!member?._id) return;
      setGenerating(true);
      setError(null);
      try {
        const { data } = await whatsappTemplateApi.generate(type, {
          memberId: member._id,
          membershipId: membership?._id,
          paymentId,
          language: lang,
        });
        setResult(data.data);
        whatsappLogApi.record({ memberId: member._id, templateType: type, action: 'generated' });
      } catch (err) {
        setError(err.response?.data?.message || 'Could not generate the WhatsApp message.');
      } finally {
        setGenerating(false);
      }
    },
    [member, membership, paymentId]
  );

  useEffect(() => {
    if (open) {
      setTemplateType(defaultTemplateType);
      setLanguage(defaultLanguage);
      setResult(null);
      setError(null);
      generate(defaultTemplateType, defaultLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleTemplateChange = (type) => {
    setTemplateType(type);
    generate(type, language);
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    generate(templateType, lang);
  };

  const handleCopy = async () => {
    if (!result?.message) return;
    try {
      await navigator.clipboard.writeText(result.message);
      toast.success('Message copied. Paste it into WhatsApp to send.');
    } catch (err) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = result.message;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) throw new Error('execCommand failed');
        toast.success('Message copied. Paste it into WhatsApp to send.');
      } catch (fallbackErr) {
        toast.error('Could not copy automatically — please select and copy the message text manually.');
      }
    }
    whatsappLogApi.record({ memberId: member?._id, templateType, action: 'copied' });
  };

  const handleOpenWhatsapp = () => {
    if (!result?.phone?.valid || !result?.message) return;
    const url = `https://wa.me/${result.phone.normalized}?text=${encodeURIComponent(result.message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success('WhatsApp opened with the message ready.');
    whatsappLogApi.record({ memberId: member?._id, templateType, action: 'opened' });
  };

  if (!member) return null;

  return (
    <Modal open={open} onClose={onClose} title="WhatsApp Message" size="md">
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300">
          <MessageCircle size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{member.firstName} {member.lastName || ''}</p>
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <Phone size={11} /> {member.phone || 'No phone on file'}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Template</label>
          <select
            value={templateType}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            {Object.entries(TEMPLATE_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-sm font-medium">
            <Globe size={13} /> Language
          </label>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {generating && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-10 text-sm text-gray-400 dark:border-gray-700">
          <Loader2 size={16} className="animate-spin" /> Generating message...
        </div>
      )}

      {!generating && error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            <button onClick={() => generate(templateType, language)} className="mt-1 text-xs font-medium underline hover:no-underline">
              Retry
            </button>
          </div>
        </div>
      )}

      {!generating && !error && result && (
        <>
          <div
            lang={language === 'ta' ? 'ta' : 'en'}
            className="mb-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {result.message}
          </div>

          {result.warnings?.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <ul className="list-inside list-disc space-y-0.5">
                {result.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          {!result.phone?.valid && (
            <p className="mb-3 text-xs text-gray-500">
              {result.phone?.reasonMessage || 'This phone number cannot be used to open WhatsApp directly.'} You can
              still copy the message and send it manually.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Copy size={15} /> Copy Message
            </button>
            <button
              onClick={handleOpenWhatsapp}
              disabled={!result.phone?.valid}
              title={!result.phone?.valid ? (result.phone?.reasonMessage || 'No valid phone number') : undefined}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <ExternalLink size={15} /> Open WhatsApp
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default WhatsAppCommunicationModal;