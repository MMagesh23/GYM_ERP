// frontend/src/services/sessionApi.js
import api from './api';

export const sessionApi = {
  list: () => api.get('/auth/sessions'),
  revoke: (id) => api.delete(`/auth/sessions/${id}`),
  revokeOthers: () => api.post('/auth/sessions/revoke-others'),
};