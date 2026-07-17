import api from './api';

export const roleApi = {
  modules: () => api.get('/roles/modules'),
  list: () => api.get('/roles'),
  get: (id) => api.get(`/roles/${id}`),
  create: (payload) => api.post('/roles', payload),
  update: (id, payload) => api.put(`/roles/${id}`, payload),
  remove: (id) => api.delete(`/roles/${id}`),
};