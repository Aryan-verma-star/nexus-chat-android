import { supabase, User, Conversation, Message, Job, Notification } from './supabase';
import { mockUsers, mockConversations, mockMessages, mockJobs } from '@/data/mockData';

const API_URL = import.meta.env.VITE_API_URL || '';
const USE_MOCK = !API_URL;

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('nexus_access_token');
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  
  if (!text) {
    throw new Error('Empty response');
  }
  
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON: ' + text.substring(0, 100));
  }
  
  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }
  
  return data;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // Auth
  auth: {
    login: async (emailOrUsername: string, password: string) => {
      if (USE_MOCK) {
        await delay(500);
        const user = mockUsers.find(u => u.username.toLowerCase() === emailOrUsername.toLowerCase()) || mockUsers[0];
        localStorage.setItem('nexus_access_token', 'mock-token');
        localStorage.setItem('nexus_user', JSON.stringify({
          id: user.id,
          username: user.username,
          display_name: user.displayName,
          role: user.role,
          is_active: true,
          is_online: true,
        }));
        return {
          success: true,
          data: {
            user: {
              id: user.id,
              username: user.username,
              display_name: user.displayName,
              role: user.role,
              avatar_url: null,
              custom_status: user.status || '',
              is_active: true,
              is_online: true,
              last_seen: new Date().toISOString(),
            },
            session: { access_token: 'mock-token', refresh_token: 'mock-refresh', expires_at: Date.now() + 3600000 },
          },
          error: null,
        };
      }

      const data = await fetchApi<{
        success: boolean;
        data: { user: User; session: { access_token: string; refresh_token: string; expires_at: number } };
        error: string | null;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: emailOrUsername.includes('@') ? emailOrUsername : undefined, username: !emailOrUsername.includes('@') ? emailOrUsername : undefined, password }),
      });

      if (data.success && data.data.session) {
        localStorage.setItem('nexus_access_token', data.data.session.access_token);
        localStorage.setItem('nexus_refresh_token', data.data.session.refresh_token);
        localStorage.setItem('nexus_user', JSON.stringify(data.data.user));
      }

      return data;
    },

    logout: async () => {
      if (USE_MOCK) {
        localStorage.removeItem('nexus_access_token');
        localStorage.removeItem('nexus_user');
        return;
      }
      await fetchApi('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('nexus_access_token');
      localStorage.removeItem('nexus_refresh_token');
      localStorage.removeItem('nexus_user');
    },

    me: async () => {
      if (USE_MOCK) {
        const userStr = localStorage.getItem('nexus_user');
        const user = userStr ? JSON.parse(userStr) : mockUsers[0];
        return { user, unread_notification_count: 0 };
      }
      const data = await fetchApi<{ success: boolean; data: { user: User; unread_notification_count: number }; error: string | null }>('/api/auth/me');
      return data.data;
    },
  },

  // Users
  users: {
    list: async () => {
      if (USE_MOCK) {
        return mockUsers.map(u => ({
          id: u.id,
          username: u.username,
          display_name: u.displayName,
          avatar_url: u.avatarUrl || null,
          role: u.role,
          custom_status: u.status || '',
          is_active: true,
          is_online: u.isOnline,
          last_seen: u.lastSeen,
        }));
      }
      const data = await fetchApi<{ success: boolean; data: User[]; error: string | null }>('/api/users');
      return data.data;
    },

    get: async (id: string) => {
      if (USE_MOCK) {
        const u = mockUsers.find(u => u.id === id) || mockUsers[0];
        return {
          id: u.id,
          username: u.username,
          display_name: u.displayName,
          avatar_url: u.avatarUrl || null,
          role: u.role,
          custom_status: u.status || '',
          is_active: true,
          is_online: u.isOnline,
          last_seen: u.lastSeen,
        };
      }
      const data = await fetchApi<{ success: boolean; data: User; error: string | null }>(`/api/users/${id}`);
      return data.data;
    },

    update: async (id: string, updates: Partial<User>) => {
      if (USE_MOCK) return {} as User;
      const data = await fetchApi<{ success: boolean; data: User; error: string | null }>(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return data.data;
    },
  },

  // Conversations
  conversations: {
    list: async () => {
      if (USE_MOCK) {
        return mockConversations.map(c => ({
          ...c,
          id: c.id,
          type: c.type,
          name: c.name,
          avatar_url: c.avatarUrl || null,
          created_by: '1',
          last_message_at: new Date().toISOString(),
          last_message_preview: c.lastMessage,
          last_message_sender: c.lastMessageSender,
          unread_count: c.unreadCount,
          members: mockUsers.slice(0, 3).map(u => ({
            user_id: u.id,
            profile: u,
            role: u.role as 'admin' | 'member',
          })),
        })) as Conversation[];
      }
      const data = await fetchApi<{ success: boolean; data: Conversation[]; error: string | null }>('/api/conversations');
      return data.data;
    },

    get: async (id: string) => {
      if (USE_MOCK) {
        const c = mockConversations.find(x => x.id === id) || mockConversations[0];
        return {
          ...c,
          id: c.id,
          type: c.type,
          name: c.name,
          created_by: '1',
          last_message_at: new Date().toISOString(),
          members: mockUsers.slice(0, 3).map(u => ({
            user_id: u.id,
            profile: u,
            role: u.role as 'admin' | 'member',
          })),
        } as Conversation;
      }
      const data = await fetchApi<{ success: boolean; data: Conversation; error: string | null }>(`/api/conversations/${id}`);
      return data.data;
    },

    create: async (type: 'direct' | 'group', params: { user_id?: string; name?: string; member_ids?: string[]; description?: string }) => {
      if (USE_MOCK) {
        const newConv = {
          id: `c${Date.now()}`,
          type,
          name: type === 'direct' ? 'New Chat' : params.name,
          created_by: '1',
          last_message_at: new Date().toISOString(),
        };
        return newConv as Conversation;
      }
      const data = await fetchApi<{ success: boolean; data: Conversation; error: string | null }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ type, ...params }),
      });
      return data.data;
    },

    getMessages: async (id: string, page = 1, limit = 50) => {
      if (USE_MOCK) {
        const msgs = mockMessages.map(m => ({
          ...m,
          id: m.id,
          conversation_id: id,
          sender_id: m.senderId,
          content: m.content,
          type: m.type,
          created_at: new Date().toISOString(),
          sender: mockUsers.find(u => u.id === m.senderId),
        })) as Message[];
        return { data: msgs, pagination: { page, limit, total: msgs.length, hasMore: false } };
      }
      return fetchApi<{
        success: boolean;
        data: Message[];
        error: string | null;
        pagination: { page: number; limit: number; total: number; hasMore: boolean };
      }>(`/api/conversations/${id}/messages?page=${page}&limit=${limit}`);
    },

    sendMessage: async (conversationId: string, content: string, type: 'text' | 'image' | 'file' = 'text', replyTo?: string) => {
      if (USE_MOCK) {
        return {
          id: `m${Date.now()}`,
          conversation_id: conversationId,
          sender_id: '1',
          content,
          type,
          created_at: new Date().toISOString(),
        } as Message;
      }
      const data = await fetchApi<{ success: boolean; data: Message; error: string | null }>(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type, reply_to: replyTo }),
      });
      return data.data;
    },

    markRead: async (conversationId: string) => {
      if (USE_MOCK) return;
      await fetchApi(`/api/conversations/${conversationId}/read`, { method: 'POST' });
    },

    getMembers: async (conversationId: string) => {
      if (USE_MOCK) return [];
      const data = await fetchApi<{ success: boolean; data: any[]; error: string | null }>(`/api/conversations/${conversationId}/members`);
      return data.data;
    },

    addMember: async (conversationId: string, userId: string, role?: 'admin' | 'member') => {
      if (USE_MOCK) return;
      await fetchApi(`/api/conversations/${conversationId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, role }),
      });
    },

    removeMember: async (conversationId: string, userId?: string) => {
      if (USE_MOCK) return;
      await fetchApi(`/api/conversations/${conversationId}/members`, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: userId }),
      });
    },
  },

  // Jobs
  jobs: {
    list: async (status?: string, platform?: string, page = 1, limit = 20) => {
      if (USE_MOCK) {
        const filtered = mockJobs.filter(j => (!status || j.status === status) && (!platform || j.platform === platform));
        return { data: filtered as unknown as Job[], pagination: { page, limit, total: filtered.length, hasMore: false } };
      }
      let url = `/api/jobs?page=${page}&limit=${limit}`;
      if (status) url += `&status=${status}`;
      if (platform) url += `&platform=${platform}`;
      return fetchApi<{
        success: boolean;
        data: Job[];
        error: string | null;
        pagination: { page: number; limit: number; total: number; hasMore: boolean };
      }>(url);
    },

    get: async (id: string) => {
      if (USE_MOCK) {
        const j = mockJobs.find(x => x.id === id) || mockJobs[0];
        return j as unknown as Job & { comments: any[] };
      }
      const data = await fetchApi<{ success: boolean; data: Job & { comments: any[] }; error: string | null }>(`/api/jobs/${id}`);
      return data.data;
    },

    claim: async (id: string) => {
      if (USE_MOCK) {
        const j = mockJobs.find(x => x.id === id);
        if (j) j.status = 'claimed';
        return { ...j, status: 'claimed' } as unknown as Job;
      }
      const data = await fetchApi<{ success: boolean; data: Job; error: string | null }>(`/api/jobs/${id}/claim`, { method: 'POST' });
      return data.data;
    },

    complete: async (id: string) => {
      if (USE_MOCK) return {} as Job;
      const data = await fetchApi<{ success: boolean; data: Job; error: string | null }>(`/api/jobs/${id}/complete`, { method: 'POST' });
      return data.data;
    },

    addComment: async (jobId: string, content: string) => {
      if (USE_MOCK) return { id: `c${Date.now()}`, job_id: jobId, content, created_at: new Date().toISOString() };
      const data = await fetchApi<{ success: boolean; data: any; error: string | null }>(`/api/jobs/${jobId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      return data.data;
    },
  },

  // Notifications
  notifications: {
    list: async (page = 1, limit = 20) => {
      if (USE_MOCK) {
        return { data: [], pagination: { page, limit, total: 0, hasMore: false }, unread_count: 0 };
      }
      return fetchApi<{
        success: boolean;
        data: Notification[];
        error: string | null;
        pagination: { page: number; limit: number; total: number; hasMore: boolean };
        unread_count: number;
      }>(`/api/notifications?page=${page}&limit=${limit}`);
    },

    markRead: async (notificationIds: string[]) => {
      if (USE_MOCK) return;
      await fetchApi('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ notification_ids: notificationIds }),
      });
    },

    markAllRead: async () => {
      if (USE_MOCK) return;
      await fetchApi('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ mark_all: true }),
      });
    },
  },

  // Messages
  messages: {
    search: async (query: string) => {
      if (USE_MOCK) return [];
      const data = await fetchApi<{ success: boolean; data: any[]; error: string | null }>(`/api/messages/search?q=${encodeURIComponent(query)}`);
      return data.data;
    },

    addReaction: async (messageId: string, emoji: string) => {
      if (USE_MOCK) return;
      await fetchApi('/api/messages/react', {
        method: 'POST',
        body: JSON.stringify({ message_id: messageId, emoji }),
      });
    },

    removeReaction: async (messageId: string, emoji: string) => {
      if (USE_MOCK) return;
      await fetchApi('/api/messages/react', {
        method: 'DELETE',
        body: JSON.stringify({ message_id: messageId, emoji }),
      });
    },
  },
};

export function getStoredUser(): User | null {
  const userStr = localStorage.getItem('nexus_user');
  return userStr ? JSON.parse(userStr) : null;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('nexus_access_token');
}
