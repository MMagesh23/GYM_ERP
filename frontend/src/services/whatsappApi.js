import api from './api';

export const whatsappTemplateApi = {
  list: () => api.get('/whatsapp-templates'),
  get: (type) => api.get(`/whatsapp-templates/${type}`),
  update: (type, payload) => api.put(`/whatsapp-templates/${type}`, payload),
  reset: (type) => api.post(`/whatsapp-templates/${type}/reset`),
  preview: (type, overrides) => api.post(`/whatsapp-templates/${type}/preview`, overrides || {}),
  generate: (type, payload) => api.post(`/whatsapp-templates/${type}/generate`, payload),
};

export const whatsappLogApi = {
  // Best-effort, optional activity logging — never lets a failure here
  // interfere with the actual copy/open action the user already performed.
  record: (payload) => api.post('/whatsapp-logs', payload).catch(() => {}),
};