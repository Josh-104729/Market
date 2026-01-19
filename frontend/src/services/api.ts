import axios, { AxiosError } from 'axios';
import { showToast } from '../utils/toast';

// Use environment variable for API URL
// Set VITE_API_URL in .env file (e.g., http://localhost:3000/api or https://your-backend.railway.app/api)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
let isHandlingAuthExpiry = false;

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

// Handle API errors globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Don't show toast for 401 errors (handled by auth flow)
    // Don't show toast if error response is already handled in component
    if (error.response) {
      const status = error.response.status;
      const message = (error.response.data as any)?.message || error.message;
      const requestUrl = error.config?.url || '';
      const authHeader = (error.config?.headers as any)?.Authorization as string | undefined;
      const hasToken = !!localStorage.getItem('accessToken');
      const isAuthRoute = ['/auth/signin', '/auth/signup', '/auth/verify-email', '/auth/verify-2fa', '/auth/forgot-password', '/auth/reset-password'].some((path) =>
        requestUrl.includes(path)
      );

      // Only show toast for certain error types
      if (status === 401) {
        // Unauthorized - treat as session expired when a token was used.
        if (authHeader && hasToken && !isAuthRoute && !isHandlingAuthExpiry) {
          isHandlingAuthExpiry = true;
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          window.dispatchEvent(new CustomEvent('auth-expired', { detail: { reason: 'http_401' } }));
          setTimeout(() => {
            isHandlingAuthExpiry = false;
          }, 300);
        }
        // Don't show error toast for 401 to avoid duplicates
      } else if (status === 403) {
        showToast.error('You do not have permission to perform this action');
      } else if (status === 404) {
        showToast.error('Resource not found');
      } else if (status >= 500) {
        showToast.error('Server error. Please try again later');
      } else if (status >= 400 && message) {
        // For other 4xx errors, show the message if available
        // Components can still override this with their own error handling
      }
    } else if (error.request) {
      // Network error
      showToast.error('Network error. Please check your connection');
    } else {
      // Something else happened
      showToast.error('An unexpected error occurred');
    }

    return Promise.reject(error);
  }
);

export interface SignUpStep1Data {
  email: string;
  password: string;
  repassword: string;
  referralCode?: string;
}

export interface SignUpStep4Data {
  userName: string;
  firstName: string;
  lastName: string;
  middleName?: string;
}

export interface SignUpStep5Data {
  country: string;
}

// SMS phone verification disabled - SignUpStep6Data commented out
// export interface SignUpStep6Data {
//   phoneNumber: string;
// }

// SMS phone verification disabled - SignUpStep7Data kept for internal use
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
  adImage?: string | null;
  balance: number;
  paymentDuration?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'each_time';
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
  totalMilestones?: number;
  completedMilestones?: number;
  averageRating?: number;
  feedbackCount?: number;
  feedbacks?: Array<{
    id: string;
    title: string;
    feedback: string;
    rating: number;
    client: { id: string; firstName?: string; lastName?: string; userName?: string };
    createdAt: string;
  }>;
  feedbacksHasMore?: boolean;
  feedbacksPage?: number;
  feedbacksLimit?: number;
}

export interface CreateServiceData {
  categoryId: string;
  title: string;
  adText: string;
  balance: number;
  paymentDuration: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'each_time';
  tags: string[];
}

export interface UpdateServiceData {
  categoryId?: string;
  title?: string;
  adText?: string;
  balance?: number;
  paymentDuration?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'each_time';
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

  // SMS phone verification disabled - signUpStep6 commented out
  // signUpStep6: async (userId: string, data: SignUpStep6Data) => {
  //   const response = await api.post(`/auth/signup/step6/${userId}`, data);
  //   return response.data;
  // },

  // SMS phone verification disabled - signUpStep7 kept for internal use (bypasses verification)
  signUpStep7: async (userId: string, data: SignUpStep7Data) => {
    const response = await api.post(`/auth/signup/step7/${userId}`, data);
    return response.data;
  },

