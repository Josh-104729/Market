import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface SignUpStep1Data {
  email: string;
  password: string;
  repassword: string;
}

export interface SignUpStep4Data {
  userName: string;
  firstName: string;
  lastName: string;
  middleName?: string;
}

export interface SignUpStep5Data {
  street: string;
  city: string;
  country: string;
}

export interface SignUpStep6Data {
  phoneNumber: string;
}

export interface SignUpStep7Data {
  verificationCode: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export const authApi = {
  signUpStep1: async (data: SignUpStep1Data) => {
    const response = await api.post('/auth/signup/step1', data);
    return response.data;
  },

  verifyEmail: async (token: string) => {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  signUpStep4: async (userId: string, data: SignUpStep4Data) => {
    const response = await api.post(`/auth/signup/step4/${userId}`, data);
    return response.data;
  },

  signUpStep5: async (userId: string, data: SignUpStep5Data) => {
    const response = await api.post(`/auth/signup/step5/${userId}`, data);
    return response.data;
  },

  signUpStep6: async (userId: string, data: SignUpStep6Data) => {
    const response = await api.post(`/auth/signup/step6/${userId}`, data);
    return response.data;
  },

  signUpStep7: async (userId: string, data: SignUpStep7Data) => {
    const response = await api.post(`/auth/signup/step7/${userId}`, data);
    return response.data;
  },

  signIn: async (data: SignInData) => {
    const response = await api.post('/auth/signin', data);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
};

export default api;

