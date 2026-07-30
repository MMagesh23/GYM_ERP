import api from './api';

export const staffApi = {
  list: (params) => api.get('/staff', { params }),
  get: (id) => api.get(`/staff/${id}`),
  create: (formData) => api.post('/staff', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/staff/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggleDisable: (id, disable) => api.patch(`/staff/${id}/disable`, { disable }),
  resetPassword: (id, password) => api.post(`/staff/${id}/reset-password`, { password }),
  // NEW — permanent delete. Server enforces the safety rule (blocked if the
  // linked login account has processed payments or has audit-log history);
  // this call surfaces that as a normal API error for the caller to toast.
  remove: (id) => api.delete(`/staff/${id}`),
};