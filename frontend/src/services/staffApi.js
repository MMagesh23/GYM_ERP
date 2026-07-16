import api from './api';

export const staffApi = {
  list: (params) => api.get('/staff', { params }),
  get: (id) => api.get(`/staff/${id}`),
  create: (formData) => api.post('/staff', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/staff/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggleDisable: (id, disable) => api.patch(`/staff/${id}/disable`, { disable }),
  resetPassword: (id, password) => api.post(`/staff/${id}/reset-password`, { password }),
};
