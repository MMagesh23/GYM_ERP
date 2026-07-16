import api from './api';

/**
 * Fetches a file from an authenticated API endpoint and triggers a browser download.
 * Needed because plain <a href> links don't carry the Authorization header that
 * our axios instance attaches - direct GET requests to protected file routes would 401.
 */
export const downloadFile = async (url, filename, params) => {
  const response = await api.get(url, { params, responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};
