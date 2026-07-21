import api from './api';

export const planApi = {
  list: (includeInactive = false) => api.get('/membership-plans', { params: { includeInactive } }),
  get: (id) => api.get(`/membership-plans/${id}`),
  create: (payload) => api.post('/membership-plans', payload),
  update: (id, payload) => api.put(`/membership-plans/${id}`, payload),
  deactivate: (id) => api.delete(`/membership-plans/${id}`),
};

export const membershipApi = {
  create: (payload) => api.post('/memberships', payload), // { memberId, planId, startDate?, extraDiscount? }
  renew: (id) => api.post(`/memberships/${id}/renew`),
  changePlan: (id, newPlanId, direction) => api.post(`/memberships/${id}/change-plan`, { newPlanId, direction }),
  transfer: (id, toMemberId) => api.post(`/memberships/${id}/transfer`, { toMemberId }),
  freeze: (id, days, reason) => api.post(`/memberships/${id}/freeze`, { days, reason }),
  unfreeze: (id) => api.post(`/memberships/${id}/unfreeze`),
  cancel: (id, reason) => api.post(`/memberships/${id}/cancel`, { reason }),
  expiringSoon: (days = 7) => api.get('/memberships/expiring', { params: { days } }),
  historyForMember: (memberId) => api.get(`/memberships/member/${memberId}`),
  outstanding: () => api.get('/memberships/outstanding'),
};