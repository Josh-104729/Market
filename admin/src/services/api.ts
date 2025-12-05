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

export interface Category {
  id: string;
  title: string;
  icon?: string;
  serviceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryData {
  title: string;
  icon?: string;
}

export interface UpdateCategoryData {
  title?: string;
  icon?: string;
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

export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await api.get('/categories');
    return response.data;
  },

  getById: async (id: string): Promise<Category> => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  create: async (data: CreateCategoryData): Promise<Category> => {
    const response = await api.post('/categories', data);
    return response.data;
  },

  update: async (id: string, data: UpdateCategoryData): Promise<Category> => {
    const response = await api.patch(`/categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};

export interface Tag {
  id: string;
  serviceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  adText: string;
  adImage: string;
  balance: number;
  rating: number;
  status: 'draft' | 'active' | 'blocked';
  category?: Category;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    email?: string;
  };
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListResponse {
  data: Service[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const serviceApi = {
  getAll: async (params?: {
    status?: string;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ServiceListResponse> => {
    const response = await api.get('/services', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Service> => {
    const response = await api.get(`/services/${id}`);
    return response.data;
  },

  updateStatus: async (id: string, status: 'draft' | 'active' | 'blocked'): Promise<Service> => {
    const response = await api.patch(`/services/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/services/${id}/admin`);
  },
};

export interface Post {
  id: string;
  userId: string;
  content: string;
  images?: string[];
  status: 'draft' | 'published' | 'archived';
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    email?: string;
  };
  likeCount?: number;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostListResponse {
  data: Post[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const blogApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PostListResponse> => {
    const response = await api.get('/blog', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Post> => {
    const response = await api.get(`/blog/${id}`);
    return response.data;
  },

  updateStatus: async (id: string, status: 'draft' | 'published' | 'archived'): Promise<Post> => {
    const response = await api.patch(`/blog/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/blog/${id}/admin`);
  },
};

export default api;

