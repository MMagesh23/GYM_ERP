import { FileSpreadsheet, FileText } from 'lucide-react';
import { reportApi } from '../../services/reportApi';

const REPORTS = [
  { key: 'members', label: 'Member Report', description: 'All members with contact info, status, and join date.' },
  { key: 'memberships', label: 'Membership Report', description: 'Every membership record with plan, dates, and amount.' },
  { key: 'payments', label: 'Payment Report', description: 'All recorded payments with method and status.' },
  { key: 'expenses', label: 'Expense Report', description: 'All expenses by category, vendor, and date.' },
  { key: 'profit', label: 'Profit Report', description: 'Monthly revenue, expenses, and net profit for the current year.', pdf: true },
  { key: 'equipment', label: 'Equipment Report', description: 'All equipment with status, cost, and location.' },
  { key: 'staff', label: 'Staff Report', description: 'All staff with designation, salary, and status.' },
];

const ReportsPage = () => {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Reports</h1>
      <p className="mb-6 text-sm text-gray-500">Export data for accounting, audits, or offline analysis.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.key} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-1 font-semibold">{r.label}</h3>
            <p className="mb-4 text-sm text-gray-500">{r.description}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => reportApi.download(r.key, 'xlsx')}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button
                onClick={() => reportApi.download(r.key, 'csv')}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <FileSpreadsheet size={14} /> CSV
              </button>
              {r.pdf && (
                <button
                  onClick={() => reportApi.downloadProfitPdf()}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <FileText size={14} /> PDF
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsPage;
