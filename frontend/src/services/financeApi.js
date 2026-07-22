import api from './api';
import { downloadFile } from './downloadFile';

export const financeApi = {
  summary: (params) => api.get('/finance/summary', { params }),
  revenueByPlan: (params) => api.get('/finance/revenue-by-plan', { params }),
};

export const cashClosingApi = {
  preview: (date) => api.get('/finance/cash-closing/preview', { params: { date } }),
  list: (params) => api.get('/finance/cash-closing', { params }),
  close: (payload) => api.post('/finance/cash-closing/close', payload),
};

// Re-exported here for convenience so Finance pages have one import to reach
// for report downloads without pulling in reportApi.js separately.
export const financeReportApi = {
  cashFlow: (params) => downloadFile('/reports/cash-flow', 'cash-flow-report.xlsx', params),
  revenueByMethod: (params) => downloadFile('/reports/revenue-by-method', 'revenue-by-method.xlsx', params),
  revenueByPlan: (params) => downloadFile('/reports/revenue-by-plan', 'revenue-by-plan.xlsx', params),
};