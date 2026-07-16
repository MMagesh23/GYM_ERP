import api from './api';
import { downloadFile } from './downloadFile';

export const paymentApi = {
  list: (params) => api.get('/payments', { params }),
  get: (id) => api.get(`/payments/${id}`),
  create: (payload) => api.post('/payments', payload),
  refund: (id, amount, reason) => api.post(`/payments/${id}/refund`, { amount, reason }),
  downloadInvoice: (id, invoiceNumber) => downloadFile(`/payments/${id}/invoice`, `${invoiceNumber || 'invoice'}.pdf`),
  export: (params) => downloadFile('/payments/export', 'payments-export.xlsx', params),
};
