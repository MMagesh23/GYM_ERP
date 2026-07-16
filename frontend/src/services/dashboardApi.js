import api from './api';

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  charts: (year) => api.get('/dashboard/charts', { params: { year } }),
};
