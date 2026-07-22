import { downloadFile } from './downloadFile';
import api from './api';

const REPORT_FILES = {
  members: 'member-report',
  memberships: 'membership-report',
  payments: 'payment-report',
  expenses: 'expense-report',
  profit: 'profit-report',
  equipment: 'equipment-report',
  staff: 'staff-report',
  // NEW
  'cash-flow': 'cash-flow-report',
  'revenue-by-method': 'revenue-by-method',
  'revenue-by-plan': 'revenue-by-plan',
};

export const reportApi = {
  download: (report, format = 'xlsx', params = {}) =>
    downloadFile(`/reports/${report}`, `${REPORT_FILES[report]}.${format}`, { ...params, format }),
  downloadProfitPdf: (year) => downloadFile('/reports/profit/pdf', `profit-report-${year || new Date().getFullYear()}.pdf`, { year }),
};

export const auditLogApi = {
  list: (params) => api.get('/audit-logs', { params }),
};