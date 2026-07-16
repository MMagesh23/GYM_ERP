import api from './api';
import { downloadFile } from './downloadFile';

export const equipmentApi = {
  list: (params) => api.get('/equipment', { params }),
  get: (id) => api.get(`/equipment/${id}`),
  create: (formData) => api.post('/equipment', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.put(`/equipment/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => api.delete(`/equipment/${id}`),
  changeStatus: (id, status) => api.patch(`/equipment/${id}/status`, { status }),
  warrantyAlerts: (days = 30) => api.get('/equipment/warranty-alerts', { params: { days } }),
  export: () => downloadFile('/equipment/export', 'equipment-export.xlsx'),
};

export const maintenanceApi = {
  listForEquipment: (equipmentId) => api.get(`/equipment/${equipmentId}/maintenance`),
  create: (equipmentId, payload) => api.post(`/equipment/${equipmentId}/maintenance`, payload),
  update: (id, payload) => api.put(`/maintenance/${id}`, payload),
  remove: (id) => api.delete(`/maintenance/${id}`),
  dueSoon: (days = 7) => api.get('/maintenance/due', { params: { days } }),
};