  signIn: async (data: SignInData) => {
    const response = await api.post('/auth/signin', data);
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string) => {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  updateProfile: async (data: {
    userName?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    bio?: string;
    address?: string;
    phoneNumber?: string;
  }) => {
    const response = await api.patch('/auth/profile', data);
    return response.data;
  },

  updateAvatar: async (avatarFile: File) => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    const response = await api.patch('/auth/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  twoFactor: {
    // SMS phone verification disabled - removed 'sms' from method options
    enable: async (method: 'totp' | /* 'sms' | */ 'email') => {
      const response = await api.post('/auth/2fa/enable', { method });
      return response.data;
    },
    
    verifySetup: async (code: string) => {
      const response = await api.post('/auth/2fa/verify-setup', { code });
      return response.data;
    },
    
    verifyLogin: async (tempToken: string, code: string) => {
      const response = await api.post('/auth/verify-2fa', { tempToken, code });
      return response.data;
    },
    
    disable: async (password: string) => {
      const response = await api.post('/auth/2fa/disable', { password });
      return response.data;
    },
    
    regenerateBackupCodes: async (password: string) => {
      const response = await api.post('/auth/2fa/regenerate-backup-codes', { password });
      return response.data;
    },
    
    getStatus: async () => {
      const response = await api.get('/auth/2fa/status');
      return response.data;
    },
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
  create: async (data: CreateServiceData, imageFile?: File | null): Promise<Service> => {
    const formData = new FormData();
    if (imageFile) {
      formData.append('adImage', imageFile);
    }
    formData.append('categoryId', data.categoryId);
    formData.append('title', data.title);
    formData.append('adText', data.adText);
    formData.append('balance', data.balance.toString());
    formData.append('paymentDuration', data.paymentDuration);
    data.tags.forEach((tag) => formData.append('tags[]', tag));

    const response = await api.post('/services', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAll: async (params?: { 
    status?: string; 
    categoryId?: string; 
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<Service[]> => {
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

  getAllPaginated: async (params?: { 
    status?: string; 
    categoryId?: string; 
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Service[]; total: number; page: number; limit: number; totalPages: number }> => {
    const response = await api.get('/services', { params });
    // Backend returns paginated response: { data: Service[], total, page, limit, totalPages }
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      return response.data;
    }
    // Fallback: if response is already an array (backward compatibility)
    if (Array.isArray(response.data)) {
      return {
        data: response.data,
        total: response.data.length,
        page: 1,
        limit: response.data.length,
        totalPages: 1,
      };
    }
    return {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
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

  getById: async (id: string, feedbackPage?: number, feedbackLimit?: number): Promise<Service> => {
    const params: any = {};
    if (feedbackPage !== undefined) params.feedbackPage = feedbackPage;
    if (feedbackLimit !== undefined) params.feedbackLimit = feedbackLimit;
    const response = await api.get(`/services/${id}`, { params });
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
    if (data.paymentDuration) formData.append('paymentDuration', data.paymentDuration);
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
  isBlocked?: boolean;
  blockedAt?: string | null;
  blockedReason?: string | null;
  reactivationRequestPending?: boolean;
  pendingReactivationRequest?: {
    id: string;
    requesterId: string;
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
  } | null;
  service?: Service;
  client?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    avatar?: string;
  };
  provider?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    avatar?: string;
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
  isFraud?: boolean;
  contentHiddenForViewer?: boolean;
  fraud?: {
    category?: string | null;
    reason?: string | null;
    confidence?: 'low' | 'medium' | 'high' | null;
  };
  sender?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    avatar?: string;
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
  feedback?: string;
  rating?: number;
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

export interface Post {
  id: string;
  userId: string;
  title?: string;
  content: string;
  images?: string[];
  status: 'pending' | 'published' | 'rejected' | 'archived';
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    avatar?: string;
  };
  likeCount?: number;
  isLiked?: boolean;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostComment {
  id: string;
  userId: string;
  postId: string;
  content: string;
  parentId?: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    avatar?: string;
  };
  likeCount?: number;
  isLiked?: boolean;
  replyCount?: number;
  replies?: PostComment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostData {
  title?: string;
  content: string;
  images?: string[];
}

export interface CreateCommentData {
  content: string;
  parentId?: string;
}

export const blogApi = {
  create: async (data: CreatePostData, imageFiles?: File[]): Promise<Post> => {
    const formData = new FormData();
    if (data.title) {
      formData.append('title', data.title);
    }
    formData.append('content', data.content);
    if (imageFiles && imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        formData.append('images', file);
      });
    }

    const response = await api.post('/blog', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: Post[]; total: number; page: number; limit: number; totalPages: number }> => {
    const response = await api.get('/blog', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Post> => {
    const response = await api.get(`/blog/${id}`);
    return response.data;
  },

  update: async (id: string, data: CreatePostData, imageFiles?: File[]): Promise<Post> => {
    const formData = new FormData();
    if (data.title !== undefined) {
      formData.append('title', data.title || '');
    }
    formData.append('content', data.content);
    if (imageFiles && imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        formData.append('images', file);
      });
    }

    const response = await api.patch(`/blog/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/blog/${id}`);
  },

  likePost: async (id: string): Promise<{ liked: boolean; likeCount: number }> => {
    const response = await api.post(`/blog/${id}/like`);
    return response.data;
  },

  createComment: async (postId: string, data: CreateCommentData): Promise<PostComment> => {
    const response = await api.post(`/blog/${postId}/comments`, data);
    return response.data;
  },

  reportPost: async (postId: string, data: { reason: string; details?: string }): Promise<void> => {
    await api.post(`/blog/${postId}/report`, data);
  },

  getComments: async (postId: string): Promise<PostComment[]> => {
    const response = await api.get(`/blog/${postId}/comments`);
    return response.data;
  },

  likeComment: async (commentId: string): Promise<{ liked: boolean; likeCount: number }> => {
    const response = await api.post(`/blog/comments/${commentId}/like`);
    return response.data;
  },

  deleteComment: async (commentId: string): Promise<void> => {
    await api.delete(`/blog/comments/${commentId}`);
  },
};

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

  requestReactivation: async (conversationId: string) => {
    const response = await api.post(`/conversations/${conversationId}/reactivation-request`, {});
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

  getByConversation: async (conversationId: string, limit?: number, before?: string): Promise<{ messages: Message[]; hasMore: boolean }> => {
    const params: any = {};
    if (limit !== undefined) params.limit = limit;
    if (before) params.before = before;
    const response = await api.get(`/messages/conversation/${conversationId}`, { params });
    return response.data;
  },

  getById: async (id: string): Promise<Message> => {
    const response = await api.get(`/messages/${id}`);
    return response.data;
  },

  uploadFiles: async (files: File[]): Promise<{ urls: string[]; files: Array<{ url: string; name: string; size: number; type: string }> }> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post('/messages/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (id: string): Promise<{ messageId: string; conversationId: string }> => {
    const response = await api.delete(`/messages/${id}`);
    return response.data;
  },

  deleteBulk: async (messageIds: string[]): Promise<{ deletedIds: string[] }> => {
    const response = await api.post(`/messages/delete-bulk`, { messageIds });
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

  release: async (id: string, data: { feedback: string; rating: number }): Promise<Milestone> => {
    const response = await api.patch(`/milestones/${id}/release`, data);
    return response.data;
  },

  dispute: async (id: string): Promise<Milestone> => {
    const response = await api.patch(`/milestones/${id}/dispute`);
    return response.data;
  },
};

export interface Balance {
  id: string;
  userId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  clientId?: string;
  providerId?: string;
  milestoneId?: string;
  type: 'charge' | 'withdraw' | 'milestone_payment';
  status: 'draft' | 'pending' | 'success' | 'failed' | 'cancelled' | 'withdraw';
  amount: number;
  transactionHash?: string;
  walletAddress?: string;
  description?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ChargeData {
  amount: number;
  transactionHash: string;
}

export interface InitiateChargeData {
  amount: number;
  paymentNetwork?: 'USDT_TRC20' | 'USDC_POLYGON';
}

export interface ChargeStatusResponse {
  walletAddress: string;
  amount: number;
  platformFee: number;
  total: number;
  transactionId: string;
  expiresAt: string;
  paymentNetwork?: 'USDT_TRC20' | 'USDC_POLYGON';
}

export interface WithdrawData {
  amount: number;
  walletAddress: string;
  paymentNetwork?: 'USDT_TRC20' | 'USDC_POLYGON';
}

export const paymentApi = {
  getBalance: async (): Promise<Balance> => {
    const response = await api.get('/payment/balance');
    return response.data;
  },

  initiateCharge: async (data: InitiateChargeData): Promise<ChargeStatusResponse> => {
    const response = await api.post('/payment/charge/initiate', data);
    return response.data;
  },

  getChargeStatus: async (transactionId: string): Promise<{
    status: string;
    transactionHash?: string;
    confirmedAt?: string;
    description?: string;
  }> => {
    const response = await api.get(`/payment/charge/status/${transactionId}`);
    return response.data;
  },

  getChargeByWalletAddress: async (walletAddress: string): Promise<{
    walletAddress: string;
    amount: number;
    platformFee: number;
    total: number;
    transactionId: string;
    expiresAt: string;
    status: string;
    transactionHash?: string;
    paymentNetwork?: 'USDT_TRC20' | 'USDC_POLYGON';
  }> => {
    const response = await api.get(`/payment/charge/wallet/${walletAddress}`);
    return response.data;
  },

  cancelCharge: async (transactionId: string): Promise<{ status: string }> => {
    const response = await api.patch(`/payment/charge/cancel/${transactionId}`);
    return response.data;
  },

  charge: async (data: ChargeData): Promise<Transaction> => {
    const response = await api.post('/payment/charge', data);
    return response.data;
  },

  withdraw: async (data: WithdrawData): Promise<Transaction> => {
    const response = await api.post('/payment/withdraw', data);
    return response.data;
  },

  getWithdrawStatus: async (transactionId: string): Promise<{
    status: string;
    transactionHash?: string;
    confirmedAt?: string;
  }> => {
    const response = await api.get(`/payment/withdraw/status/${transactionId}`);
    return response.data;
  },

  getTransactions: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{ data: Transaction[]; total: number; page: number; limit: number; totalPages: number }> => {
    const response = await api.get('/payment/transactions', { params });
    return response.data;
  },

  acceptPayment: async (transactionId: string): Promise<Transaction> => {
    const response = await api.post(`/payment/accept-payment/${transactionId}`);
    return response.data;
  },

  getPendingPaymentByMilestone: async (milestoneId: string): Promise<Transaction | null> => {
    const response = await api.get(`/payment/pending-payment/milestone/${milestoneId}`);
    return response.data;
  },

  getSuccessfulPaymentByMilestone: async (milestoneId: string): Promise<Transaction | null> => {
    const response = await api.get(`/payment/successful-payment/milestone/${milestoneId}`);
    return response.data;
  },
};


export interface Notification {
  id: string;
  userId?: string;
  type: 'broadcast' | 'payment_charge' | 'payment_withdraw' | 'payment_transfer' | 'message' | 'service_pending_approval' | 'service_approved' | 'service_blocked' | 'service_unblocked' | 'milestone_created' | 'milestone_updated' | 'milestone_payment_pending';
  title: string;
  message: string;
  readAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

export const notificationApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<NotificationListResponse> => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (notificationId: string): Promise<Notification> => {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<void> => {
    await api.patch('/notifications/read-all');
  },

  delete: async (notificationId: string): Promise<void> => {
    await api.delete(`/notifications/${notificationId}`);
  },
};

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  referralCode: string;
}

export interface ReferralListItem {
  id: string;
  referredUser: {
    id: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    email: string;
  };
  status: string;
  referredAt: string;
  activatedAt?: string;
  completedAt?: string;
  earnings: number;
}

export interface RewardListItem {
  id: string;
  amount: number;
  currency: string;
  rewardType: string;
  status: string;
  processedAt?: string;
  description?: string;
  referredUser: {
    id: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt: string;
}

export const referralApi = {
  validateCode: async (code: string) => {
    const response = await api.get(`/referral/validate?code=${encodeURIComponent(code)}`);
    return response.data;
  },

  getMyCode: async (): Promise<{ referralCode: string }> => {
    const response = await api.get('/referral/my-code');
    return response.data;
  },

  getMyStats: async (): Promise<ReferralStats> => {
    const response = await api.get('/referral/my-stats');
    return response.data;
  },

  getMyReferrals: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    referrals: ReferralListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> => {
    const response = await api.get('/referral/my-referrals', { params });
    return response.data;
  },

  getRewards: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    rewards: RewardListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> => {
    const response = await api.get('/referral/rewards', { params });
    return response.data;
  },
};

export type HelpRequestStatus = 'pending' | 'approved';

export interface HelpRequest {
  id: string;
  userId: string;
  title: string;
  content: string;
  imageUrl?: string;
  status: HelpRequestStatus;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const helpApi = {
  create: async (data: { title: string; content: string; imageFile?: File }): Promise<HelpRequest> => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('content', data.content);
    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }
    const response = await api.post('/help', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getMy: async (): Promise<HelpRequest[]> => {
    const response = await api.get('/help/my');
    return response.data;
  },
};

export default api;

