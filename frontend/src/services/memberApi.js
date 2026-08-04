import api from './api';
import { downloadFile } from './downloadFile';

export const memberApi = {
  list: (params) => api.get('/members', { params }),
  get: (id) => api.get(`/members/${id}`),
  create: (payload) =>
    api.post('/members', payload, payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  update: (id, payload) =>
    api.put(`/members/${id}`, payload, payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  remove: (id) => api.delete(`/members/${id}`),
  changeStatus: (id, status, reason) => api.patch(`/members/${id}/status`, { status, reason }),
  export: (params) => downloadFile('/members/export', 'members-export.xlsx', params),
    import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/members/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};