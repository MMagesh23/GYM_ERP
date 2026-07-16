import api from './api';
import { downloadFile } from './downloadFile';

export const expenseApi = {
  list: (params) => api.get('/expenses', { params }),
  get: (id) => api.get(`/expenses/${id}`),
  create: (formData) => api.post('/expenses', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/expenses/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => api.delete(`/expenses/${id}`),
  analytics: (year) => api.get('/expenses/analytics', { params: { year } }),
  export: (params) => downloadFile('/expenses/export', 'expenses-export.xlsx', params),
};
