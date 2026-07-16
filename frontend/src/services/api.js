import axios from 'axios';
import { getStore } from '../redux/storeRegistry';
import { setAccessToken, logoutLocal } from '../redux/slices/authSlice';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // sends the httpOnly refreshToken cookie
});

const getCurrentStore = () => getStore();

// Attach the current access token to every request
api.interceptors.request.use((config) => {
  const store = getCurrentStore();
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silent refresh queue - avoids firing multiple parallel /auth/refresh calls
let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (!response || response.status !== 401 || config._retry) {
      return Promise.reject(error);
    }

    if (config.url.includes('/auth/refresh') || config.url.includes('/auth/login')) {
      // Refresh itself failed - force logout, don't loop
      getCurrentStore().dispatch(logoutLocal());
      return Promise.reject(error);
    }

    config._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      });
    }

    isRefreshing = true;
    try {
      const { data } = await api.post('/auth/refresh');
      const newToken = data.data.accessToken;
      getCurrentStore().dispatch(setAccessToken(newToken));
      processQueue(null, newToken);
      config.headers.Authorization = `Bearer ${newToken}`;
      return api(config);
    } catch (refreshError) {
      processQueue(refreshError, null);
      getCurrentStore().dispatch(logoutLocal());
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
