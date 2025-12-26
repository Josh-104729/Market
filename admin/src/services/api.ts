import axios from 'axios';

// Use environment variable for API URL
// Set VITE_API_URL in admin/.env (e.g., http://localhost:3000/api or https://your-backend.railway.app/api)
// Fallback keeps the existing dev-proxy setup (Vite can proxy /api to backend).
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

export type HelpRequestStatus = 'pending' | 'approved';
export type ReactivationRequestStatus = 'pending' | 'approved' | 'rejected';

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
  user?: {
    id: string;
    email: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  approvedByUser?: {
    id: string;
    email: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
  };
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

export interface TempWallet {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    userName?: string;
    firstName?: string;
    lastName?: string;
  } | null;
  address: string;
  status: string;
  network?: 'TRON' | 'POLYGON';
  totalReceived: number;
  usdtBalance: number;
  usdcBalance?: number;
  maticBalance?: number;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TempWalletBalances {
  walletId: string;
  network: 'TRON' | 'POLYGON';
  address: string;
  tokenSymbol: 'USDT' | 'USDC';
  tokenBalance: number;
  gasSymbol: 'TRX' | 'MATIC';
  gasBalance: number;
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

  getTempWallets: async (): Promise<TempWallet[]> => {
    const response = await api.get('/admin/temp-wallets');
    return response.data;
  },

  getTempWalletBalances: async (walletId: string): Promise<TempWalletBalances> => {
    const response = await api.get(`/admin/temp-wallets/${walletId}/balances`);
    return response.data;
  },

  transferFromTempWallet: async (walletId: string) => {
    const response = await api.post(`/admin/temp-wallets/${walletId}/transfer`);
    return response.data;
  },

  transferRemainingTRXFromTempWallet: async (walletId: string) => {
    const response = await api.post(`/admin/temp-wallets/${walletId}/transfer-trx`);
    return response.data;
  },

  getWithdraws: async () => {
    const response = await api.get('/admin/withdraws');
    return response.data;
  },

  acceptWithdraw: async (withdrawId: string) => {
    const response = await api.post(`/admin/withdraws/${withdrawId}/accept`);
    return response.data;
  },

  getDisputes: async () => {
    const response = await api.get('/admin/disputes');
    return response.data;
  },

  releaseMilestone: async (milestoneId: string, amount: number) => {
    const response = await api.post(`/admin/milestones/${milestoneId}/release`, { amount });
    return response.data;
  },

  getHelps: async (): Promise<HelpRequest[]> => {
    const response = await api.get('/admin/help');
    return response.data;
  },

  getHelp: async (id: string): Promise<HelpRequest> => {
    const response = await api.get(`/admin/help/${id}`);
    return response.data;
  },

  approveHelp: async (id: string): Promise<HelpRequest> => {
    const response = await api.post(`/admin/help/${id}/approve`);
    return response.data;
  },

  getFraudConversations: async (params?: { blocked?: 'blocked' | 'unblocked' | 'all'; pending?: boolean }): Promise<FraudConversationRow[]> => {
    const response = await api.get('/admin/fraud', {
      params: {
        blocked: params?.blocked,
        pending: params?.pending,
      },
    });
    return response.data;
  },

  approveReactivationRequest: async (requestId: string) => {
    const response = await api.post(`/admin/fraud/reactivation-requests/${requestId}/approve`, {});
    return response.data;
  },

  rejectReactivationRequest: async (requestId: string) => {
    const response = await api.post(`/admin/fraud/reactivation-requests/${requestId}/reject`, {});
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

  getById: async (id: string, feedbackPage?: number, feedbackLimit?: number): Promise<Service> => {
    const params: any = {};
    if (feedbackPage !== undefined) params.feedbackPage = feedbackPage;
    if (feedbackLimit !== undefined) params.feedbackLimit = feedbackLimit;
    const response = await api.get(`/services/${id}`, { params });
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

export interface Notification {
  id: string;
  userId?: string;
  type: 'broadcast' | 'payment_charge' | 'payment_withdraw' | 'payment_transfer' | 'message' | 'service_approved' | 'service_blocked' | 'service_unblocked' | 'milestone_created' | 'milestone_updated' | 'milestone_payment_pending';
  title: string;
  message: string;
  readAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationData {
  title: string;
  message: string;
  metadata?: Record<string, any>;
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

  broadcast: async (data: CreateNotificationData) => {
    const response = await api.post('/admin/notifications/broadcast', data);
    return response.data;
  },
};

export interface Conversation {
  id: string
  clientId: string
  providerId: string
  serviceId: string
  isBlocked?: boolean
  blockedAt?: string | null
  blockedReason?: string | null
  client?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  }
  provider?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  }
  service?: {
    id: string
    title: string
  }
  createdAt: string
  updatedAt: string
}

export interface FraudDetection {
  id: string
  conversationId: string
  messageId: string
  senderId: string
  messageText: string
  category?: string
  reason?: string
  confidence?: 'low' | 'medium' | 'high'
  signals?: string[]
  sender?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  }
  createdAt: string
  updatedAt: string
}

export interface ReactivationRequest {
  id: string
  conversationId: string
  requesterId: string
  requester?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  }
  status: ReactivationRequestStatus
  decidedAt?: string | null
  decidedBy?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
    email?: string
  } | null
  note?: string | null
  createdAt: string
  updatedAt: string
}

export interface FraudConversationRow {
  conversation: Conversation
  fraudCount: number
  latestFraudAt: string | null
  frauds: FraudDetection[]
  reactivationRequests: ReactivationRequest[]
  pendingRequestCount: number
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  message: string
  attachmentFiles?: string[]
  sender?: {
    id: string
    firstName?: string
    lastName?: string
    userName?: string
  }
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: string
  title: string
  description: string
  balance: number
  status: string
  feedback?: string
  rating?: number
  clientId: string
  providerId: string
  createdAt: string
  updatedAt: string
}

export const conversationApi = {
  getById: async (id: string): Promise<Conversation> => {
    const response = await api.get(`/conversations/${id}`)
    return response.data
  },
}

export const messageApi = {
  getByConversation: async (conversationId: string, limit?: number, before?: string): Promise<{ messages: Message[]; hasMore: boolean }> => {
    const params: any = {}
    if (limit !== undefined) params.limit = limit
    if (before) params.before = before
    const response = await api.get(`/messages/conversation/${conversationId}`, { params })
    return response.data
  },
  create: async (conversationId: string, message: string): Promise<Message> => {
    const response = await api.post(`/messages/conversation/${conversationId}`, { message })
    return response.data
  },
}

export const milestoneApi = {
  getByConversation: async (conversationId: string): Promise<Milestone[]> => {
    const response = await api.get(`/milestones/conversation/${conversationId}`)
    return response.data
  },
}

export default api;

