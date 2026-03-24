import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 🔥 FIXED AUTH API
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  getGoogleAuthUrl: () => api.get('/api/auth/google'),
  connectGmail: (code) =>
    api.post('/api/auth/gmail/connect', { code }),
  disconnectGmail: () =>
    api.post('/api/auth/gmail/disconnect'),
  logout: () => api.post('/api/auth/logout'),
};

// Transaction API
export const transactionAPI = {
  getAll: (params) => api.get('/api/transactions', { params }),
  getStats: (params) =>
    api.get('/api/transactions/stats', { params }),
  getAccounts: () => api.get('/api/transactions/accounts'),
  getById: (id) => api.get(`/api/transactions/${id}`),
  update: (id, data) =>
    api.put(`/api/transactions/${id}`, data),
  delete: (id) => api.delete(`/api/transactions/${id}`),
  sync: () => api.post('/api/transactions/sync'),
  createManual: (data) =>
    api.post('/api/transactions/manual', data),
};

// Category API
export const categoryAPI = {
  getAll: () => api.get('/api/categories'),
  getById: (id) => api.get(`/api/categories/${id}`),
  create: (data) => api.post('/api/categories', data),
  update: (id, data) =>
    api.put(`/api/categories/${id}`, data),
  delete: (id) => api.delete(`/api/categories/${id}`),
  initDefaults: () =>
    api.post('/api/categories/init-defaults'),
};

// Budget API
export const budgetAPI = {
  getAll: () => api.get('/api/budget'),
  getSummary: (params) =>
    api.get('/api/budget/summary', { params }),
  getById: (id) => api.get(`/api/budget/${id}`),
  create: (data) => api.post('/api/budget', data),
  update: (id, data) =>
    api.put(`/api/budget/${id}`, data),
  delete: (id) => api.delete(`/api/budget/${id}`),
};

export default api;