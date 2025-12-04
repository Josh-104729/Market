import axios from 'axios';

// Use proxy path in development (Vite will proxy /api to backend)
// In production, update this to your backend URL
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminAccessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface AdminSignInData {
  email: string;
  password: string;
}

export const adminApi = {
  signIn: async (data: AdminSignInData) => {
    const response = await api.post('/admin/signin', data);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/admin/profile');
    return response.data;
  },
};

export default api;

