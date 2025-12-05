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
  };
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceData {
  categoryId: string;
  title: string;
  adText: string;
  balance: number;
  tags: string[];
}

export interface UpdateServiceData {
  categoryId?: string;
  title?: string;
  adText?: string;
  balance?: number;
  tags?: string[];
  status?: 'draft' | 'active' | 'blocked';
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

export const categoryApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await api.get('/categories');
    return response.data;
  },

  getById: async (id: string): Promise<Category> => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },
};

export const serviceApi = {
  create: async (data: CreateServiceData, imageFile: File): Promise<Service> => {
    const formData = new FormData();
    formData.append('adImage', imageFile);
    formData.append('categoryId', data.categoryId);
    formData.append('title', data.title);
    formData.append('adText', data.adText);
    formData.append('balance', data.balance.toString());
    data.tags.forEach((tag) => formData.append('tags[]', tag));

    const response = await api.post('/services', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAll: async (params?: { status?: string; categoryId?: string; search?: string }): Promise<Service[]> => {
    const response = await api.get('/services', { params });
    // Backend now returns paginated response: { data: Service[], total, page, limit, totalPages }
    // Extract the data array from the response
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    // Fallback: if response is already an array (backward compatibility)
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  },

  getMyServices: async (params?: {
    status?: string;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Service[]; total: number; page: number; limit: number; totalPages: number }> => {
    const response = await api.get('/services/my-services', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Service> => {
    const response = await api.get(`/services/${id}`);
    return response.data;
  },

  update: async (id: string, data: UpdateServiceData, imageFile?: File): Promise<Service> => {
    const formData = new FormData();
    if (imageFile) {
      formData.append('adImage', imageFile);
    }
    if (data.categoryId) formData.append('categoryId', data.categoryId);
    if (data.title) formData.append('title', data.title);
    if (data.adText) formData.append('adText', data.adText);
    if (data.balance !== undefined) formData.append('balance', data.balance.toString());
    if (data.status) formData.append('status', data.status);
    if (data.tags) {
      data.tags.forEach((tag) => formData.append('tags[]', tag));
    }

    const response = await api.patch(`/services/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/services/${id}`);
  },

  updateStatus: async (id: string, status: 'draft' | 'active' | 'blocked'): Promise<Service> => {
    const response = await api.patch(`/services/${id}/status`, { status });
    return response.data;
  },
};

export interface Conversation {
  id: string;
  serviceId: string;
  clientId: string;
  providerId: string;
  service?: Service;
  client?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
  provider?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
  messages?: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  attachmentFiles?: string[];
  readAt?: string;
  sender?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  clientId: string;
  providerId: string;
  serviceId: string;
  title: string;
  description: string;
  attachedFiles?: string[];
  balance: number;
  status: 'draft' | 'processing' | 'canceled' | 'completed' | 'withdraw' | 'released' | 'dispute';
  client?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
  provider?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  };
  service?: Service;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneData {
  serviceId: string;
  title: string;
  description: string;
  attachedFiles?: string[];
  balance: number;
}

export const conversationApi = {
  create: async (serviceId: string): Promise<Conversation> => {
    const response = await api.post('/conversations', { serviceId });
    return response.data;
  },

  getAll: async (): Promise<Conversation[]> => {
    const response = await api.get('/conversations');
    return response.data;
  },

  getById: async (id: string): Promise<Conversation> => {
    const response = await api.get(`/conversations/${id}`);
    return response.data;
  },

  getByServiceId: async (serviceId: string): Promise<Conversation | null> => {
    const response = await api.get(`/conversations/service/${serviceId}`);
    return response.data;
  },

  getByServiceIdAsProvider: async (serviceId: string): Promise<Conversation[]> => {
    try {
      const response = await api.get(`/conversations/service/${serviceId}/provider`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      // If 404, try fallback: get all conversations and filter by service
      if (error.response?.status === 404) {
        console.warn('Provider endpoint not found (404). Backend may need restart. Using fallback...');
        try {
          const allConversations = await conversationApi.getAll();
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            // Filter conversations for this service where user is provider
            const filtered = allConversations.filter(
              (conv) => conv.serviceId === serviceId && conv.providerId === user.id
            );
            // Get last message for each (simplified - just get first message if available)
            return filtered.map((conv) => ({
              ...conv,
              messages: conv.messages && conv.messages.length > 0 ? [conv.messages[conv.messages.length - 1]] : [],
            }));
          }
          return [];
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          return [];
        }
      }
      // For other errors, return empty array instead of throwing
      console.error('Error fetching provider conversations:', error);
      return [];
    }
  },
};

export const messageApi = {
  create: async (conversationId: string, message: string, attachmentFiles?: string[]): Promise<Message> => {
    const response = await api.post(`/messages/conversation/${conversationId}`, {
      message,
      attachmentFiles,
    });
    return response.data;
  },

  getByConversation: async (conversationId: string): Promise<Message[]> => {
    const response = await api.get(`/messages/conversation/${conversationId}`);
    return response.data;
  },

  getById: async (id: string): Promise<Message> => {
    const response = await api.get(`/messages/${id}`);
    return response.data;
  },
};

export const milestoneApi = {
  create: async (conversationId: string, data: CreateMilestoneData): Promise<Milestone> => {
    const response = await api.post(`/milestones/conversation/${conversationId}`, data);
    return response.data;
  },

  getByConversation: async (conversationId: string): Promise<Milestone[]> => {
    const response = await api.get(`/milestones/conversation/${conversationId}`);
    return response.data;
  },

  getById: async (id: string): Promise<Milestone> => {
    const response = await api.get(`/milestones/${id}`);
    return response.data;
  },

  accept: async (id: string): Promise<Milestone> => {
    const response = await api.patch(`/milestones/${id}/accept`);
    return response.data;
  },

  cancel: async (id: string): Promise<Milestone> => {
    const response = await api.patch(`/milestones/${id}/cancel`);
    return response.data;
  },

  complete: async (id: string): Promise<Milestone> => {
    const response = await api.patch(`/milestones/${id}/complete`);
    return response.data;
  },

  withdraw: async (id: string): Promise<Milestone> => {
    const response = await api.patch(`/milestones/${id}/withdraw`);
    return response.data;
  },

  release: async (id: string): Promise<Milestone> => {
    const response = await api.patch(`/milestones/${id}/release`);
    return response.data;
  },

  dispute: async (id: string): Promise<Milestone> => {
    const response = await api.patch(`/milestones/${id}/dispute`);
    return response.data;
  },
};

export default api;

