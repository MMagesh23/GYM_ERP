import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Save } from 'lucide-react';
import { settingsApi } from '../../services/settingsApi';
import { roleApi } from '../../services/roleApi';
import { staffApi } from '../../services/staffApi';
import ChangePasswordPanel from './ChangePasswordPanel';
import SessionsPanel from './SessionsPanel';
import BusinessHoursPanel from './BusinessHoursPanel';
import RolesPanel from './RolesPanel';
import OverviewPanel from './OverviewPanel';
import DashboardWidgetsPanel from './DashboardWidgetsPanel';

const TABS = ['Overview', 'General', 'Branding', 'Invoicing', 'Business Hours', 'Roles & Permissions', 'Features', 'Security'];

const SettingsPage = () => {
  const [tab, setTab] = useState('Overview');
  const [settings, setSettings] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [roleCount, setRoleCount] = useState(null);
  const [staffCount, setStaffCount] = useState(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const load = async () => {
    const { data } = await settingsApi.get();
    setSettings(data.data);
    reset(data.data);
  };

  useEffect(() => {
    load();
    roleApi.list().then(({ data }) => setRoleCount(data.data.length)).catch(() => {});
    staffApi.list({ limit: 1 }).then(({ data }) => setStaffCount(data.pagination?.total)).catch(() => {});
  }, []);

  const onSubmit = async (formData) => {
    try {
      await settingsApi.update(formData);
      if (logoFile) {
        await settingsApi.uploadLogo(logoFile);
        setLogoFile(null);
      }
      toast.success('Settings saved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save settings');
    }
  };

  if (!settings) return <div className="p-6 text-sm text-gray-400">Loading settings...</div>;

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800';
  const labelClass = 'mb-1 block text-sm font-medium';

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-gray-500">Customize your gym's identity, invoicing, roles, and system behavior.</p>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <OverviewPanel settings={settings} roleCount={roleCount} staffCount={staffCount} onNavigate={setTab} />
      )}

      {tab === 'Roles & Permissions' && <RolesPanel />}

      {tab === 'Business Hours' && (
        <BusinessHoursPanel initial={settings.businessHours} onSaved={(updated) => setSettings(updated)} />
      )}

      <DashboardWidgetsPanel initial={settings.dashboardWidgets} onSaved={setSettings} />

      {tab !== 'Overview' && tab !== 'Roles & Permissions' && tab !== 'Business Hours' && (
        <form onSubmit={handleSubmit(onSubmit)}>
          {tab === 'General' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Gym Name</label><input className={inputClass} {...register('gymName')} /></div>
              <div><label className={labelClass}>Tagline</label><input className={inputClass} {...register('tagline')} /></div>
              <div><label className={labelClass}>Contact Number</label><input className={inputClass} {...register('contactNumber')} /></div>
              <div><label className={labelClass}>Email</label><input className={inputClass} {...register('email')} /></div>
              <div><label className={labelClass}>Website</label><input className={inputClass} {...register('website')} /></div>
              <div><label className={labelClass}>GST Number</label><input className={inputClass} {...register('gstNumber')} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Address</label><textarea rows={2} className={inputClass} {...register('address')} /></div>
              <div><label className={labelClass}>Currency Symbol</label><input className={inputClass} {...register('currencySymbol')} /></div>
              <div><label className={labelClass}>Currency Code</label><input className={inputClass} {...register('currencyCode')} /></div>
              <div><label className={labelClass}>Member ID Prefix</label><input className={inputClass} {...register('memberIdPrefix')} /></div>
              <div><label className={labelClass}>Default Tax (%)</label><input type="number" step="0.01" className={inputClass} {...register('taxPercentage')} /></div>
              <div><label className={labelClass}>Default Grace Period (days)</label><input type="number" className={inputClass} {...register('defaultGracePeriodDays')} /></div>
              <div><label className={labelClass}>Financial Year Start Month</label>
                <select className={inputClass} {...register('financialYearStartMonth')}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 'Branding' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Logo</label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                    {logoPreview || settings.gymLogo ? (
                      <img src={logoPreview || settings.gymLogo} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon size={22} className="text-gray-300" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setLogoFile(f || null);
                      if (f) setLogoPreview(URL.createObjectURL(f));
                    }}
                    className="text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">PNG or SVG on a transparent background works best. Saved when you click Save below.</p>
              </div>
              <div>
                <label className={labelClass}>Brand Color</label>
                <input type="color" className="h-10 w-20 rounded-lg border border-gray-300 dark:border-gray-700" {...register('brandColor')} />
              </div>
              <div>
                <label className={labelClass}>Accent Color</label>
                <input type="color" className="h-10 w-20 rounded-lg border border-gray-300 dark:border-gray-700" {...register('accentColor')} />
              </div>
            </div>
          )}

          {tab === 'Invoicing' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Invoice Prefix</label><input className={inputClass} {...register('invoicePrefix')} /></div>
              <div><label className={labelClass}>Number Padding</label><input type="number" className={inputClass} {...register('invoiceNumberPadding')} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Terms & Conditions</label><textarea rows={3} className={inputClass} {...register('invoiceTerms')} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Receipt Footer Message</label><input className={inputClass} {...register('receiptFooterMessage')} /></div>
            </div>
          )}

          {tab === 'Features' && (
            <div>
              <p className="mb-3 text-sm text-gray-500">Toggling a module off hides it from the sidebar and disables its API routes for everyone, immediately.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.keys(settings.features || {}).map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                    <input type="checkbox" className="h-4 w-4" {...register(`features.${key}`)} />
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === 'Security' && (
            <div className="space-y-8">
              <ChangePasswordPanel />
              <div className="border-t border-gray-100 pt-6 dark:border-gray-800">
                <SessionsPanel />
              </div>
            </div>
          )}

          {tab !== 'Security' && (
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Save size={16} /> {isSubmitting ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default SettingsPage;