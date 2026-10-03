import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Attach JWT to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 globally — redirect to the correct login page based on role
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // A 401 from the login/register call itself means "wrong credentials" - let the
    // form show its own error instead of reloading the page.
    const reqUrl = error.config?.url || '';
    const isAuthAttempt = /\/auth\/(login|register)/.test(reqUrl);
    if (error.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const path = window.location.pathname;
      const isBackOffice =
        path.startsWith('/admin') ||
        path.startsWith('/superadmin') ||
        path.startsWith('/department');
      window.location.href = isBackOffice ? '/admin/login' : '/login';
    }
    return Promise.reject(error);
  }
);

export async function fetchSchemes() {
  const response = await api.get('/schemes');
  return response.data.data;
}

export async function fetchScheme(idOrSlug) {
  const response = await api.get(`/schemes/${idOrSlug}`);
  return response.data.data;
}

export async function checkEligibility({ schemeId, formData, files }) {
  const body = new FormData();
  body.append('schemeId', schemeId);
  body.append('formData', JSON.stringify(formData));

  Object.entries(files).forEach(([type, file]) => {
    if (file) body.append(type, file);
  });

  const response = await api.post('/eligibility/check', body, { timeout: 120000 });
  return response.data.data;
}

export default api;