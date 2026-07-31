import api from './api';

export const whatsappTemplateApi = {
  list: (language) => api.get('/whatsapp-templates', { params: { language } }),
  get: (type, language) => api.get(`/whatsapp-templates/${type}`, { params: { language } }),
  update: (type, payload, language) => api.put(`/whatsapp-templates/${type}`, payload, { params: { language } }),
  reset: (type, language) => api.post(`/whatsapp-templates/${type}/reset`, {}, { params: { language } }),
  preview: (type, overrides, language) => api.post(`/whatsapp-templates/${type}/preview`, overrides || {}, { params: { language } }),
  generate: (type, payload) => api.post(`/whatsapp-templates/${type}/generate`, payload), // language goes in the body — see modal
};

export const whatsappLogApi = {
  record: (payload) => api.post('/whatsapp-logs', payload).catch(() => {}),
};