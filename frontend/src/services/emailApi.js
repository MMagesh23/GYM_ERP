import api from './api';

export const emailSettingsApi = {
  get: () => api.get('/email-settings'),
  update: (payload) => api.put('/email-settings', payload),
  testConnection: () => api.post('/email-settings/test-connection'),
  sendTest: (to) => api.post('/email-settings/send-test', { to }),
};

export const emailTemplateApi = {
  list: () => api.get('/email-templates'),
  get: (type) => api.get(`/email-templates/${type}`),
  update: (type, payload) => api.put(`/email-templates/${type}`, payload),
  reset: (type) => api.post(`/email-templates/${type}/reset`),
  preview: (type, overrides) => api.post(`/email-templates/${type}/preview`, overrides || {}),
};

export const emailLogApi = {
  list: (params) => api.get('/email-logs', { params }),
  sendAnnouncement: (payload) => api.post('/email-logs/announcement', payload),
};
