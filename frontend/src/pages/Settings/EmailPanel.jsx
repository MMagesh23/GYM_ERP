import { useState } from 'react';
import EmailSettingsPanel from './EmailSettingsPanel';
import EmailTemplatesPanel from './EmailTemplatesPanel';
import EmailHistoryPanel from './EmailHistoryPanel';

const SUB_TABS = ['Configuration', 'Templates', 'History'];

// Standalone tab for the "Email" section of Settings — mirrors how
// RolesPanel/BusinessHoursPanel are self-contained, but adds its own
// secondary tab bar since this module has three distinct sub-views.
const EmailPanel = () => {
  const [subTab, setSubTab] = useState('Configuration');

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-gray-800">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
              subTab === t
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === 'Configuration' && <EmailSettingsPanel />}
      {subTab === 'Templates' && <EmailTemplatesPanel />}
      {subTab === 'History' && <EmailHistoryPanel />}
    </div>
  );
};

export default EmailPanel;
