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

// Handle 401 globally — redirect to the correct login page based on role.
// Admin, Superadmin and Department all share the back-office login at
// /admin/login; citizens and workers use the citizen login at /login.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
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

  // OCR (incl. Kannada) on several documents can take well over the default
  // 30s on a first run or a slow machine, so this one call gets a longer limit.
  const response = await api.post('/eligibility/check', body, { timeout: 120000 });
  // Backend responds { success, data: {...verdict} } — unwrap like the
  // other helpers so callers get the verdict itself.
  return response.data.data;
}

export default api;