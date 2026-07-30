import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Save, Wifi, WifiOff, Loader2, Send, ShieldCheck } from 'lucide-react';
import { emailSettingsApi } from '../../services/emailApi';

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800';
const labelClass = 'mb-1 block text-sm font-medium';

// Small self-contained status pill so both the form header and the "test
// connection" result reuse the exact same visual language.
const StatusPill = ({ status }) => {
  const map = {
    success: { icon: Wifi, cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: 'Connected' },
    failed: { icon: WifiOff, cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', label: 'Connection failed' },
    unverified: { icon: WifiOff, cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', label: 'Not verified yet' },
  };
  const { icon: Icon, cls, label } = map[status] || map.unverified;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon size={13} /> {label}
    </span>
  );
};

const EmailSettingsPanel = () => {
  const [settings, setSettings] = useState(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm();

  const enabled = watch('enabled');

  const load = async () => {
    const { data } = await emailSettingsApi.get();
    setSettings(data.data);
    reset({
      gmailAddress: data.data.gmailAddress || '',
      appPassword: '', // never pre-filled - see backend note in emailSettingsController
      senderName: data.data.senderName || '',
      replyTo: data.data.replyTo || '',
      enabled: data.data.enabled,
    });
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (formData) => {
    try {
      // Don't send an empty appPassword - that would be interpreted as "clear it"
      // by any naive backend, so omit entirely rather than send ''.
      const payload = { ...formData };
      if (!payload.appPassword) delete payload.appPassword;

      const { data } = await emailSettingsApi.update(payload);
      setSettings(data.data);
      reset({ ...payload, appPassword: '' });
      toast.success('Email settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save email settings');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data } = await emailSettingsApi.testConnection();
      if (data.success) toast.success(data.message || 'Connected successfully');
      else toast.error(data.message || 'Connection failed');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmailAddress) {
      toast.error('Enter an email address to send the test to.');
      return;
    }
    setSendingTest(true);
    try {
      const { data } = await emailSettingsApi.sendTest(testEmailAddress);
      toast.success(data.message || 'Test email sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send test email');
    } finally {
      setSendingTest(false);
    }
  };

  if (!settings) return <div className="text-sm text-gray-400">Loading email settings...</div>;

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Gmail SMTP configuration</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Use a Gmail App Password, not your regular Gmail password. Generate one at{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                myaccount.google.com/apppasswords
              </a>{' '}
              (requires 2-Step Verification enabled on the Gmail account).
            </p>
          </div>
          <StatusPill status={settings.lastVerifyStatus} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Gmail Email Address</label>
            <input type="email" placeholder="yourgym@gmail.com" className={inputClass} {...register('gmailAddress')} />
          </div>
          <div>
            <label className={labelClass}>
              App Password{' '}
              {settings.hasAppPassword && (
                <span className="text-xs font-normal text-gray-400">(already set — leave blank to keep it)</span>
              )}
            </label>
            <input
              type="password"
              placeholder={settings.hasAppPassword ? '••••••••••••••••' : '16-character app password'}
              className={inputClass}
              {...register('appPassword')}
            />
          </div>
          <div>
            <label className={labelClass}>Sender Name</label>
            <input placeholder="Gym ERP" className={inputClass} {...register('senderName')} />
          </div>
          <div>
            <label className={labelClass}>Reply-To Email</label>
            <input type="email" placeholder="frontdesk@yourgym.com" className={inputClass} {...register('replyTo')} />
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700">
          <input type="checkbox" className="h-4 w-4" {...register('enabled')} />
          <span className="font-medium">Enable email service</span>
          <span className="text-gray-400">— when off, no automatic or manual emails are sent.</span>
        </label>
        {!enabled && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Email sending is currently disabled. Welcome, registration, renewal, expiry, payment, and password-reset
            emails will not go out until this is enabled.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Save size={16} /> {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {testing ? 'Testing...' : 'Test connection'}
          </button>
        </div>
        {settings.lastVerifiedAt && (
          <p className="text-xs text-gray-400">
            Last checked {new Date(settings.lastVerifiedAt).toLocaleString()}
            {settings.lastVerifyStatus === 'failed' && settings.lastVerifyError ? ` — ${settings.lastVerifyError}` : ''}
          </p>
        )}
      </form>

      <div className="border-t border-gray-100 pt-6 dark:border-gray-800">
        <h3 className="mb-1 text-sm font-semibold">Send a test email</h3>
        <p className="mb-3 text-xs text-gray-400">Sends a real email using the settings above — save your changes first.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            placeholder="you@example.com"
            className={`${inputClass} sm:max-w-xs`}
            value={testEmailAddress}
            onChange={(e) => setTestEmailAddress(e.target.value)}
          />
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sendingTest}
            className="btn-secondary flex items-center justify-center gap-1.5 text-sm"
          >
            {sendingTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sendingTest ? 'Sending...' : 'Send test email'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailSettingsPanel;
